import { CustomError } from '../../errors';
import { SaleEntity } from '../../entities';
import { SaleRepository } from '../../repositories';

export class GetSaleByIdUseCase {
  constructor(private readonly saleRepository: SaleRepository) {}

  async execute(id: string): Promise<SaleEntity> {
    const sale = await this.saleRepository.findById(id);
    if (!sale) throw CustomError.notFound(`Venta con ID ${id} no encontrada`);
    return sale;
  }
}
