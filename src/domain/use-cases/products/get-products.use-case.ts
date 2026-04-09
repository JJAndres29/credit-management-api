import { ProductRepository } from '../../repositories';
import { FilterProductsDto } from '../../dtos/products';
import { PaginationDto } from '../../dtos/shared';
import { PaginatedResult } from '../../types/paginated.type';
import { ProductEntity } from '../../entities';

export class GetProductsUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  execute(pagination: PaginationDto, filters: FilterProductsDto): Promise<PaginatedResult<ProductEntity>> {
    return this.productRepository.findAll(pagination, filters);
  }
}
