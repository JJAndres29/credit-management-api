import { prisma } from '../../config/prisma';
import { CustomError } from '../../domain/errors';
import {
  CustomerAddressDatasource,
  CustomerAddressRow,
  CustomerAddressCreateData,
  CustomerAddressUpdateData,
} from '../../domain/datasources/customer-address.datasource';

function map(row: {
  id: string;
  customerId: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  department: string;
  countryCode: string;
  postalCode: string | null;
  phone: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CustomerAddressRow {
  return { ...row };
}

export class PrismaCustomerAddressDatasource implements CustomerAddressDatasource {
  async findAllByCustomer(customerId: string): Promise<CustomerAddressRow[]> {
    const rows = await prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return rows.map(map);
  }

  async create(customerId: string, data: CustomerAddressCreateData): Promise<CustomerAddressRow> {
    const country = (data.countryCode ?? 'CO').trim().toUpperCase();
    if (country !== 'CO') {
      throw CustomError.badRequest('Por ahora solo se admite countryCode CO');
    }

    const row = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }
      const created = await tx.customerAddress.create({
        data: {
          customerId,
          label: data.label ?? null,
          line1: data.line1,
          line2: data.line2 ?? null,
          city: data.city,
          department: data.department,
          countryCode: country,
          postalCode: data.postalCode ?? null,
          phone: data.phone ?? null,
          isDefault: data.isDefault ?? false,
        },
      });
      return created;
    });

    return map(row);
  }

  async update(
    customerId: string,
    addressId: string,
    updates: CustomerAddressUpdateData,
  ): Promise<CustomerAddressRow> {
    const row = await prisma.$transaction(async (tx) => {
      const addr = await tx.customerAddress.findFirst({
        where: { id: addressId, customerId },
      });
      if (!addr) throw CustomError.notFound('Dirección no encontrada');

      if (updates.countryCode !== undefined) {
        const country = updates.countryCode.trim().toUpperCase();
        if (country !== 'CO') {
          throw CustomError.badRequest('Por ahora solo se admite countryCode CO');
        }
      }

      if (updates.isDefault === true) {
        await tx.customerAddress.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }

      const data: Record<string, unknown> = {};
      if (updates.label !== undefined) data.label = updates.label;
      if (updates.line1 !== undefined) data.line1 = updates.line1;
      if (updates.line2 !== undefined) data.line2 = updates.line2;
      if (updates.city !== undefined) data.city = updates.city;
      if (updates.department !== undefined) data.department = updates.department;
      if (updates.postalCode !== undefined) data.postalCode = updates.postalCode;
      if (updates.phone !== undefined) data.phone = updates.phone;
      if (updates.countryCode !== undefined) {
        data.countryCode = updates.countryCode.trim().toUpperCase();
      }
      if (updates.isDefault !== undefined) data.isDefault = updates.isDefault;

      return tx.customerAddress.update({
        where: { id: addressId },
        data: data as never,
      });
    });

    return map(row);
  }

  async delete(customerId: string, addressId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const addr = await tx.customerAddress.findFirst({
        where: { id: addressId, customerId },
      });
      if (!addr) throw CustomError.notFound('Dirección no encontrada');

      const wasDefault = addr.isDefault;

      await tx.customerAddress.delete({ where: { id: addressId } });

      if (wasDefault) {
        const next = await tx.customerAddress.findFirst({
          where: { customerId },
          orderBy: { updatedAt: 'desc' },
        });
        if (next) {
          await tx.customerAddress.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });
  }

  async setDefault(customerId: string, addressId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const addr = await tx.customerAddress.findFirst({
        where: { id: addressId, customerId },
      });
      if (!addr) throw CustomError.notFound('Dirección no encontrada');

      await tx.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
      await tx.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });
  }
}
