import { CustomError } from '../../errors';
import { CategoryAttributeEntity } from '../../entities';
import { CategoryRepository } from '../../repositories';

export class UpdateCategoryAttributeUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(attributeId: string, name: string): Promise<CategoryAttributeEntity> {
    const existing = await this.categoryRepository.findAttributeById(attributeId);
    if (!existing) throw CustomError.notFound(`Attribute with id ${attributeId} not found`);

    return this.categoryRepository.updateAttribute(attributeId, name);
  }
}
