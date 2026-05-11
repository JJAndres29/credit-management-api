import { ProductVariantEntity } from '../entities';
import type { VariantCreateData, VariantUpdateData } from '../datasources/variant.datasource';

export interface VariantRepository {
  findByProductId(productId: string): Promise<ProductVariantEntity[]>;
  findById(id: string): Promise<ProductVariantEntity | null>;
  create(data: VariantCreateData): Promise<ProductVariantEntity>;
  update(id: string, data: VariantUpdateData): Promise<ProductVariantEntity>;
  delete(id: string): Promise<ProductVariantEntity>;
}
