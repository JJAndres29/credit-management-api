import { CustomError } from '../../errors';
import { ClientRepository } from '../../repositories';
import { SaleRepository } from '../../repositories';
import { PaymentRepository } from '../../repositories';
import { EventEmitterPort, CLIENT_NOTIFY_REQUESTED } from '../../events';
import { SaleStatus, SaleType } from '../../entities/sale.entity';

export interface NotifyClientResult {
  whatsappPayload: { phone: string; message: string } | null;
}

export class NotifyClientUseCase {
  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly eventEmitter?: EventEmitterPort,
    private readonly saleRepository?: SaleRepository,
    private readonly paymentRepository?: PaymentRepository,
  ) {}

  async execute(clientId: string, requestedBy: string): Promise<NotifyClientResult> {
    const client = await this.clientRepository.findById(clientId);
    if (!client) throw CustomError.notFound(`Cliente con ID ${clientId} no encontrado`);
    if (!client.isActive) throw CustomError.badRequest('El cliente no está activo');

    // Emitir evento para que el subscriber envíe email con PDF adjunto de forma asíncrona.
    // La respuesta HTTP no espera ni depende de este envío.
    this.eventEmitter?.emit(CLIENT_NOTIFY_REQUESTED, { clientId, requestedBy });

    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    const fmtDate = (date: Date) => {
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${d}-${m}-${date.getFullYear()}`;
    };

    let whatsappPayload: { phone: string; message: string } | null = null;

    if (client.phone) {
      const activeSale = await this.findActiveCreditSale(clientId);
      let message: string;

      if (activeSale && activeSale.installmentsCount && activeSale.installmentAmount && this.paymentRepository) {
        const payments = await this.paymentRepository.findBySaleId(activeSale.id);
        const totalPaidSoFar = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const initialPayment = Number(activeSale.initialPayment ?? 0);
        const paidInstallments = Math.max(
          0,
          (totalPaidSoFar - initialPayment) / Number(activeSale.installmentAmount),
        );

        message =
          `*\nESTADO DE CUENTA\n*\n\n` +
          `Sr(a) ${client.name}, el estado de cuenta de su crédito No.${activeSale.saleNumber} es el siguiente:\n\n` +
          `Fecha inicial ${fmtDate(activeSale.createdAt)}.\n\n` +
          `Valor del crédito ${fmt(Number(activeSale.total))}.\n\n` +
          (activeSale.initialPayment != null
            ? `Cuota inicial aplicada el ${fmtDate(activeSale.createdAt)} por valor de ${fmt(initialPayment)}.\n\n`
            : '') +
          `Cuotas pagadas ${fmt(paidInstallments)} de ${activeSale.installmentsCount}.\n\n` +
          `Su nuevo saldo es ${fmt(Number(client.balance))}.`;
      } else {
        const balance = Number(client.balance);
        const available = Number(client.creditLimit) - balance;

        message =
          `*\nESTADO DE CUENTA\n*\n\n` +
          `Sr(a) ${client.name}, a continuación su estado de cuenta actual:\n\n` +
          `Saldo pendiente: ${fmt(balance)}.\n\n` +
          `Cupo disponible: ${fmt(available > 0 ? available : 0)}.`;
      }

      whatsappPayload = { phone: client.phone, message };
    }

    return { whatsappPayload };
  }

  private async findActiveCreditSale(clientId: string) {
    if (!this.saleRepository) return null;
    const sales = await this.saleRepository.findByClientId(clientId);
    return (
      sales
        .filter(
          (s) =>
            s.type === SaleType.CREDIT &&
            (s.status === SaleStatus.PENDING || s.status === SaleStatus.PARTIAL) &&
            s.installmentsCount != null,
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
    );
  }
}
