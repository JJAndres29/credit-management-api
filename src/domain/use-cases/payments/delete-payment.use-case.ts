import { CustomError } from '../../errors';
import { PaymentRepository } from '../../repositories';
import { ClientRepository } from '../../repositories';
import { SaleRepository } from '../../repositories';
import { AuditAction } from '../../entities/audit-log.entity';

export class DeletePaymentUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly clientRepository: ClientRepository,
    private readonly saleRepository: SaleRepository,
  ) {}

  async execute(paymentId: string, userId: string, ip: string) {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) throw CustomError.notFound(`Pago con ID ${paymentId} no encontrado`);

    const client = await this.clientRepository.findById(payment.clientId);
    if (!client) throw CustomError.notFound(`Cliente con ID ${payment.clientId} no encontrado`);

    const before = Number(client.balance);
    const after = before + Number(payment.amount);

    let saleTotal: number | undefined;
    if (payment.saleId) {
      const sale = await this.saleRepository.findById(payment.saleId);
      if (sale) saleTotal = Number(sale.total);
    }

    return this.paymentRepository.delete(paymentId, {
      saleTotal,
      auditLog: {
        userId,
        action: AuditAction.PAYMENT_DELETED,
        before,
        after,
        ip,
      },
    });
  }
}
