import { ClaimClientDto } from '../../dtos/customer-auth';
import { CustomError } from '../../errors';
import { CustomerRepository } from '../../repositories';
import { ClientLookupPort, ClientSummary } from '../../services/client-lookup.port';

export class ClaimClientUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly clientLookupPort: ClientLookupPort,
  ) {}

  async execute(customerId: string, dto: ClaimClientDto): Promise<ClientSummary> {
    const client = await this.clientLookupPort.findByDocument(dto.documentType, dto.documentNumber);
    if (!client) throw CustomError.notFound('Cliente no encontrado');

    if (client.isLinkedToCustomer) {
      throw CustomError.conflict('Este cliente ya está vinculado a una cuenta de E-commerce');
    }

    await this.customerRepository.linkToClient(customerId, client.id);

    return { ...client, isLinkedToCustomer: true };
  }
}
