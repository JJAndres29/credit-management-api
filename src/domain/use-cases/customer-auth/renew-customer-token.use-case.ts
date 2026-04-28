import { CustomError } from '../../errors';
import { CustomerRepository } from '../../repositories';
import { CustomerJwtService } from '../../services';

export class RenewCustomerTokenUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly jwtService: CustomerJwtService,
  ) {}

  async execute(customerId: string) {
    const customer = await this.customerRepository.findById(customerId);

    if (!customer || !customer.isActive) {
      throw CustomError.unauthorized('Cliente no encontrado o inactivo');
    }

    const token = await this.jwtService.generateToken({ id: customer.id });

    return { token, customer: customer.toJSON() };
  }
}
