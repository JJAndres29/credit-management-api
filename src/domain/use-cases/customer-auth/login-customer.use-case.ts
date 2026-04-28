import bcryptjs from 'bcryptjs';
import { LoginCustomerDto } from '../../dtos/customer-auth';
import { CustomError } from '../../errors';
import { CustomerRepository } from '../../repositories';
import { CustomerJwtService } from '../../services';

export class LoginCustomerUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly jwtService: CustomerJwtService,
  ) {}

  async execute(dto: LoginCustomerDto) {
    const customer = await this.customerRepository.findByEmail(dto.email);

    // Anti-enumeration: mismo mensaje para email inexistente, inactivo o password incorrecto
    if (!customer || !customer.isActive) {
      throw CustomError.unauthorized('Credenciales inválidas');
    }

    if (!customer.password) {
      throw CustomError.unauthorized('Credenciales inválidas'); // User has only Google auth
    }

    const passwordMatch = bcryptjs.compareSync(dto.password, customer.password);
    if (!passwordMatch) {
      throw CustomError.unauthorized('Credenciales inválidas');
    }

    const token = await this.jwtService.generateToken({ id: customer.id });

    return { token, customer: customer.toJSON() };
  }
}
