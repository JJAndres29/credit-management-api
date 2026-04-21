import { CustomError } from '../../errors';
import { SaleRepository } from '../../repositories';
import { ClientRepository } from '../../repositories';
import { PaymentRepository } from '../../repositories';
import { AuditAction } from '../../entities/audit-log.entity';
import { SaleType } from '../../entities';

export class DeleteSaleUseCase {
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly clientRepository: ClientRepository,
    private readonly paymentRepository: PaymentRepository,
  ) {}

  async execute(saleId: string, userId: string, ip: string) {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) throw CustomError.notFound(`Venta con ID ${saleId} no encontrada`);

    // Verificar que no existen pagos asociados a la venta
    const payments = await this.paymentRepository.findBySaleId(saleId);
    if (payments.length > 0) {
      throw CustomError.badRequest(
        'No se puede eliminar una venta que tiene pagos registrados. Elimina los pagos primero.',
      );
    }

    const isCreditSale = sale.type === SaleType.CREDIT;

    let auditLog: { userId: string; action: string; before: number; after: number; ip: string } | undefined;

    if (isCreditSale) {
      const client = await this.clientRepository.findById(sale.clientId);
      if (!client) throw CustomError.notFound(`Cliente con ID ${sale.clientId} no encontrado`);

      const before = Number(client.balance);
      const after = before - Number(sale.total);

      auditLog = {
        userId,
        action: AuditAction.SALE_DELETED,
        before,
        after,
        ip,
      };
    }

    const items = (sale.items ?? []).map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));

    return this.saleRepository.delete(saleId, {
      items,
      clientId: sale.clientId,
      total: Number(sale.total),
      type: sale.type as SaleType,
      auditLog,
    });
  }
}
