import { prisma } from '../../config/prisma';
import { SaleDatasource, SaleCreateData } from '../../domain/datasources/sale.datasource';
import { SaleEntity, SaleType, SaleStatus } from '../../domain/entities';
import { FilterSalesDto } from '../../domain/dtos/sales';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

// Inclusión de ítems en todas las consultas de venta
const SALE_WITH_ITEMS = {
  items: true,
} as const;

function mapToEntity(sale: Record<string, unknown>): SaleEntity {
  return SaleEntity.fromObject(sale);
}

function buildWhere(filters: FilterSalesDto) {
  return {
    ...(filters.clientId && { clientId: filters.clientId }),
    ...(filters.type && { type: filters.type }),
    ...(filters.status && { status: filters.status }),
    ...((filters.dateFrom || filters.dateTo) && {
      createdAt: {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo }),
      },
    }),
  };
}

export class PrismaSaleDatasource implements SaleDatasource {
  async findAll(pagination: PaginationDto, filters: FilterSalesDto): Promise<PaginatedResult<SaleEntity>> {
    const where = buildWhere(filters);

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: SALE_WITH_ITEMS,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.sale.count({ where }),
    ]);

    return {
      data: sales.map((s) => mapToEntity(s as unknown as Record<string, unknown>)),
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

  async findById(id: string): Promise<SaleEntity | null> {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: SALE_WITH_ITEMS,
    });

    if (!sale) return null;

    return mapToEntity(sale as unknown as Record<string, unknown>);
  }

  async findByClientId(clientId: string): Promise<SaleEntity[]> {
    const sales = await prisma.sale.findMany({
      where: { clientId },
      include: SALE_WITH_ITEMS,
      orderBy: { createdAt: 'desc' },
    });

    return sales.map((sale) => mapToEntity(sale as unknown as Record<string, unknown>));
  }

  async create(data: SaleCreateData): Promise<SaleEntity> {
    const isCashSale = data.type === SaleType.CASH;

    /**
     * Transacción atómica: si cualquier operación falla, se revierten todas.
     * Esto garantiza consistencia entre venta, stock e ítems.
     */
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Descontar stock de cada producto
      for (const item of data.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // 2. Si es venta a crédito, incrementar el balance del cliente y registrar en auditoría
      if (!isCashSale) {
        await tx.client.update({
          where: { id: data.clientId },
          data: { balance: { increment: data.total } },
        });

        // Escribir el log dentro de la misma transacción garantiza que si algo falla
        // (ej. creación de la venta), el registro de auditoría también se revierte.
        if (data.auditLog) {
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
        }
      }

      // 3. Crear la venta con sus ítems (y campos de cuotas si aplica)
      const created = await tx.sale.create({
        data: {
          clientId: data.clientId,
          type: data.type,
          // Venta en efectivo queda PAID de inmediato; crédito queda PENDING
          status: isCashSale ? SaleStatus.PAID : SaleStatus.PENDING,
          total: data.total,
          // Campos de cuotas — se omiten del INSERT cuando no aplican (undefined → Prisma los ignora)
          ...(data.installmentsCount !== undefined && {
            installmentsCount: data.installmentsCount,
            frequency: data.frequency,
            installmentAmount: data.installmentAmount,
          }),
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              basePrice: item.basePrice,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
              appliedRule: item.appliedRule,
            })),
          },
        },
        include: SALE_WITH_ITEMS,
      });

      return created;
    });

    return mapToEntity(sale as unknown as Record<string, unknown>);
  }
}
