import { CustomError } from '../../errors';
import { ProductEntity } from '../../entities';
import { ProductRepository } from '../../repositories';

export class GetProductByIdUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(id: string): Promise<ProductEntity> {
    const product = await this.productRepository.findById(id);

    if (!product) throw CustomError.notFound(`Product with id ${id} not found`);

    return product;
  }
}
