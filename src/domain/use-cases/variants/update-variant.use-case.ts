import { CustomError } from '../../errors';
import { ProductVariantEntity } from '../../entities';
import { VariantRepository } from '../../repositories/variant.repository';
import { UpdateVariantDto } from '../../dtos/variants';

export class UpdateVariantUseCase {
  constructor(
    private readonly variantRepository: VariantRepository,
  ) {}

  async execute(variantId: string, dto: UpdateVariantDto): Promise<ProductVariantEntity> {
    const variant = await this.variantRepository.findById(variantId);
    if (!variant) throw CustomError.notFound(`Variante ${variantId} no encontrada`);

    return this.variantRepository.update(variantId, {
      sku: dto.sku,
      label: dto.label,
      stock: dto.stock,
      retailPrice: dto.retailPrice,
      investmentCost: dto.investmentCost,
      isActive: dto.isActive,
      attributeValueIds: dto.attributeValueIds,
    });
  }
}
