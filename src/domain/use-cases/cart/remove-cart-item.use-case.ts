import { CartRepository } from '../../repositories/cart.repository';
import { GetCartUseCase } from './get-cart.use-case';

export class RemoveCartItemUseCase {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly getCart: GetCartUseCase,
  ) {}

  async execute(itemId: string, customerId: string | null, sessionToken: string | null) {
    const cart = await this.getCart.execute(customerId, sessionToken);
    await this.cartRepository.removeLine(cart.id, itemId);
    return this.getCart.execute(customerId, sessionToken);
  }
}
