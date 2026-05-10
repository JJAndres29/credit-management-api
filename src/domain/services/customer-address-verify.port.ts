/**
 * Ensures a saved address belongs to the authenticated customer (P3 checkout).
 */
export interface CustomerAddressVerifyPort {
  /** @throws CustomError.notFound if missing or wrong owner */
  assertOwnedByCustomer(addressId: string, customerId: string): Promise<void>;
}
