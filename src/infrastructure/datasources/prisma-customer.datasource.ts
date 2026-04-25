import { prisma } from '../../config/prisma';
import {
  CustomerDatasource,
  CustomerCreateData,
  CustomerUpdateData,
  FilterCustomersData,
} from '../../domain/datasources';
import { CustomerEntity } from '../../domain/entities';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

function mapToEntity(raw: Record<string, unknown>): CustomerEntity {
  return CustomerEntity.fromObject(raw);
}

function buildWhere(filters: FilterCustomersData) {
  return {
    ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' as const } },
        { email: { contains: filters.search, mode: 'insensitive' as const } },
        { phone: { contains: filters.search } },
      ],
    }),
  };
}

export class PrismaCustomerDatasource implements CustomerDatasource {
  async findAll(pagination: PaginationDto, filters: FilterCustomersData): Promise<PaginatedResult<CustomerEntity>> {
    const where = buildWhere(filters);
    const [rows, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.customer.count({ where }),
    ]);
    return {
      data: rows.map((r) => mapToEntity(r as unknown as Record<string, unknown>)),
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

  async findByEmail(email: string): Promise<CustomerEntity | null> {
    const row = await prisma.customer.findUnique({ where: { email } });
    if (!row) return null;
    return mapToEntity(row as unknown as Record<string, unknown>);
  }

  async findById(id: string): Promise<CustomerEntity | null> {
    const row = await prisma.customer.findUnique({ where: { id } });
    if (!row) return null;
    return mapToEntity(row as unknown as Record<string, unknown>);
  }

  async findByGoogleId(googleId: string): Promise<CustomerEntity | null> {
    const row = await prisma.customer.findUnique({ where: { googleId } });
    if (!row) return null;
    return mapToEntity(row as unknown as Record<string, unknown>);
  }

  async findByClientId(clientId: string): Promise<CustomerEntity | null> {
    const row = await prisma.customer.findUnique({ where: { clientId } });
    if (!row) return null;
    return mapToEntity(row as unknown as Record<string, unknown>);
  }

  async create(data: CustomerCreateData): Promise<CustomerEntity> {
    const row = await prisma.customer.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password ?? null,
        googleId: data.googleId ?? null,
      },
    });
    return mapToEntity(row as unknown as Record<string, unknown>);
  }

  async update(id: string, data: CustomerUpdateData): Promise<CustomerEntity> {
    const row = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.password !== undefined && { password: data.password }),
        ...(data.mustChangePassword !== undefined && { mustChangePassword: data.mustChangePassword }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
    return mapToEntity(row as unknown as Record<string, unknown>);
  }

  async linkToClient(customerId: string, clientId: string): Promise<CustomerEntity> {
    const row = await prisma.customer.update({
      where: { id: customerId },
      data: { clientId },
    });
    return mapToEntity(row as unknown as Record<string, unknown>);
  }
}
