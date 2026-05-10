import { CustomerAddressRepository } from '../../repositories/customer-address.repository';

export class DeleteCustomerAddressUseCase {
  constructor(private readonly addresses: CustomerAddressRepository) {}

  execute(customerId: string, addressId: string): Promise<void> {
    return this.addresses.delete(customerId, addressId);
  }
}
