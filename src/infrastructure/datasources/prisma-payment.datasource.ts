import { prisma } from '../../config/prisma';
import { PaymentDatasource, PaymentCreateData, PaymentUpdateData, PaymentDeleteData } from '../../domain/datasources/payment.datasource';
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

  async findBySaleIds(saleIds: string[]): Promise<PaymentEntity[]> {
    if (saleIds.length === 0) return [];

    const payments = await prisma.payment.findMany({
      where: { saleId: { in: saleIds } },
      orderBy: { createdAt: 'asc' },
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
          // Fecha real del pago — si no se provee, Prisma usa now()
          ...(data.createdAt !== undefined && { createdAt: data.createdAt }),
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

  async update(id: string, data: PaymentUpdateData): Promise<PaymentEntity> {
    /**
     * Transacción atómica: si cambia el amount se ajusta el balance del cliente
     * y se recalcula el estado de la venta (si aplica). El AuditLog se escribe
     * dentro de la misma transacción para garantizar trazabilidad completa.
     */
    const payment = await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({ where: { id } });
      if (!existing) throw new Error(`Pago ${id} no encontrado en la transacción`);

      const updateData: Record<string, unknown> = {};
      if (data.amount !== undefined) updateData.amount = data.amount;
      if (data.note !== undefined) updateData.note = data.note;
      if (data.createdAt !== undefined) updateData.createdAt = data.createdAt;

      const updated = await tx.payment.update({
        where: { id },
        data: updateData,
        include: {
          client: { select: { documentNumber: true } },
          sale: { select: { saleNumber: true } },
        },
      });

      if (data.amount !== undefined && data.auditLog) {
        const oldAmount = Number(existing.amount);
        const delta = oldAmount - data.amount; // positivo si pagó menos, negativo si pagó más

        // Ajustar balance del cliente con el delta
        await tx.client.update({
          where: { id: existing.clientId },
          data: { balance: { increment: delta } },
        });

        // Registrar en auditoría
        await tx.auditLog.create({
          data: {
            clientId: existing.clientId,
            userId: data.auditLog.userId,
            action: data.auditLog.action,
            before: data.auditLog.before,
            after: data.auditLog.after,
            ip: data.auditLog.ip,
          },
        });

        // Recalcular estado de la venta si el pago está asociado a una
        if (existing.saleId && data.saleTotal !== undefined) {
          const aggregate = await tx.payment.aggregate({
            where: { saleId: existing.saleId },
            _sum: { amount: true },
          });

          const totalPaid = Number(aggregate._sum.amount ?? 0);
          const newStatus =
            totalPaid >= data.saleTotal
              ? SaleStatus.PAID
              : totalPaid > 0
                ? SaleStatus.PARTIAL
                : SaleStatus.PENDING;

          await tx.sale.update({
            where: { id: existing.saleId },
            data: { status: newStatus },
          });
        }
      }

      return updated;
    });

    return mapToEntity(payment as unknown as Record<string, unknown>);
  }

  async delete(id: string, data: PaymentDeleteData): Promise<PaymentEntity> {
    const payment = await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({ where: { id } });
      if (!existing) throw new Error(`Pago ${id} no encontrado en la transacción`);

      // Eliminar el pago
      const deleted = await tx.payment.delete({ where: { id } });

      // Revertir el balance del cliente (el pago ya no existe, vuelve a deber ese monto)
      await tx.client.update({
        where: { id: existing.clientId },
        data: { balance: { increment: Number(existing.amount) } },
      });

      // Registrar en auditoría
      await tx.auditLog.create({
        data: {
          clientId: existing.clientId,
          userId: data.auditLog.userId,
          action: data.auditLog.action,
          before: data.auditLog.before,
          after: data.auditLog.after,
          ip: data.auditLog.ip,
        },
      });

      // Recalcular estado de la venta si el pago estaba asociado a una
      if (existing.saleId && data.saleTotal !== undefined) {
        const aggregate = await tx.payment.aggregate({
          where: { saleId: existing.saleId },
          _sum: { amount: true },
        });

        const totalPaid = Number(aggregate._sum.amount ?? 0);
        const newStatus =
          totalPaid >= data.saleTotal
            ? SaleStatus.PAID
            : totalPaid > 0
              ? SaleStatus.PARTIAL
              : SaleStatus.PENDING;

        await tx.sale.update({
          where: { id: existing.saleId },
          data: { status: newStatus },
        });
      }

      return deleted;
    });

    return mapToEntity(payment as unknown as Record<string, unknown>);
  }
}
