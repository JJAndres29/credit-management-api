import { CustomError } from '../../errors';
import { ProductVariantEntity } from '../../entities';
import { ProductRepository } from '../../repositories';
import { VariantRepository } from '../../repositories/variant.repository';

export class GetVariantsUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly variantRepository: VariantRepository,
  ) {}

  async execute(productId: string): Promise<ProductVariantEntity[]> {
    const product = await this.productRepository.findById(productId);
    if (!product) throw CustomError.notFound(`Producto ${productId} no encontrado`);

    return this.variantRepository.findByProductId(productId);
  }
}
