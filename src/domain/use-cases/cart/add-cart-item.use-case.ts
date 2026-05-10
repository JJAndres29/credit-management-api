import { CustomError } from '../../errors';
import { CartRepository } from '../../repositories/cart.repository';
import { ProductCatalogPort } from '../../services/product-catalog.port';
import { AddCartItemDto } from '../../dtos/cart/add-cart-item.dto';
import { GetCartUseCase } from './get-cart.use-case';

export class AddCartItemUseCase {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly catalog: ProductCatalogPort,
    private readonly getCart: GetCartUseCase,
  ) {}

  async execute(
    dto: AddCartItemDto,
    customerId: string | null,
    sessionToken: string | null,
  ) {
    const product = await this.catalog.getForOrder(dto.productId);
    if (!product || !product.isActive) throw CustomError.notFound('Producto no encontrado');
    if (product.retailPrice === null) {
      throw CustomError.badRequest('El producto no tiene precio configurado');
    }
    if (!product.defaultVariantId) {
      throw CustomError.badRequest('Producto sin variante por defecto');
    }

    const cart = await this.getCart.execute(customerId, sessionToken);

    await this.cartRepository.upsertLineQuantity(cart.id, {
      productId: dto.productId,
      variantId: product.defaultVariantId,
      quantity: dto.quantity,
      priceAtAdd: product.retailPrice,
      productNameSnapshot: product.name,
    });

    return this.getCart.execute(customerId, sessionToken);
  }
}
