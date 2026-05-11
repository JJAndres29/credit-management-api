import { CustomError } from '../../errors';
import { ProductVariantEntity } from '../../entities';
import { ProductRepository } from '../../repositories';
import { VariantRepository } from '../../repositories/variant.repository';
import { CreateVariantDto } from '../../dtos/variants';

export class CreateVariantUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly variantRepository: VariantRepository,
  ) {}

  async execute(dto: CreateVariantDto): Promise<ProductVariantEntity> {
    const product = await this.productRepository.findById(dto.productId);
    if (!product) throw CustomError.notFound(`Producto ${dto.productId} no encontrado`);

    if (!product.isActive) {
      throw CustomError.badRequest('No se pueden crear variantes para un producto inactivo');
    }

    if (!product.categoryId) {
      throw CustomError.badRequest('El producto debe tener una categoría asignada para crear variantes con atributos');
    }

    return this.variantRepository.create({
      productId: dto.productId,
      attributeValueIds: dto.attributeValueIds,
      stock: dto.stock,
      sku: dto.sku,
      label: dto.label,
      retailPrice: dto.retailPrice,
      investmentCost: dto.investmentCost,
    });
  }
}
