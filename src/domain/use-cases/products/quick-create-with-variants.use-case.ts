import { QuickCreateWithVariantsDto } from '../../dtos/products/quick-create-with-variants.dto';
import type { ProductRepository } from '../../repositories';

export class QuickCreateWithVariantsUseCase {
  constructor(private readonly products: ProductRepository) {}

  async execute(dto: QuickCreateWithVariantsDto) {
    return this.products.quickCreateWithVariants({
      name: dto.name,
      description: dto.description,
      categoryName: dto.categoryName,
      attributes: dto.attributes,
      variants: dto.variants,
      weightKg: dto.weightKg,
      brand: dto.brand,
    });
  }
}
