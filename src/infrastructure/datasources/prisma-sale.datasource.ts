import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { SaleDatasource, SaleCreateData, SaleUpdateData, SaleDeleteData } from '../../domain/datasources/sale.datasource';
import { SaleEntity, SaleType, SaleStatus } from '../../domain/entities';
import { FilterSalesDto } from '../../domain/dtos/sales';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

async function ensureDefaultProductVariant(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<string> {
  const existing = await tx.productVariant.findFirst({
    where: { productId, isDefault: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const p = await tx.product.findUnique({ where: { id: productId } });
  if (!p) throw new Error(`Product ${productId} no encontrado al crear variante default`);

  const v = await tx.productVariant.create({
    data: {
      productId,
      label: 'Default',
      stock: p.stock,
      retailPrice: p.retailPrice,
      investmentCost: p.investmentCost,
      currencyCode: p.currencyCode,
      isDefault: true,
      isActive: p.isActive,
    },
  });
  return v.id;
}

// Inclusión de ítems con nombre de producto en todas las consultas de venta
const SALE_WITH_ITEMS = {
  items: { include: { product: { select: { id: true, name: true } } } },
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

  async findActiveCreditSales(clientId?: string): Promise<SaleEntity[]> {
    const sales = await prisma.sale.findMany({
      where: {
        type: SaleType.CREDIT,
        status: { in: [SaleStatus.PENDING, SaleStatus.PARTIAL] },
        installmentsCount: { not: null },
        ...(clientId && { clientId }),
      },
      include: SALE_WITH_ITEMS,
      orderBy: { createdAt: 'asc' },
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
      for (const item of data.items) {
        if (item.newProduct) {
          const created = await tx.product.create({
            data: { name: item.newProduct.name, stock: item.newProduct.stock },
          });
          item.productId = created.id;
          await tx.productVariant.create({
            data: {
              productId: created.id,
              label: 'Default',
              stock: item.newProduct.stock,
              isDefault: true,
              isActive: true,
              currencyCode: created.currencyCode,
            },
          });
        }
      }

      for (const item of data.items) {
        item.variantId = item.variantId ?? (await ensureDefaultProductVariant(tx, item.productId));
      }

      if (!data.skipStockDecrement) {
        for (const item of data.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
          const vdec = await tx.productVariant.updateMany({
            where: {
              id: item.variantId!,
              productId: item.productId,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          });
          if (vdec.count === 0) {
            throw new Error(`Stock insuficiente en variante para producto ${item.productId}`);
          }
        }
      }

      if (!isCashSale) {
        await tx.client.update({
          where: { id: data.clientId },
          data: { balance: { increment: data.total } },
        });

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

      const currencyCode = data.currencyCode ?? 'COP';

      const created = await tx.sale.create({
        data: {
          clientId: data.clientId,
          type: data.type,
          status: isCashSale ? SaleStatus.PAID : SaleStatus.PENDING,
          total: data.total,
          currencyCode,
          ...(data.installmentsCount !== undefined && {
            installmentsCount: data.installmentsCount,
            frequency: data.frequency,
            installmentAmount: data.installmentAmount,
          }),
          ...(data.collectionDay !== undefined && { collectionDay: data.collectionDay }),
          ...(data.collectionDay2 !== undefined && { collectionDay2: data.collectionDay2 }),
          ...(data.initialPayment !== undefined && { initialPayment: data.initialPayment }),
          ...(data.createdAt !== undefined && { createdAt: data.createdAt }),
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId!,
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

      if (!data.skipStockDecrement) {
        for (const item of data.items) {
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId!,
              movementType: 'SALE_PHYSICAL_DECREMENT',
              quantityDelta: -item.quantity,
              refSaleId: created.id,
            },
          });
        }
      }

      if (!isCashSale) {
        const c = await tx.client.findUnique({
          where: { id: data.clientId },
          select: { balance: true },
        });
        await tx.ledgerEntry.create({
          data: {
            clientId: data.clientId,
            saleId: created.id,
            kind: 'CREDIT_SALE_OPENED',
            delta: data.total,
            balanceAfter: c!.balance,
            currencyCode,
            description: 'Cargo por venta a crédito',
          },
        });
      }

      return created;
    });

    return mapToEntity(sale as unknown as Record<string, unknown>);
  }

  async delete(id: string, data: SaleDeleteData): Promise<SaleEntity> {
    const isCreditSale = data.type === SaleType.CREDIT;

    const deleted = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: SALE_WITH_ITEMS,
      });
      if (!sale) throw new Error(`Venta ${id} no encontrada para eliminar`);

      for (const item of data.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        const vid =
          item.variantId ??
          (
            await tx.productVariant.findFirst({
              where: { productId: item.productId, isDefault: true },
              select: { id: true },
            })
          )?.id;
        if (vid) {
          await tx.productVariant.update({
            where: { id: vid },
            data: { stock: { increment: item.quantity } },
          });
        }
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            variantId: vid ?? null,
            movementType: 'SALE_PHYSICAL_RESTORE',
            quantityDelta: item.quantity,
            refSaleId: id,
          },
        });
      }

      if (isCreditSale) {
        await tx.client.update({
          where: { id: data.clientId },
          data: { balance: { decrement: data.total } },
        });

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

        const c = await tx.client.findUnique({
          where: { id: data.clientId },
          select: { balance: true },
        });
        await tx.ledgerEntry.create({
          data: {
            clientId: data.clientId,
            saleId: id,
            kind: 'CREDIT_SALE_REVERSED',
            delta: -data.total,
            balanceAfter: c!.balance,
            currencyCode: sale?.currencyCode ?? 'COP',
            description: 'Reversión por eliminación de venta a crédito',
          },
        });
      }

      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.sale.delete({ where: { id } });

      return sale;
    });

    return mapToEntity(deleted as unknown as Record<string, unknown>);
  }

  async update(id: string, data: SaleUpdateData): Promise<SaleEntity> {
    const updateData: Record<string, unknown> = {};

    // collectionDay / collectionDay2 pueden ser null para limpiar el campo
    if (data.collectionDay !== undefined) updateData.collectionDay = data.collectionDay;
    if (data.collectionDay2 !== undefined) updateData.collectionDay2 = data.collectionDay2;
    if (data.createdAt !== undefined) updateData.createdAt = data.createdAt;
    if (data.installmentsCount !== undefined) updateData.installmentsCount = data.installmentsCount;
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.installmentAmount !== undefined) updateData.installmentAmount = data.installmentAmount;
    // initialPayment puede ser null para limpiar el campo
    if (data.initialPayment !== undefined) updateData.initialPayment = data.initialPayment;

    const sale = await prisma.sale.update({
      where: { id },
      data: updateData,
      include: SALE_WITH_ITEMS,
    });

    return mapToEntity(sale as unknown as Record<string, unknown>);
  }
}
