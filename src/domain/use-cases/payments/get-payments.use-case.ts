import { PaymentEntity } from '../../entities';
import { PaymentRepository } from '../../repositories';

export class GetPaymentsUseCase {
  constructor(private readonly paymentRepository: PaymentRepository) {}

  async execute(): Promise<PaymentEntity[]> {
    return this.paymentRepository.findAll();
  }
}
