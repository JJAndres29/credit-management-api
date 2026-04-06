import { prisma } from '../../config/prisma';
import { ClientDatasource } from '../../domain/datasources';
import { ClientEntity } from '../../domain/entities';
import { CreateClientDto, UpdateClientDto } from '../../domain/dtos/clients';

export class PrismaClientDatasource implements ClientDatasource {
  async findAll(): Promise<ClientEntity[]> {
    const clients = await prisma.client.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return clients.map((client) => ClientEntity.fromObject(client as unknown as Record<string, unknown>));
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
