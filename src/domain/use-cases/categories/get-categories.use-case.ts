import { CategoryEntity } from '../../entities';
import { CategoryRepository } from '../../repositories';

export class GetCategoriesUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  execute(): Promise<CategoryEntity[]> {
    return this.categoryRepository.findAll();
  }
}
