import { randomBytes } from 'crypto';
import bcryptjs from 'bcryptjs';
import { CustomError } from '../../errors';
import { CustomerRepository } from '../../repositories';
import { EventEmitterPort } from '../../events';
import { CUSTOMER_PASSWORD_RESET } from '../../events/customer-password-reset.event';

function generateTempPassword(): string {
  const hex = randomBytes(4).toString('hex'); // 8 lowercase hex chars (0-9, a-f)
  const num = (randomBytes(1)[0] % 9) + 1;   // digit 1-9
  return `Tmp${hex}${num}!`;                  // e.g. "Tmp3a8f2c1b4!" — always passes strongPassword
}

export class ResetCustomerPasswordUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly eventEmitter?: EventEmitterPort,
  ) {}

  async execute(customerId: string): Promise<void> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw CustomError.notFound('Customer no encontrado');

    const tempPassword = generateTempPassword();
    const hashed = bcryptjs.hashSync(tempPassword, 10);

    await this.customerRepository.update(customerId, { password: hashed, mustChangePassword: true });

    this.eventEmitter?.emit(CUSTOMER_PASSWORD_RESET, {
      customerId: customer.id,
      customerEmail: customer.email,
      customerName: customer.name,
      tempPassword,
    });
  }
}
