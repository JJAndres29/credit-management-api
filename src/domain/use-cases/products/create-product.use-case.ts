import { ProductEntity } from '../../entities';
import { CreateProductDto } from '../../dtos/products';
import { ProductRepository } from '../../repositories';

export class CreateProductUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  execute(dto: CreateProductDto): Promise<ProductEntity> {
    return this.productRepository.create(dto);
  }
}
