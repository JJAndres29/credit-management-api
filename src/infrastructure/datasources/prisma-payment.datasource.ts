import { prisma } from '../../config/prisma';
import { PaymentDatasource, PaymentCreateData } from '../../domain/datasources/payment.datasource';
import { PaymentEntity, SaleStatus } from '../../domain/entities';
import { FilterPaymentsDto } from '../../domain/dtos/payments';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

function mapToEntity(payment: Record<string, unknown>): PaymentEntity {
  return PaymentEntity.fromObject(payment);
}

function buildWhere(filters: FilterPaymentsDto) {
  return {
    ...(filters.clientId && { clientId: filters.clientId }),
    ...(filters.saleId && { saleId: filters.saleId }),
    ...((filters.dateFrom || filters.dateTo) && {
      createdAt: {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo }),
      },
    }),
  };
}

export class PrismaPaymentDatasource implements PaymentDatasource {
  async findAll(pagination: PaginationDto, filters: FilterPaymentsDto): Promise<PaginatedResult<PaymentEntity>> {
    const where = buildWhere(filters);

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          client: { select: { documentNumber: true } },
          sale: { select: { saleNumber: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      data: payments.map((p) => mapToEntity(p as unknown as Record<string, unknown>)),
      pagination: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
        hasNextPage: pagination.page * pagination.limit < total,
        hasPrevPage: pagination.page > 1,
      },
    };
  }

  async findById(id: string): Promise<PaymentEntity | null> {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        client: { select: { documentNumber: true } },
        sale: { select: { saleNumber: true } },
      },
    });
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

      // 3. Registrar en auditoría dentro de la misma transacción.
      // Si cualquier paso posterior falla, este log también se revierte.
      await tx.auditLog.create({
        data: {
          clientId: data.clientId,
          userId: data.auditLog.userId,
          action: data.auditLog.action,
          before: data.auditLog.before,
          after: data.auditLog.after,
          ip: data.auditLog.ip,
        },
      });

      // 4. Si el pago está asociado a una venta, recalcular su estado
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
