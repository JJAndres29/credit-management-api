import { CustomError } from '../../errors';
import { AttributeValueEntity } from '../../entities';
import { CategoryRepository } from '../../repositories';

export class UpdateAttributeValueUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(valueId: string, value: string): Promise<AttributeValueEntity> {
    const existing = await this.categoryRepository.findValueById(valueId);
    if (!existing) throw CustomError.notFound(`Value with id ${valueId} not found`);

    return this.categoryRepository.updateValue(valueId, value);
  }
}
