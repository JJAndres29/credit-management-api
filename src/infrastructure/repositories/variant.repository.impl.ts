import { VariantDatasource, VariantCreateData, VariantUpdateData } from '../../domain/datasources/variant.datasource';
import { VariantRepository } from '../../domain/repositories/variant.repository';
import { ProductVariantEntity } from '../../domain/entities';

export class VariantRepositoryImpl implements VariantRepository {
  constructor(private readonly datasource: VariantDatasource) {}

  findByProductId(productId: string): Promise<ProductVariantEntity[]> {
    return this.datasource.findByProductId(productId);
  }

  findById(id: string): Promise<ProductVariantEntity | null> {
    return this.datasource.findById(id);
  }

  create(data: VariantCreateData): Promise<ProductVariantEntity> {
    return this.datasource.create(data);
  }

  update(id: string, data: VariantUpdateData): Promise<ProductVariantEntity> {
    return this.datasource.update(id, data);
  }

  delete(id: string): Promise<ProductVariantEntity> {
    return this.datasource.delete(id);
  }
}
