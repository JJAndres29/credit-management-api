import { randomBytes } from 'crypto';
import bcryptjs from 'bcryptjs';
import { CustomerRepository } from '../../repositories';
import { EventEmitterPort } from '../../events';
import { CUSTOMER_PASSWORD_RESET } from '../../events/customer-password-reset.event';

function generateTempPassword(): string {
  const hex = randomBytes(4).toString('hex');
  const num = (randomBytes(1)[0] % 9) + 1;
  return `Tmp${hex}${num}!`;
}

export class ForgotCustomerPasswordUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly eventEmitter?: EventEmitterPort,
  ) {}

  // Anti-enumeration: siempre retorna sin revelar si el email existe
  async execute(email: string): Promise<void> {
    const customer = await this.customerRepository.findByEmail(email);
    if (!customer || !customer.isActive) return;

    const tempPassword = generateTempPassword();
    const hashed = bcryptjs.hashSync(tempPassword, 10);

    await this.customerRepository.update(customer.id, { password: hashed, mustChangePassword: true });

    this.eventEmitter?.emit(CUSTOMER_PASSWORD_RESET, {
      customerId: customer.id,
      customerEmail: customer.email,
      customerName: customer.name,
      tempPassword,
    });
  }
}
