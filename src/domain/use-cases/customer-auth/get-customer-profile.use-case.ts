import { CustomError } from '../../errors';
import { CustomerRepository } from '../../repositories';
import { ClientLookupPort, ClientSummary } from '../../services/client-lookup.port';
import { CustomerEntity } from '../../entities';

interface CustomerProfileResponse {
  customer: ReturnType<CustomerEntity['toJSON']>;
  client: ClientSummary | null;
}

export class GetCustomerProfileUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly clientLookupPort: ClientLookupPort,
  ) {}

  async execute(customerId: string): Promise<CustomerProfileResponse> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer || !customer.isActive) throw CustomError.unauthorized('No autorizado');

    let client: ClientSummary | null = null;
    if (customer.clientId) {
      client = await this.clientLookupPort.findById(customer.clientId);
    }

    return { customer: customer.toJSON(), client };
  }
}
