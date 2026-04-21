import { CustomError } from '../../errors';
import { SaleEntity, InstallmentFrequency } from '../../entities';
import { UpdateSaleDto } from '../../dtos/sales';
import { SaleRepository } from '../../repositories';

export class UpdateSaleUseCase {
  constructor(private readonly saleRepository: SaleRepository) {}

  async execute(id: string, dto: UpdateSaleDto): Promise<SaleEntity> {
    const sale = await this.saleRepository.findById(id);
    if (!sale) throw CustomError.notFound(`Venta con ID ${id} no encontrada`);

    // collectionDay2 solo es válido para ventas con plan BIWEEKLY
    if (dto.collectionDay2 !== undefined && dto.collectionDay2 !== null) {
      if (sale.frequency !== InstallmentFrequency.BIWEEKLY) {
        throw CustomError.badRequest(
          'collectionDay2 solo aplica a ventas con frecuencia de cobro BIWEEKLY',
        );
      }
    }

    return await this.saleRepository.update(id, {
      collectionDay: dto.collectionDay,
      collectionDay2: dto.collectionDay2,
      createdAt: dto.createdAt,
    });
  }
}
