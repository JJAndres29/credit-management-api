/**
 * Saved address checks at checkout (P3).
 */
export interface CustomerAddressVerifyPort {
  /**
   * Address must belong to customer and include código postal + teléfono para envío.
   * @throws CustomError.notFound | CustomError.badRequest
   */
  assertOwnedAndCarrierReadyForCheckout(addressId: string, customerId: string): Promise<void>;
}
