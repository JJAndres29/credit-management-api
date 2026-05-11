import { CreatePriceExperimentDto } from '../../dtos/marketing';
import { CustomError } from '../../errors';
import type { ProductRepository } from '../../repositories';
import type { MarketingToolsRepository } from '../../repositories/marketing.repository';

export class CreatePriceExperimentUseCase {
  constructor(
    private readonly marketing: MarketingToolsRepository,
    private readonly products: ProductRepository,
  ) {}

  async execute(dto: CreatePriceExperimentDto) {
    const p = await this.products.findById(dto.productId);
    if (!p) throw CustomError.notFound('Producto no encontrado');
    return this.marketing.createPriceExperiment({
      productId: dto.productId,
      name: dto.name,
      cohortKey: dto.cohortKey,
      priceA: dto.priceA,
      priceB: dto.priceB,
      startAt: dto.startAt,
      endAt: dto.endAt,
      winnerCriteria: dto.winnerCriteria,
    });
  }
}
