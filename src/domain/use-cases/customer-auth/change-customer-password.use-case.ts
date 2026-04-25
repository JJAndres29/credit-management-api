import bcryptjs from 'bcryptjs';
import { ChangePasswordDto } from '../../dtos/customer-auth';
import { CustomError } from '../../errors';
import { CustomerRepository } from '../../repositories';

export class ChangeCustomerPasswordUseCase {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(customerId: string, dto: ChangePasswordDto): Promise<void> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer || !customer.isActive) throw CustomError.unauthorized('No autorizado');

    if (!customer.password) {
      throw CustomError.unauthorized('No autorizado. Usa la opción de recuperación de contraseña.');
    }

    const passwordMatch = bcryptjs.compareSync(dto.currentPassword, customer.password);
    if (!passwordMatch) throw CustomError.unauthorized('Contraseña actual incorrecta');

    const hashed = bcryptjs.hashSync(dto.newPassword, 10);
    await this.customerRepository.update(customerId, { password: hashed, mustChangePassword: false });
  }
}
