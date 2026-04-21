import { CustomError } from '../../errors';
import { PaymentEntity, SaleStatus, AuditAction } from '../../entities';
import { CreatePaymentDto } from '../../dtos/payments';
import { PaymentRepository } from '../../repositories';
import { ClientRepository } from '../../repositories';
import { SaleRepository } from '../../repositories';
import { EventEmitterPort, PAYMENT_REGISTERED } from '../../events';

export interface WhatsAppPayload {
  phone: string;
  message: string;
}

export interface CreatePaymentResult {
  payment: PaymentEntity;
  whatsappPayload: WhatsAppPayload | null;
}

export class CreatePaymentUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly clientRepository: ClientRepository,
    private readonly saleRepository: SaleRepository,
    /**
     * Opcional: si no se inyecta (e.g. en tests), las notificaciones se omiten
     * sin romper la lógica de negocio ni los tests existentes.
     */
    private readonly eventEmitter?: EventEmitterPort,
  ) {}

  async execute(dto: CreatePaymentDto, userId: string, ip: string): Promise<CreatePaymentResult> {
    // 1. Verificar que el cliente existe y está activo
    const client = await this.clientRepository.findById(dto.clientId);
    if (!client) throw CustomError.notFound(`Cliente con ID ${dto.clientId} no encontrado`);
    if (!client.isActive) throw CustomError.badRequest('El cliente no está activo');

    const clientBalance = Number(client.balance);

    // 2. Validar que el pago no supere el balance actual del cliente
    //    (no tiene sentido pagar más de lo que debe)
    if (dto.amount > clientBalance) {
      throw CustomError.badRequest(
        `El monto ($${dto.amount.toFixed(2)}) supera el balance actual del cliente ($${clientBalance.toFixed(2)})`,
      );
    }

    let saleTotal: number | undefined;
    let saleNumber: number | null = null;
    let saleInstallmentsCount: number | null = null;
    let saleInstallmentAmount: number | null = null;
    let saleTotalPaidAfter: number | undefined;
    let saleCreatedAt: Date | null = null;
    let saleInitialPayment: number = 0;

    // 3. Validaciones adicionales cuando el pago va asociado a una venta específica
    if (dto.saleId) {
      const sale = await this.saleRepository.findById(dto.saleId);

      if (!sale) throw CustomError.notFound(`Venta con ID ${dto.saleId} no encontrada`);

      if (sale.clientId !== dto.clientId) {
        throw CustomError.forbidden('La venta no pertenece al cliente indicado');
      }

      if (sale.status === SaleStatus.PAID) {
        throw CustomError.badRequest('La venta ya está completamente pagada');
      }

      const existingPayments = await this.paymentRepository.findBySaleId(dto.saleId);
      const totalAlreadyPaid = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const remaining = Number(sale.total) - totalAlreadyPaid;

      if (dto.amount > remaining) {
        throw CustomError.badRequest(
          `El monto ($${dto.amount.toFixed(2)}) supera lo pendiente de la venta ($${remaining.toFixed(2)})`,
        );
      }

      saleTotal = Number(sale.total);
      saleNumber = sale.saleNumber;
      saleInstallmentsCount = sale.installmentsCount;
      saleInstallmentAmount = sale.installmentAmount;
      saleTotalPaidAfter = totalAlreadyPaid + dto.amount;
      saleCreatedAt = sale.createdAt;
      // initialPayment se descuenta para que solo los pagos regulares cuenten
      // en el cálculo de cuotas: paidInstallments = (totalPaid - initialPayment) / installmentAmount
      saleInitialPayment = sale.initialPayment ?? 0;
    }

    // 4. Persistir: la transacción atómica en el datasource se encarga de:
    //    crear el pago, decrementar el balance del cliente, escribir el audit log
    //    y (si hay saleId) actualizar el estado de la venta.
    const payment = await this.paymentRepository.create({
      clientId: dto.clientId,
      saleId: dto.saleId,
      amount: dto.amount,
      note: dto.note,
      saleTotal,
      createdAt: dto.createdAt,
      auditLog: {
        userId,
        action: AuditAction.PAYMENT,
        before: clientBalance,
        after: clientBalance - dto.amount,
        ip,
      },
    });

    // 5. Emitir evento DESPUÉS de que la transacción se commitea.
    this.eventEmitter?.emit(PAYMENT_REGISTERED, {
      paymentId: payment.id,
      clientId: dto.clientId,
      amount: dto.amount,
      newBalance: clientBalance - dto.amount,
      note: dto.note,
      saleInstallmentsCount,
      saleInstallmentAmount,
      saleTotalPaidAfter,
    });

    const newBalance = clientBalance - dto.amount;
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    const fmtDate = (d: Date) => {
      const parts = new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).formatToParts(d);
      const day = parts.find((p) => p.type === 'day')!.value;
      const month = parts.find((p) => p.type === 'month')!.value;
      const year = parts.find((p) => p.type === 'year')!.value;
      return `${day}-${month}-${year}`;
    };

    let whatsappPayload: WhatsAppPayload | null = null;

    if (client.phone && dto.saleId && saleNumber !== null && saleTotal !== undefined && saleCreatedAt !== null) {
      let installmentsLine = '';
      if (saleInstallmentsCount !== null && saleInstallmentAmount !== null && saleTotalPaidAfter !== undefined) {
        const regularPaid = saleTotalPaidAfter - saleInitialPayment;
        const paidInstallments = fmt(regularPaid / saleInstallmentAmount);
        installmentsLine = `\n\nCuotas pagadas ${paidInstallments} de ${saleInstallmentsCount}.`;
      }

      whatsappPayload = {
        phone: client.phone,
        message:
          `***\nESTADO DE CUENTA\n***\n\n` +
          `Sr(a) ${client.name}, el estado de cuenta de su crédito No.${saleNumber} es el siguiente:\n\n` +
          `Fecha inicial ${fmtDate(saleCreatedAt)}.\n\n` +
          `Valor del crédito ${fmt(saleTotal)}.\n\n` +
          `Último pago realizado el ${fmtDate(payment.createdAt)} por valor de ${fmt(dto.amount)}.` +
          installmentsLine +
          `\n\nSu nuevo saldo es ${fmt(newBalance)}.`,
      };
    } else if (client.phone) {
      whatsappPayload = {
        phone: client.phone,
        message:
          `***\nESTADO DE CUENTA\n***\n\n` +
          `Sr(a) ${client.name}, se registró un abono de ${fmt(dto.amount)}.\n\n` +
          `Su nuevo saldo es ${fmt(newBalance)}.`,
      };
    }

    return { payment, whatsappPayload };
  }
}
