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
    let saleInstallmentsCount: number | null = null;
    let saleInstallmentAmount: number | null = null;
    let saleTotalPaidAfter: number | undefined;

    // 3. Validaciones adicionales cuando el pago va asociado a una venta específica
    if (dto.saleId) {
      const sale = await this.saleRepository.findById(dto.saleId);

      if (!sale) throw CustomError.notFound(`Venta con ID ${dto.saleId} no encontrada`);

      // Seguridad: la venta debe pertenecer al mismo cliente
      // Esto evita que un usuario malintencionado asocie un pago al ID de la venta
      // de otro cliente y reduzca el balance incorrecto
      if (sale.clientId !== dto.clientId) {
        throw CustomError.forbidden('La venta no pertenece al cliente indicado');
      }

      // No se puede pagar una venta ya liquidada
      if (sale.status === SaleStatus.PAID) {
        throw CustomError.badRequest('La venta ya está completamente pagada');
      }

      // Calcular cuánto queda por pagar en esta venta específica
      const existingPayments = await this.paymentRepository.findBySaleId(dto.saleId);
      const totalAlreadyPaid = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const remaining = Number(sale.total) - totalAlreadyPaid;

      if (dto.amount > remaining) {
        throw CustomError.badRequest(
          `El monto ($${dto.amount.toFixed(2)}) supera lo pendiente de la venta ($${remaining.toFixed(2)})`,
        );
      }

      saleTotal = Number(sale.total);
      saleInstallmentsCount = sale.installmentsCount;
      saleInstallmentAmount = sale.installmentAmount;
      saleTotalPaidAfter = totalAlreadyPaid + dto.amount;
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
      auditLog: {
        userId,
        action: AuditAction.PAYMENT,
        before: clientBalance,
        after: clientBalance - dto.amount,
        ip,
      },
    });

    // 5. Emitir evento DESPUÉS de que la transacción se commitea.
    //    La notificación es best-effort — si falla, el pago ya está registrado.
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
      n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const whatsappPayload: WhatsAppPayload | null = client.phone
      ? {
          phone: client.phone,
          message:
            `Hola ${client.name}, se registró un abono de $${fmt(dto.amount)} en tu cuenta. ` +
            `Tu saldo actual es $${fmt(newBalance)}. Ref: ${payment.id.slice(0, 8)}`,
        }
      : null;

    return { payment, whatsappPayload };
  }
}
