import { AttributeValueEntity } from '../../entities';
import { CategoryRepository } from '../../repositories';

export class CreateAttributeValueUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  execute(attributeId: string, value: string): Promise<AttributeValueEntity> {
    return this.categoryRepository.createValue(attributeId, value);
  }
}
