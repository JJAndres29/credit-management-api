import { prisma } from '../../config/prisma';
import { PaymentDatasource, PaymentCreateData } from '../../domain/datasources/payment.datasource';
import { PaymentEntity } from '../../domain/entities';
import { SaleStatus } from '../../domain/entities';

function mapToEntity(payment: Record<string, unknown>): PaymentEntity {
  return PaymentEntity.fromObject(payment);
}

export class PrismaPaymentDatasource implements PaymentDatasource {
  async findAll(): Promise<PaymentEntity[]> {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => mapToEntity(p as unknown as Record<string, unknown>));
  }

  async findById(id: string): Promise<PaymentEntity | null> {
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return null;
    return mapToEntity(payment as unknown as Record<string, unknown>);
  }

  async findByClientId(clientId: string): Promise<PaymentEntity[]> {
    const payments = await prisma.payment.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => mapToEntity(p as unknown as Record<string, unknown>));
  }

  async findBySaleId(saleId: string): Promise<PaymentEntity[]> {
    const payments = await prisma.payment.findMany({
      where: { saleId },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => mapToEntity(p as unknown as Record<string, unknown>));
  }

  async create(data: PaymentCreateData): Promise<PaymentEntity> {
    /**
     * Transacción atómica: si cualquier operación falla, se revierten todas.
     * Esto garantiza consistencia entre el pago, el balance del cliente
     * y el estado de la venta.
     */
    const payment = await prisma.$transaction(async (tx) => {
      // 1. Crear el registro del pago
      const created = await tx.payment.create({
        data: {
          clientId: data.clientId,
          saleId: data.saleId ?? null,
          amount: data.amount,
          note: data.note ?? null,
        },
      });

      // 2. Decrementar el balance del cliente por el monto pagado
      await tx.client.update({
        where: { id: data.clientId },
        data: { balance: { decrement: data.amount } },
      });

      // 3. Si el pago está asociado a una venta, recalcular su estado
      if (data.saleId && data.saleTotal !== undefined) {
        // Sumamos todos los pagos previos de esta venta (ya guardados en BD)
        // más el pago que acabamos de crear
        const aggregate = await tx.payment.aggregate({
          where: { saleId: data.saleId },
          _sum: { amount: true },
        });

        const totalPaid = Number(aggregate._sum.amount ?? 0);
        const newStatus = totalPaid >= data.saleTotal ? SaleStatus.PAID : SaleStatus.PARTIAL;

        await tx.sale.update({
          where: { id: data.saleId },
          data: { status: newStatus },
        });
      }

      return created;
    });

    return mapToEntity(payment as unknown as Record<string, unknown>);
  }
}
