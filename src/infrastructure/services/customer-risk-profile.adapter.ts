import { CustomerRiskProfilePort } from '../../domain/services/customer-risk-profile.port';
import { CustomerRepository } from '../../domain/repositories/customer.repository';

export class CustomerRiskProfileAdapter implements CustomerRiskProfilePort {
  constructor(private readonly customers: CustomerRepository) {}

  async getAccountCreatedAt(customerId: string): Promise<Date | null> {
    const c = await this.customers.findById(customerId);
    return c?.createdAt ?? null;
  }
}
