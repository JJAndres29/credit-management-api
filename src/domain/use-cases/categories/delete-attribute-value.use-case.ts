import { AttributeValueEntity } from '../../entities';
import { CategoryRepository } from '../../repositories';

export class DeleteAttributeValueUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  execute(valueId: string): Promise<AttributeValueEntity> {
    return this.categoryRepository.deleteValue(valueId);
  }
}
