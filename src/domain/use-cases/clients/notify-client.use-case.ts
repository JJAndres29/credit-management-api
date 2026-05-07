import { CustomError } from '../../errors';
import { ClientRepository } from '../../repositories';
import { SaleRepository } from '../../repositories';
import { PaymentRepository } from '../../repositories';
import { EventEmitterPort, CLIENT_NOTIFY_REQUESTED } from '../../events';
import { SaleStatus, SaleType } from '../../entities/sale.entity';
import { InstallmentScheduleService } from '../../services/installments';

export interface NotifyClientResult {
  whatsappPayload: { phone: string; message: string } | null;
}

export class NotifyClientUseCase {
  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly eventEmitter?: EventEmitterPort,
    private readonly saleRepository?: SaleRepository,
    private readonly paymentRepository?: PaymentRepository,
    private readonly installmentScheduleService: InstallmentScheduleService = new InstallmentScheduleService(),
  ) {}

  async execute(clientId: string, requestedBy: string): Promise<NotifyClientResult> {
    const client = await this.clientRepository.findById(clientId);
    if (!client) throw CustomError.notFound(`Cliente con ID ${clientId} no encontrado`);
    if (!client.isActive) throw CustomError.badRequest('El cliente no está activo');

    // Emitir evento para que el subscriber envíe email con PDF adjunto de forma asíncrona.
    // La respuesta HTTP no espera ni depende de este envío.
    this.eventEmitter?.emit(CLIENT_NOTIFY_REQUESTED, { clientId, requestedBy });

    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        n,
      );

    const fmtDate = (date: Date) => {
      const parts = new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).formatToParts(date);
      const day = parts.find((p) => p.type === 'day')!.value;
      const month = parts.find((p) => p.type === 'month')!.value;
      const year = parts.find((p) => p.type === 'year')!.value;
      return `${day}-${month}-${year}`;
    };

    let whatsappPayload: { phone: string; message: string } | null = null;

    if (client.phone) {
      const activeSale = await this.findActiveCreditSale(clientId);
      let message: string;

      if (
        activeSale &&
        activeSale.installmentsCount &&
        activeSale.installmentAmount &&
        this.paymentRepository
      ) {
        const payments = await this.paymentRepository.findBySaleId(activeSale.id);
        const today = InstallmentScheduleService.todayBogota();
        const schedule = this.installmentScheduleService.compute(
          {
            id: activeSale.id,
            saleNumber: activeSale.saleNumber,
            clientId: activeSale.clientId,
            total: activeSale.total,
            createdAt: activeSale.createdAt,
            installmentsCount: activeSale.installmentsCount!, // guarded above
            installmentAmount: activeSale.installmentAmount,
            collectionDay: activeSale.collectionDay,
            collectionDay2: activeSale.collectionDay2,
            frequency: activeSale.frequency,
            initialPayment: activeSale.initialPayment,
          },
          payments,
          today,
        );

        const paidCount = schedule.installments.filter((i) => i.status === 'PAID').length;
        const nextDue = schedule.installments.find(
          (i) => i.status === 'PARTIAL' || i.status === 'PENDING' || i.status === 'OVERDUE',
        );

        message =
          `*\nESTADO DE CUENTA\n*\n\n` +
          `Sr(a) ${client.name}, el estado de cuenta de su crédito No.${activeSale.saleNumber} es el siguiente:\n\n` +
          `Fecha inicial ${fmtDate(activeSale.createdAt)}.\n\n` +
          `Valor del crédito ${fmt(Number(activeSale.total))}.\n\n` +
          (activeSale.initialPayment != null
            ? `Cuota inicial aplicada el ${fmtDate(activeSale.createdAt)} por valor de ${fmt(Number(activeSale.initialPayment))}.\n\n`
            : '') +
          `Cuotas pagadas ${paidCount} de ${activeSale.installmentsCount}.\n\n` +
          (nextDue && nextDue.remainingAmount > 0
            ? `Próximo cobro: ${fmt(nextDue.remainingAmount)} con vencimiento ${fmtDate(nextDue.dueDate)}.\n\n`
            : '') +
          `Su saldo actual es ${fmt(Number(client.balance))}.`;
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
