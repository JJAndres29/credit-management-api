import { CustomerLinkPort } from '../../domain/services/customer-link.port';
import { CustomerRepository } from '../../domain/repositories/customer.repository';

/**
 * Infrastructure adapter that implements CustomerLinkPort by wrapping CustomerRepository.
 * This is the only place where the OnlineOrders bounded context is allowed to
 * touch the Customer bounded context — through this translation layer.
 */
export class CustomerLinkAdapter implements CustomerLinkPort {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async findClientIdByCustomerId(customerId: string): Promise<string | null> {
    const customer = await this.customerRepository.findById(customerId);
    return customer?.clientId ?? null;
  }
}
