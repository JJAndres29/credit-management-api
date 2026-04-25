import { CustomError } from '../../errors';
import { ProductEntity } from '../../entities';
import { UpdateProductDto } from '../../dtos/products';
import { CategoryRepository, ProductRepository } from '../../repositories';

export class UpdateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly categoryRepository?: CategoryRepository,
  ) {}

  async execute(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    const existing = await this.productRepository.findById(id);

    if (!existing) throw CustomError.notFound(`Product with id ${id} not found`);

    if (dto.categoryId && this.categoryRepository) {
      const category = await this.categoryRepository.findById(dto.categoryId);
      if (!category) throw CustomError.notFound(`Category with id ${dto.categoryId} not found`);
    }

    return this.productRepository.update(id, dto);
  }
}
