import { CategoryEntity } from '../../entities';
import { CategoryRepository } from '../../repositories';

export class CreateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  execute(name: string): Promise<CategoryEntity> {
    return this.categoryRepository.create(name);
  }
}
