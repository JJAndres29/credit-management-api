/**
 * Sanitized example — Anti-Corruption Layer between bounded contexts
 *
 * Customer context (e-commerce) must NOT import ClientRepository or ClientEntity.
 * ClientLookupPort exposes the minimum surface needed for claim-client and profile.
 */

// ─── Domain port (customer context) ─────────────────────────────────────────

export type ClientSummary = {
  id: string;
  creditLimit: number;
  balance: number;
  isLinkedToCustomer: boolean;
};

export interface ClientLookupPort {
  findByDocument(documentType: string, documentNumber: string): Promise<ClientSummary | null>;
  findById(id: string): Promise<ClientSummary | null>;
}

// ─── Use case (customer context) — depends on port, not staff repository ────

export class ClaimClientUseCase {
  constructor(
    private readonly clientLookup: ClientLookupPort,
    private readonly customerRepo: { linkToClient(customerId: string, clientId: string): Promise<void> },
  ) {}

  async execute(customerId: string, documentType: string, documentNumber: string) {
    const client = await this.clientLookup.findByDocument(documentType, documentNumber);
    if (!client) throw new Error('404 — client not found');
    if (client.isLinkedToCustomer) throw new Error('409 — already claimed');

    await this.customerRepo.linkToClient(customerId, client.id);

    return { ...client, isLinkedToCustomer: true };
  }
}

// ─── Infrastructure adapter — wraps staff repos, translates to ClientSummary ──

// class ClientLookupAdapter implements ClientLookupPort {
//   constructor(
//     private clientRepo: ClientRepository,      // staff — OK here, not in use case
//     private customerRepo: CustomerRepository,
//   ) {}
//
//   async findByDocument(type: string, number: string) {
//     const client = await this.clientRepo.findByDocument(type, number);
//     if (!client) return null;
//     return this.toSummary(client);
//   }
//
//   private async toSummary(client: ClientEntity): Promise<ClientSummary> {
//     const linked = await this.customerRepo.findByClientId(client.id);
//     return {
//       id: client.id,
//       creditLimit: Number(client.creditLimit),
//       balance: Number(client.balance),
//       isLinkedToCustomer: linked !== null,
//     };
//   }
// }
