import { UpdateCustomerDto } from '../../dtos/customer-auth';
import { CustomError } from '../../errors';
import { CustomerRepository } from '../../repositories';
import { CustomerEntity } from '../../entities';

export class UpdateCustomerUseCase {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(
    customerId: string,
    dto: UpdateCustomerDto,
  ): Promise<ReturnType<CustomerEntity['toJSON']>> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw CustomError.notFound('Customer no encontrado');

    if (dto.email && dto.email !== customer.email) {
      const existing = await this.customerRepository.findByEmail(dto.email);
      if (existing) throw CustomError.conflict('El email ya está en uso');
    }

    const updated = await this.customerRepository.update(customerId, {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      isActive: dto.isActive,
    });

    return updated.toJSON();
  }
}
