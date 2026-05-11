import { QuickCreateProductDto } from '../../dtos/products';
import type { ProductRepository } from '../../repositories';

export class QuickCreateProductUseCase {
  constructor(private readonly products: ProductRepository) {}

  async execute(dto: QuickCreateProductDto) {
    return this.products.quickCreate({
      name: dto.name,
      description: dto.description,
      stock: dto.stock,
      retailPrice: dto.retailPrice,
      investmentCost: dto.investmentCost,
      categoryName: dto.categoryName,
      attributes: dto.attributes,
      weightKg: dto.weightKg,
      brand: dto.brand,
    });
  }
}
