import { CustomerAddressRepository } from '../../repositories/customer-address.repository';

export class ListCustomerAddressesUseCase {
  constructor(private readonly addresses: CustomerAddressRepository) {}

  execute(customerId: string) {
    return this.addresses.findAllByCustomer(customerId);
  }
}
