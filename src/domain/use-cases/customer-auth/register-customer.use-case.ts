import bcryptjs from 'bcryptjs';
import { RegisterCustomerDto } from '../../dtos/customer-auth';
import { CustomError } from '../../errors';
import { CustomerRepository } from '../../repositories';
import { CustomerJwtService } from '../../services';

interface CustomerAuthResponse {
  token: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    mustChangePassword: boolean;
  };
}

export class RegisterCustomerUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly jwtService: CustomerJwtService,
  ) {}

  async execute(dto: RegisterCustomerDto): Promise<CustomerAuthResponse> {
    const existing = await this.customerRepository.findByEmail(dto.email);
    if (existing) {
      if (existing.googleId && !existing.password) {
        throw CustomError.conflict('El email ya está registrado mediante Google. Inicia sesión con Google o recupera tu contraseña.');
      }
      throw CustomError.conflict('El email ya está registrado');
    }

    const hashedPassword = bcryptjs.hashSync(dto.password, 10);
    const customer = await this.customerRepository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      phone: dto.phone,
    });

    const token = await this.jwtService.generateToken({ id: customer.id });

    return {
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        mustChangePassword: customer.mustChangePassword,
      },
    };
  }
}
