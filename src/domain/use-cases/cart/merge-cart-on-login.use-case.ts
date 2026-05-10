import { CartRepository } from '../../repositories/cart.repository';

/** Persists anonymous cart lines onto the authenticated customer's cart (P3). */
export class MergeCartOnLoginUseCase {
  constructor(private readonly cartRepository: CartRepository) {}

  async execute(sessionToken: string | null | undefined, customerId: string): Promise<void> {
    const token = sessionToken?.trim();
    if (!token || token.length < 8) return;
    await this.cartRepository.mergeSessionIntoCustomer(token, customerId);
  }
}
