import { CustomerAddressRepository } from '../../repositories/customer-address.repository';
import { CreateCustomerAddressDto } from '../../dtos/customer-auth/create-customer-address.dto';

export class CreateCustomerAddressUseCase {
  constructor(private readonly addresses: CustomerAddressRepository) {}

  execute(customerId: string, dto: CreateCustomerAddressDto) {
    return this.addresses.create(customerId, {
      label: dto.label,
      line1: dto.line1,
      line2: dto.line2,
      city: dto.city,
      department: dto.department,
      postalCode: dto.postalCode,
      phone: dto.phone,
      isDefault: dto.isDefault,
    });
  }
}
