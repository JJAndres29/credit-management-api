import { CustomError } from '../../errors';
import { ProductEntity } from '../../entities';
import { UpdateProductDto } from '../../dtos/products';
import { ProductRepository } from '../../repositories';

export class UpdateProductUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    const existing = await this.productRepository.findById(id);

    if (!existing) throw CustomError.notFound(`Product with id ${id} not found`);

    return this.productRepository.update(id, dto);
  }
}
