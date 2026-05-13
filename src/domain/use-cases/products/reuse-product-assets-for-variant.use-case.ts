import { CustomError } from '../../errors';
import { ProductEntity } from '../../entities';
import { ProductRepository } from '../../repositories';
import type { VariantRepository } from '../../repositories/variant.repository';
import { ReuseProductAssetsDto } from '../../dtos/products/reuse-product-assets.dto';

export class ReuseProductAssetsForVariantUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly variantRepository: VariantRepository,
  ) {}

  async execute(productId: string, dto: ReuseProductAssetsDto): Promise<ProductEntity> {
    const product = await this.productRepository.findById(productId);
    if (!product) throw CustomError.notFound(`Producto ${productId} no encontrado`);

    const variant = await this.variantRepository.findById(dto.variantId);
    if (!variant) {
      throw CustomError.notFound(`Variante ${dto.variantId} no encontrada`);
    }
    if (variant.productId !== productId) {
      throw CustomError.badRequest('La variante no pertenece a este producto');
    }

    return this.productRepository.reuseGeneralAssetsForVariant({
      productId,
      variantId: dto.variantId,
      sourceAssetIds: dto.assetIds,
    });
  }
}
