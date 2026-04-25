import bcryptjs from 'bcryptjs';
import { LoginCustomerDto } from '../../dtos/customer-auth';
import { CustomError } from '../../errors';
import { CustomerRepository } from '../../repositories';
import { CustomerJwtService } from '../../services';

interface LoginCustomerResponse {
  token: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

export class LoginCustomerUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly jwtService: CustomerJwtService,
  ) {}

  async execute(dto: LoginCustomerDto): Promise<LoginCustomerResponse> {
    const customer = await this.customerRepository.findByEmail(dto.email);

    // Anti-enumeration: mismo mensaje para email inexistente, inactivo o password incorrecto
    if (!customer || !customer.isActive) {
      throw CustomError.unauthorized('Credenciales inválidas');
    }

    const passwordMatch = bcryptjs.compareSync(dto.password, customer.password);
    if (!passwordMatch) {
      throw CustomError.unauthorized('Credenciales inválidas');
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
