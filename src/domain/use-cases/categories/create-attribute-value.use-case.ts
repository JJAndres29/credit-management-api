import { AttributeValueEntity } from '../../entities';
import { CustomError } from '../../errors';
import { CategoryRepository } from '../../repositories';

export class CreateAttributeValueUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(attributeId: string, value: string): Promise<AttributeValueEntity> {
    const attribute = await this.categoryRepository.findAttributeById(attributeId);
    if (!attribute) {
      throw CustomError.notFound(`Atributo con id ${attributeId} no encontrado`);
    }
    return this.categoryRepository.createValue(attributeId, value);
  }
}
