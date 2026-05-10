import { CartRepository } from '../../repositories/cart.repository';

/** Best-effort cleanup after a successful checkout (P3). */
export class ClearCheckoutCartUseCase {
  constructor(private readonly cartRepository: CartRepository) {}

  async execute(customerId: string | null, sessionToken: string | null): Promise<void> {
    if (customerId) {
      await this.cartRepository.deleteByCustomerId(customerId);
      return;
    }
    const t = sessionToken?.trim();
    if (t && t.length >= 8) await this.cartRepository.deleteBySessionToken(t);
  }
}
