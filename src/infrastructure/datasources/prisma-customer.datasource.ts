import { prisma } from '../../config/prisma';
import { CustomerDatasource, CustomerCreateData } from '../../domain/datasources';
import { CustomerEntity } from '../../domain/entities';

function mapToEntity(raw: Record<string, unknown>): CustomerEntity {
  return CustomerEntity.fromObject(raw);
}

export class PrismaCustomerDatasource implements CustomerDatasource {
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

  async create(data: CustomerCreateData): Promise<CustomerEntity> {
    const row = await prisma.customer.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
      },
    });
    return mapToEntity(row as unknown as Record<string, unknown>);
  }
}
