import { CustomError } from '../../errors';
import { PaymentEntity } from '../../entities';
import { PaymentRepository } from '../../repositories';

export class GetPaymentByIdUseCase {
  constructor(private readonly paymentRepository: PaymentRepository) {}

  async execute(id: string): Promise<PaymentEntity> {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) throw CustomError.notFound(`Pago con ID ${id} no encontrado`);
    return payment;
  }
}
