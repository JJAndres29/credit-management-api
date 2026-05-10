import { CustomerAddressRepository } from '../../repositories/customer-address.repository';

export class SetDefaultCustomerAddressUseCase {
  constructor(private readonly addresses: CustomerAddressRepository) {}

  execute(customerId: string, addressId: string) {
    return this.addresses.setDefault(customerId, addressId);
  }
}
