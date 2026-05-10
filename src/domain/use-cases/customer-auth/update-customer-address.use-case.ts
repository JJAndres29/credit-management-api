import { CustomerAddressRepository } from '../../repositories/customer-address.repository';
import { UpdateCustomerAddressDto } from '../../dtos/customer-auth/update-customer-address.dto';

export class UpdateCustomerAddressUseCase {
  constructor(private readonly addresses: CustomerAddressRepository) {}

  execute(customerId: string, addressId: string, dto: UpdateCustomerAddressDto) {
    return this.addresses.update(customerId, addressId, dto.patch);
  }
}
