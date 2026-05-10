import { CustomError } from '../../errors';
import { CartRepository } from '../../repositories/cart.repository';
import { CartData } from '../../datasources/cart.datasource';

export class GetCartUseCase {
  constructor(private readonly cartRepository: CartRepository) {}

  async execute(customerId: string | null, sessionToken: string | null): Promise<CartData> {
    if (customerId) {
      let cart = await this.cartRepository.findByCustomerId(customerId);
      if (!cart) cart = await this.cartRepository.createForCustomer(customerId);
      return cart;
    }
    const token = sessionToken?.trim();
    if (!token || token.length < 8) {
      throw CustomError.badRequest('Encabezado X-Cart-Session requerido para carrito anónimo');
    }
    let cart = await this.cartRepository.findBySessionToken(token);
    if (!cart) cart = await this.cartRepository.createWithSession(token);
    return cart;
  }
}
