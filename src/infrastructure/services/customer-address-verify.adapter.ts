import { prisma } from '../../config/prisma';
import { CustomError } from '../../domain/errors';
import { CustomerAddressVerifyPort } from '../../domain/services/customer-address-verify.port';

export class PrismaCustomerAddressVerifyAdapter implements CustomerAddressVerifyPort {
  async assertOwnedByCustomer(addressId: string, customerId: string): Promise<void> {
    const row = await prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
      select: { id: true },
    });
    if (!row) throw CustomError.notFound('Dirección no encontrada');
  }
}
