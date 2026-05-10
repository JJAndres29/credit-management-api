import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { CustomError } from '../../domain/errors';
import {
  OnlineOrderDatasource,
  OnlineOrderCreateData,
  OnlineOrderFilters,
  WebhookData,
} from '../../domain/datasources/online-order.datasource';
import { OnlineOrderEntity } from '../../domain/entities/online-order.entity';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

const includeItems = {
  items: true,
  customer: { select: { id: true, name: true, email: true, phone: true } },
} as const;

function mapToEntity(raw: Record<string, unknown>): OnlineOrderEntity {
  return OnlineOrderEntity.fromObject(raw);
}

function buildWhere(filters: OnlineOrderFilters): Prisma.OnlineOrderWhereInput {
  return {
    ...(filters.status && { status: filters.status as Prisma.EnumOrderStatusFilter }),
    ...(filters.customerId && { customerId: filters.customerId }),
    ...((filters.dateFrom || filters.dateTo) && {
      createdAt: {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo }),
      },
    }),
  };
}

export class PrismaOnlineOrderDatasource implements OnlineOrderDatasource {
  /**
   * Single DB transaction: atomic stock reservation (per line) + order insert.
   * Eliminates phantom stock if the process crashes between reserve and persist.
   */
  async create(data: OnlineOrderCreateData): Promise<OnlineOrderEntity> {
    const order = await prisma.$transaction(async (tx) => {
      for (const item of data.items) {
        const dec = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
            isActive: true,
          },
          data: { stock: { decrement: item.quantity } },
        });
        if (dec.count === 0) {
          throw CustomError.conflict(
            `Stock insuficiente para el producto "${item.productNameSnapshot}"`,
          );
        }

        const decV = await tx.productVariant.updateMany({
          where: {
            id: item.variantId,
            productId: item.productId,
            stock: { gte: item.quantity },
          },
          data: { stock: { decrement: item.quantity } },
        });
        if (decV.count === 0) {
          throw CustomError.conflict(
            `Stock insuficiente en variante para "${item.productNameSnapshot}"`,
          );
        }
      }

