import { CustomError } from '../../errors';
import { ProductEntity } from '../../entities';
import { ProductRepository } from '../../repositories';

export class DeleteProductUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(id: string): Promise<ProductEntity> {
    const existing = await this.productRepository.findById(id);

    if (!existing) throw CustomError.notFound(`Product with id ${id} not found`);

    return this.productRepository.delete(id);
  }
}
