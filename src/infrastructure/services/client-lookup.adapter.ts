import { ClientRepository } from '../../domain/repositories/client.repository';
import { CustomerRepository } from '../../domain/repositories/customer.repository';
import { ClientLookupPort, ClientSummary } from '../../domain/services/client-lookup.port';
import { ClientEntity } from '../../domain/entities';

export class ClientLookupAdapter implements ClientLookupPort {
  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly customerRepository: CustomerRepository,
  ) {}

  async findByDocument(documentType: string, documentNumber: string): Promise<ClientSummary | null> {
    const client = await this.clientRepository.findByDocument(documentType, documentNumber);
    if (!client) return null;
    return this.toSummary(client);
  }

  async findById(id: string): Promise<ClientSummary | null> {
    const client = await this.clientRepository.findById(id);
    if (!client) return null;
    return this.toSummary(client);
  }

  private async toSummary(client: ClientEntity): Promise<ClientSummary> {
    const linked = await this.customerRepository.findByClientId(client.id);
    return {
      id: client.id,
      creditLimit: client.creditLimit,
      balance: client.balance,
      isLinkedToCustomer: linked !== null,
    };
  }
}
