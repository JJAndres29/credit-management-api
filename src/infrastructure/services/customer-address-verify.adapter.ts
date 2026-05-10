import { prisma } from '../../config/prisma';
import { CustomError } from '../../domain/errors';
import { CustomerAddressVerifyPort } from '../../domain/services/customer-address-verify.port';

export class PrismaCustomerAddressVerifyAdapter implements CustomerAddressVerifyPort {
  async assertOwnedAndCarrierReadyForCheckout(addressId: string, customerId: string): Promise<void> {
    const row = await prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
      select: { id: true, postalCode: true, phone: true },
    });
    if (!row) throw CustomError.notFound('Dirección no encontrada');
    if (!row.postalCode?.trim()) {
      throw CustomError.badRequest(
        'La dirección guardada debe tener código postal. Actualízala en tu cuenta antes de pagar.',
      );
    }
    if (!row.phone?.trim()) {
      throw CustomError.badRequest(
        'La dirección guardada debe tener teléfono de contacto. Actualízala en tu cuenta antes de pagar.',
      );
    }
  }
}
