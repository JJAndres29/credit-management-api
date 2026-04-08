import { CustomError } from '../../errors';
import { PaymentEntity } from '../../entities';
import { PaymentRepository } from '../../repositories';
import { ClientRepository } from '../../repositories';

export class GetPaymentsByClientUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly clientRepository: ClientRepository,
  ) {}

  async execute(clientId: string): Promise<PaymentEntity[]> {
    const client = await this.clientRepository.findById(clientId);
    if (!client) throw CustomError.notFound(`Cliente con ID ${clientId} no encontrado`);

    return this.paymentRepository.findByClientId(clientId);
  }
}
