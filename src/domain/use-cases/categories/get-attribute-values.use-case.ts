import { AttributeValueEntity } from '../../entities';
import { CategoryRepository } from '../../repositories';

export class GetAttributeValuesUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  execute(attributeId: string): Promise<AttributeValueEntity[]> {
    return this.categoryRepository.findValuesByAttribute(attributeId);
  }
}
