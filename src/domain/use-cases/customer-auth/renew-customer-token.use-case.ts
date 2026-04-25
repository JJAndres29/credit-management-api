import { CustomError } from '../../errors';
import { CustomerRepository } from '../../repositories';
import { CustomerJwtService } from '../../services';

interface RenewCustomerTokenResponse {
  token: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

export class RenewCustomerTokenUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly jwtService: CustomerJwtService,
  ) {}

  async execute(customerId: string): Promise<RenewCustomerTokenResponse> {
    const customer = await this.customerRepository.findById(customerId);

    if (!customer || !customer.isActive) {
      throw CustomError.unauthorized('Cliente no encontrado o inactivo');
    }

    const token = await this.jwtService.generateToken({ id: customer.id });

    return {
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
    };
  }
}
