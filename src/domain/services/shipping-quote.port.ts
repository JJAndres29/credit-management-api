/**
 * Quotes shipping COP from persisted zones/rates (P3). Swap implementation for carrier APIs later.
 */
export interface ShippingQuotePort {
  quoteShippingCop(zoneCode: string, weightKg: number, merchandiseSubtotalCop: number): Promise<number>;
}
