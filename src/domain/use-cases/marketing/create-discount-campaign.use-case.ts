import { CreateDiscountCampaignDto } from '../../dtos/marketing';
import { CustomError } from '../../errors';
import type { CategoryRepository } from '../../repositories';
import type { MarketingToolsRepository } from '../../repositories/marketing.repository';

export class CreateDiscountCampaignUseCase {
  constructor(
    private readonly marketing: MarketingToolsRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(dto: CreateDiscountCampaignDto) {
    if (dto.categoryId) {
      const cat = await this.categories.findById(dto.categoryId);
      if (!cat) throw CustomError.notFound('Categoría no encontrada');
    }
    return this.marketing.createDiscountCampaign({
      name: dto.name,
      categoryId: dto.categoryId,
      percentOff: dto.percentOff,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
    });
  }
}
