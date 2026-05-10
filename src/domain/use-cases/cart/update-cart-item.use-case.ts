import { CartRepository } from '../../repositories/cart.repository';
import { UpdateCartItemDto } from '../../dtos/cart/update-cart-item.dto';
import { GetCartUseCase } from './get-cart.use-case';

export class UpdateCartItemUseCase {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly getCart: GetCartUseCase,
  ) {}

  async execute(
    itemId: string,
    dto: UpdateCartItemDto,
    customerId: string | null,
    sessionToken: string | null,
  ) {
    const cart = await this.getCart.execute(customerId, sessionToken);
    await this.cartRepository.setLineQuantity(cart.id, itemId, dto.quantity);
    return this.getCart.execute(customerId, sessionToken);
  }
}
