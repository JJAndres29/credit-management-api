import { SaleEntity } from '../../entities';
import { SaleRepository } from '../../repositories';

export class GetSalesUseCase {
  constructor(private readonly saleRepository: SaleRepository) {}

  execute(): Promise<SaleEntity[]> {
    return this.saleRepository.findAll();
  }
}
