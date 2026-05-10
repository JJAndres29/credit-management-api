import type { CreateCategoryDto } from '../../dtos/categories';
import { CategoryEntity } from '../../entities';
import { CategoryRepository } from '../../repositories';

export class CreateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  execute(dto: CreateCategoryDto): Promise<CategoryEntity> {
    return this.categoryRepository.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      metaTitle: dto.metaTitle,
      metaDescription: dto.metaDescription,
    });
  }
}
