import { BulkProductsActiveDto } from '../../dtos/admin/bulk-products-active.dto';
import type { ProductRepository } from '../../repositories';

export class BulkSetProductsActiveUseCase {
  constructor(private readonly products: ProductRepository) {}

  async execute(dto: BulkProductsActiveDto): Promise<{ updated: number }> {
    const updated = await this.products.bulkSetActive(dto.productIds, dto.isActive);
    return { updated };
  }
}
