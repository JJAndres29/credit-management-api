import { CustomError } from '../../errors';
import { CategoryEntity } from '../../entities';
import { CategoryRepository } from '../../repositories';

export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(id: string, name: string): Promise<CategoryEntity> {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) throw CustomError.notFound(`Category with id ${id} not found`);

    return this.categoryRepository.update(id, name);
  }
}
