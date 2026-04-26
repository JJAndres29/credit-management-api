import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { OnlineOrderDatasource, OnlineOrderCreateData, OnlineOrderFilters } from '../../domain/datasources/online-order.datasource';
import { OnlineOrderEntity } from '../../domain/entities/online-order.entity';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

const includeItems = { items: true } as const;

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
  async create(data: OnlineOrderCreateData): Promise<OnlineOrderEntity> {
    const order = await prisma.onlineOrder.create({
      data: {
        customerId: data.customerId,
        guestName: data.guestName,
        guestPhone: data.guestPhone,
        guestEmail: data.guestEmail,
        shippingAddress: data.shippingAddress,
        totalAmount: data.totalAmount,
        paymentMethod: data.paymentMethod as never,
        expiresAt: data.expiresAt,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            productNameSnapshot: item.productNameSnapshot,
          })),
        },
      },
      include: includeItems,
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
}