      if (data.couponConsume) {
        const couponRow = await tx.coupon.findUnique({
          where: { id: data.couponConsume.couponId },
        });
        if (!couponRow || !couponRow.isActive) {
          throw CustomError.conflict('Cupón inválido');
        }
        if (data.customerId && couponRow.perCustomerLimit != null) {
          const usedByCustomer = await tx.couponRedemption.count({
            where: { couponId: couponRow.id, customerId: data.customerId },
          });
          if (usedByCustomer >= couponRow.perCustomerLimit) {
            throw CustomError.conflict('Ya usaste este cupón el máximo de veces permitido');
          }
        }
        const bumped = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          UPDATE "Coupon"
          SET "usedCount" = "usedCount" + 1
          WHERE "id" = ${data.couponConsume.couponId}
            AND "isActive" = true
            AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
          RETURNING "id"
        `);
        if (!bumped.length) {
          throw CustomError.conflict('El cupón ya no está disponible');
        }
      }

      const created = await tx.onlineOrder.create({
        data: {
          customerId: data.customerId,
          guestName: data.guestName,
          guestPhone: data.guestPhone,
          guestEmail: data.guestEmail,
          shippingAddress: data.shippingAddress,
          totalAmount: data.totalAmount,
          ...(data.subtotalAmount != null && { subtotalAmount: data.subtotalAmount }),
          ...(data.taxAmount != null && { taxAmount: data.taxAmount }),
          ...(data.shippingAmount != null && { shippingAmount: data.shippingAmount }),
          ...(data.discountAmount != null && { discountAmount: data.discountAmount }),
          currencyCode: data.currencyCode,
          paymentMethod: data.paymentMethod as never,
          expiresAt: data.expiresAt,
          ipAddress: data.ipAddress ?? undefined,
          userAgent: data.userAgent ?? undefined,
          deviceFingerprintHash: data.deviceFingerprintHash ?? undefined,
          shippingZoneCode: data.shippingZoneCode ?? undefined,
          riskScore: data.riskScore ?? undefined,
          riskTier: data.riskTier ?? undefined,
          couponCodeSnapshot: data.couponCodeSnapshot ?? undefined,
          customerAddressId: data.customerAddressId ?? undefined,
          shippingRecipientName: data.shippingRecipientName ?? undefined,
          shippingRecipientDocumentType: data.shippingRecipientDocumentType ?? undefined,
          shippingRecipientDocumentNumber: data.shippingRecipientDocumentNumber ?? undefined,
          shippingLine1: data.shippingLine1 ?? undefined,
          shippingLine2: data.shippingLine2 ?? undefined,
          shippingCity: data.shippingCity ?? undefined,
          shippingDepartment: data.shippingDepartment ?? undefined,
          shippingPostalCode: data.shippingPostalCode ?? undefined,
          shippingRecipientPhone: data.shippingRecipientPhone ?? undefined,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              productNameSnapshot: item.productNameSnapshot,
            })),
          },
        },
        include: includeItems,
      });

      await tx.orderEvent.create({
        data: {
          orderId: created.id,
          toStatus: 'PENDING_PAYMENT',
          actor: 'checkout',
        },
      });

      for (const item of data.items) {
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            variantId: item.variantId,
            movementType: 'SALE_ONLINE_RESERVE',
            quantityDelta: -item.quantity,
            refOrderId: created.id,
          },
        });
      }

      if (data.couponConsume) {
        await tx.couponRedemption.create({
          data: {
            couponId: data.couponConsume.couponId,
            orderId: created.id,
            customerId: data.customerId,
            discountApplied: data.couponConsume.discountApplied,
          },
        });
      }

      return created;
    });

    return mapToEntity(order as unknown as Record<string, unknown>);
  }

  async findById(id: string): Promise<OnlineOrderEntity | null> {
    const order = await prisma.onlineOrder.findUnique({
      where: { id },
      include: includeItems,
    });
    if (!order) return null;
    return mapToEntity(order as unknown as Record<string, unknown>);
  }

  async findByOrderNumberAndEmail(orderNumber: number, email: string): Promise<OnlineOrderEntity | null> {
    const order = await prisma.onlineOrder.findFirst({
      where: {
        orderNumber,
        guestEmail: { equals: email, mode: 'insensitive' },
      },
      include: includeItems,
    });
    if (!order) return null;
    return mapToEntity(order as unknown as Record<string, unknown>);
  }

  async findAll(
    pagination: PaginationDto,
    filters: OnlineOrderFilters,
  ): Promise<PaginatedResult<OnlineOrderEntity>> {
    const where = buildWhere(filters);

    const [orders, total] = await Promise.all([
      prisma.onlineOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: includeItems,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.onlineOrder.count({ where }),
    ]);

    return {
      data: orders.map((o) => mapToEntity(o as unknown as Record<string, unknown>)),
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

  async updatePaymentLink(
    id: string,
    paymentUrl: string,
    gatewayReference: string,
  ): Promise<OnlineOrderEntity> {
    const order = await prisma.onlineOrder.update({
      where: { id },
      data: { paymentUrl, paymentGatewayReference: gatewayReference },
      include: includeItems,
    });
    return mapToEntity(order as unknown as Record<string, unknown>);
  }

  async markAsPaid(id: string, _webhookData: WebhookData): Promise<OnlineOrderEntity> {
    const order = await prisma.$transaction(async (tx) => {
      const cur = await tx.onlineOrder.findUnique({ where: { id } });
      if (!cur) throw new Error(`OnlineOrder ${id} no encontrada`);

      const updated = await tx.onlineOrder.update({
        where: { id },
        data: { status: 'PAID', paidAt: new Date() },
        include: includeItems,
      });

      await tx.orderEvent.create({
        data: {
          orderId: id,
          fromStatus: cur.status,
          toStatus: 'PAID',
          actor: 'payment_webhook',
        },
      });

      return updated;
    });
    return mapToEntity(order as unknown as Record<string, unknown>);
  }

  async markAsCancelled(id: string, _webhookData: WebhookData): Promise<OnlineOrderEntity> {
    const order = await prisma.$transaction(async (tx) => {
      const cur = await tx.onlineOrder.findUnique({ where: { id } });
      if (!cur) throw new Error(`OnlineOrder ${id} no encontrada`);

      const updated = await tx.onlineOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: includeItems,
      });

      await tx.orderEvent.create({
        data: {
          orderId: id,
          fromStatus: cur.status,
          toStatus: 'CANCELLED',
          actor: 'payment_webhook',
        },
      });

      return updated;
    });
    return mapToEntity(order as unknown as Record<string, unknown>);
  }

  async webhookExists(provider: string, eventId: string): Promise<boolean> {
    const found = await prisma.processedWebhook.findUnique({
      where: { provider_eventId: { provider, eventId } },
    });
    return found !== null;
  }

  async tryClaimProcessedWebhook(data: WebhookData): Promise<boolean> {
    const result = await prisma.processedWebhook.createMany({
      data: [{ provider: data.provider, eventId: data.eventId }],
      skipDuplicates: true,
    });
    return result.count > 0;
  }

  async releaseProcessedWebhookClaim(data: WebhookData): Promise<void> {
    await prisma.processedWebhook.deleteMany({
      where: { provider: data.provider, eventId: data.eventId },
    });
  }

  async saveProcessedWebhook(data: WebhookData): Promise<void> {
    await prisma.processedWebhook.create({
      data: { provider: data.provider, eventId: data.eventId },
    });
  }

  async updateStatus(id: string, status: string): Promise<OnlineOrderEntity> {
    const order = await prisma.$transaction(async (tx) => {
      const cur = await tx.onlineOrder.findUnique({ where: { id } });
      if (!cur) throw new Error(`OnlineOrder ${id} no encontrada`);

      const updated = await tx.onlineOrder.update({
        where: { id },
        data: { status: status as never },
        include: includeItems,
      });

      await tx.orderEvent.create({
        data: {
          orderId: id,
          fromStatus: cur.status,
          toStatus: status as never,
          actor: 'staff_api',
        },
      });

      return updated;
    });
    return mapToEntity(order as unknown as Record<string, unknown>);
  }

  async tryCancelOrExpirePending(
    id: string,
    newStatus: 'CANCELLED' | 'EXPIRED',
  ): Promise<OnlineOrderEntity | null> {
    const order = await prisma.$transaction(async (tx) => {
      const result = await tx.onlineOrder.updateMany({
        where: { id, status: 'PENDING_PAYMENT' },
        data: { status: newStatus as never },
      });
      if (result.count === 0) return null;

      const o = await tx.onlineOrder.findUnique({
        where: { id },
        include: includeItems,
      });
      if (!o) return null;

      await tx.orderEvent.create({
        data: {
          orderId: id,
          fromStatus: 'PENDING_PAYMENT',
          toStatus: newStatus as never,
          actor: 'expiry_or_admin',
        },
      });

      return o;
    });

    if (!order) return null;
    return mapToEntity(order as unknown as Record<string, unknown>);
  }

  async markStockRestored(id: string): Promise<void> {
    // Idempotent: only sets the marker the first time. Repeated calls are no-ops.
    await prisma.onlineOrder.updateMany({
      where: { id, stockRestoredAt: null },
      data: { stockRestoredAt: new Date() },
    });
  }

  async findExpiredPending(now: Date, limit: number = 100): Promise<OnlineOrderEntity[]> {
    const orders = await prisma.onlineOrder.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        expiresAt: { lte: now },
      },
      include: includeItems,
      take: limit,
      orderBy: { expiresAt: 'asc' },
    });
    return orders.map((o) => mapToEntity(o as unknown as Record<string, unknown>));
  }
}
