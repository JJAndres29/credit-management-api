import { CategoryAttributeEntity } from '../../entities';
import { CategoryRepository } from '../../repositories';

export class DeleteCategoryAttributeUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  execute(attributeId: string): Promise<CategoryAttributeEntity> {
    return this.categoryRepository.deleteAttribute(attributeId);
  }
}
