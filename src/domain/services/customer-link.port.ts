/**
 * Anti-Corruption Layer port for the OnlineOrders bounded context.
 *
 * OnlineOrder use cases need to know whether a Customer is linked to a Staff Client
 * (so they can create a Sale on payment). They must NOT import CustomerRepository
 * directly — that would couple two bounded contexts.
 *
 * This port exposes the single fact needed: given a customerId, what is the
 * linked clientId (or null if the customer has no linked Client)?
 */
export interface CustomerLinkPort {
  findClientIdByCustomerId(customerId: string): Promise<string | null>;
}
