import { prisma } from '../../config/prisma';
import { SaleDatasource, SaleCreateData } from '../../domain/datasources/sale.datasource';
import { SaleEntity, SaleType, SaleStatus } from '../../domain/entities';

// Inclusión de ítems en todas las consultas de venta
const SALE_WITH_ITEMS = {
  items: true,
} as const;

function mapToEntity(sale: Record<string, unknown>): SaleEntity {
  return SaleEntity.fromObject(sale);
}

export class PrismaSaleDatasource implements SaleDatasource {
  async findAll(): Promise<SaleEntity[]> {
    const sales = await prisma.sale.findMany({
      include: SALE_WITH_ITEMS,
      orderBy: { createdAt: 'desc' },
    });

    return sales.map((sale) => mapToEntity(sale as unknown as Record<string, unknown>));
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

      // 3. Crear la venta con sus ítems
      const created = await tx.sale.create({
        data: {
          clientId: data.clientId,
          type: data.type,
          // Venta en efectivo queda PAID de inmediato; crédito queda PENDING
          status: isCashSale ? SaleStatus.PAID : SaleStatus.PENDING,
          total: data.total,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
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
