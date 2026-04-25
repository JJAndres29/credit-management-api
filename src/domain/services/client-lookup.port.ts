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
