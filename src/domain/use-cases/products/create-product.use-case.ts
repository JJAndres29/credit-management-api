import { ProductEntity } from '../../entities';
import { CreateProductDto } from '../../dtos/products';
import { CustomError } from '../../errors';
import { CategoryRepository, ProductRepository } from '../../repositories';

export class CreateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly categoryRepository?: CategoryRepository,
  ) {}

  async execute(dto: CreateProductDto): Promise<ProductEntity> {
    if (dto.categoryId && this.categoryRepository) {
      const category = await this.categoryRepository.findById(dto.categoryId);
      if (!category) throw CustomError.notFound(`Category with id ${dto.categoryId} not found`);
    }

    return this.productRepository.create(dto);
  }
}
