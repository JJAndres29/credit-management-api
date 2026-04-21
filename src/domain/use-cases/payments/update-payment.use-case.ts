import { CustomError } from '../../errors';
import { PaymentEntity, SaleStatus, AuditAction } from '../../entities';
import { UpdatePaymentDto } from '../../dtos/payments';
import { PaymentRepository } from '../../repositories';
import { ClientRepository } from '../../repositories';
import { SaleRepository } from '../../repositories';
import { AuditLogData } from '../../datasources/audit-log.datasource';

export class UpdatePaymentUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly clientRepository: ClientRepository,
    private readonly saleRepository: SaleRepository,
  ) {}

  async execute(id: string, dto: UpdatePaymentDto, userId: string, ip: string): Promise<PaymentEntity> {
    // 1. Verificar que el pago existe
    const payment = await this.paymentRepository.findById(id);
    if (!payment) throw CustomError.notFound(`Pago con ID ${id} no encontrado`);

    const oldAmount = Number(payment.amount);

    let saleTotal: number | undefined;
    let auditLog: AuditLogData | undefined;

    if (dto.amount !== undefined) {
      const newAmount = dto.amount;

      // 2. Verificar que el cliente existe y calcular nuevo balance
      const client = await this.clientRepository.findById(payment.clientId);
      if (!client) throw CustomError.notFound(`Cliente con ID ${payment.clientId} no encontrado`);

      const currentBalance = Number(client.balance);

      // balance += (oldAmount - newAmount)
      // Si newAmount > oldAmount → balance baja (cliente pagó más)
      // Si newAmount < oldAmount → balance sube (cliente pagó menos)
      const newClientBalance = currentBalance + oldAmount - newAmount;

      if (newClientBalance < 0) {
        throw CustomError.badRequest(
          `El nuevo monto ($${newAmount.toFixed(2)}) supera lo que el cliente adeuda. ` +
            `El balance resultante sería negativo ($${newClientBalance.toFixed(2)})`,
        );
      }

      // 3. Si el pago tiene venta asociada, validar que no sobrepague la venta
      if (payment.saleId) {
        const sale = await this.saleRepository.findById(payment.saleId);
        if (!sale) throw CustomError.notFound(`Venta con ID ${payment.saleId} no encontrada`);

        const allPayments = await this.paymentRepository.findBySaleId(payment.saleId);
        const otherPaymentsTotal = allPayments
          .filter((p) => p.id !== id)
          .reduce((sum, p) => sum + Number(p.amount), 0);

        const newTotalPaid = otherPaymentsTotal + newAmount;

        if (newTotalPaid > Number(sale.total)) {
          throw CustomError.badRequest(
            `El nuevo monto ($${newAmount.toFixed(2)}) haría que el total pagado de la venta ` +
              `($${newTotalPaid.toFixed(2)}) supere el total de la venta ($${Number(sale.total).toFixed(2)})`,
          );
        }

        saleTotal = Number(sale.total);
      }

      auditLog = {
        userId,
        action: AuditAction.PAYMENT_MODIFIED,
        before: currentBalance,
        after: newClientBalance,
        ip,
      };
    }

    return await this.paymentRepository.update(id, {
      amount: dto.amount,
      note: dto.note,
      saleTotal,
      auditLog,
    });
  }
}
