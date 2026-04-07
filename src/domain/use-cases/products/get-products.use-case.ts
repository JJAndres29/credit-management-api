import { ProductEntity } from '../../entities';
import { ProductRepository } from '../../repositories';

export class GetProductsUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  execute(): Promise<ProductEntity[]> {
    return this.productRepository.findAll();
  }
}
