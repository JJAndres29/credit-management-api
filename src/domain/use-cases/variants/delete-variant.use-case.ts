import { CustomError } from '../../errors';
import { ProductVariantEntity } from '../../entities';
import { VariantRepository } from '../../repositories/variant.repository';

export class DeleteVariantUseCase {
  constructor(
    private readonly variantRepository: VariantRepository,
  ) {}

  async execute(variantId: string): Promise<ProductVariantEntity> {
    const variant = await this.variantRepository.findById(variantId);
    if (!variant) throw CustomError.notFound(`Variante ${variantId} no encontrada`);

    return this.variantRepository.delete(variantId);
  }
}
