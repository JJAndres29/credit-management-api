import type { UpdateCategoryDto } from '../../dtos/categories';
import { CustomError } from '../../errors';
import { CategoryEntity } from '../../entities';
import { CategoryRepository } from '../../repositories';

export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(id: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) throw CustomError.notFound(`Category with id ${id} not found`);

    return this.categoryRepository.update(id, {
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      metaTitle: dto.metaTitle,
      metaDescription: dto.metaDescription,
    });
  }
}
