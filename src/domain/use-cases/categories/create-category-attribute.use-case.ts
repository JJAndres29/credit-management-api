import { CustomError } from '../../errors';
import { CategoryAttributeEntity } from '../../entities';
import { CategoryRepository } from '../../repositories';

export class CreateCategoryAttributeUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(categoryId: string, name: string): Promise<CategoryAttributeEntity> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) throw CustomError.notFound(`Category with id ${categoryId} not found`);

    return this.categoryRepository.createAttribute(categoryId, name);
  }
}
