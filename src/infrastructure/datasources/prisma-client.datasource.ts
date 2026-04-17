import { prisma } from '../../config/prisma';
import { ClientDatasource } from '../../domain/datasources';
import { ClientEntity } from '../../domain/entities';
import { CreateClientDto, UpdateClientDto, FilterClientsDto } from '../../domain/dtos/clients';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

function buildWhere(filters: FilterClientsDto) {
  return {
    isActive: true,
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' as const } },
        { documentNumber: { contains: filters.search } },
        { phone: { contains: filters.search } },
        { email: { contains: filters.search, mode: 'insensitive' as const } },
      ],
    }),
    ...(filters.minBalance !== undefined && {
      balance: { gte: filters.minBalance },
    }),
    ...(filters.maxBalance !== undefined && {
      balance: { lte: filters.maxBalance },
    }),
    ...(filters.minBalance !== undefined && filters.maxBalance !== undefined && {
      balance: { gte: filters.minBalance, lte: filters.maxBalance },
    }),
    ...(filters.hasDebt === true && { balance: { gt: 0 } }),
    ...(filters.hasDebt === false && { balance: 0 }),
  };
}

export class PrismaClientDatasource implements ClientDatasource {
  async findAll(pagination: PaginationDto, filters: FilterClientsDto): Promise<PaginatedResult<ClientEntity>> {
    const where = buildWhere(filters);

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.client.count({ where }),
    ]);

    return {
      data: clients.map((c) => ClientEntity.fromObject(c as unknown as Record<string, unknown>)),
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

  async findById(id: string): Promise<ClientEntity | null> {
    const client = await prisma.client.findFirst({
      where: { id, isActive: true },
    });

    if (!client) return null;

    return ClientEntity.fromObject(client as unknown as Record<string, unknown>);
  }

  async findByEmail(email: string): Promise<ClientEntity | null> {
    const client = await prisma.client.findFirst({
      where: { email, isActive: true },
    });

    if (!client) return null;

    return ClientEntity.fromObject(client as unknown as Record<string, unknown>);
  }

  async create(dto: CreateClientDto): Promise<ClientEntity> {
    const client = await prisma.client.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        address: dto.address,
        neighborhood: dto.neighborhood,
        creditLimit: dto.creditLimit,
      },
    });

    return ClientEntity.fromObject(client as unknown as Record<string, unknown>);
  }

  async update(id: string, dto: UpdateClientDto): Promise<ClientEntity> {
    const client = await prisma.client.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        address: dto.address,
        neighborhood: dto.neighborhood,
        creditLimit: dto.creditLimit,
      },
    });

    return ClientEntity.fromObject(client as unknown as Record<string, unknown>);
  }

  async delete(id: string): Promise<ClientEntity> {
    const client = await prisma.client.update({
      where: { id },
      data: { isActive: false },
    });

    return ClientEntity.fromObject(client as unknown as Record<string, unknown>);
  }
}
