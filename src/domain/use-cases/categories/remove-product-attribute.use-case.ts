import { CustomError } from '../../errors';
import { ProductEntity } from '../../entities';
import { ProductRepository } from '../../repositories';

export class RemoveProductAttributeUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(productId: string, valueId: string): Promise<ProductEntity> {
    const product = await this.productRepository.findById(productId);
    if (!product) throw CustomError.notFound(`Product with id ${productId} not found`);

    return this.productRepository.removeAttribute(productId, valueId);
  }
}
