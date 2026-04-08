import { CustomError } from '../../errors';
import { PaymentEntity } from '../../entities';
import { PaymentRepository } from '../../repositories';
import { SaleRepository } from '../../repositories';

export class GetPaymentsBySaleUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly saleRepository: SaleRepository,
  ) {}

  async execute(saleId: string): Promise<PaymentEntity[]> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) throw CustomError.notFound(`Venta con ID ${saleId} no encontrada`);

    return this.paymentRepository.findBySaleId(saleId);
  }
}
