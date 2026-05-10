/**
 * P6 will integrate a concrete DIAN provider. P2 only defines the port so invoice
 * orchestration never depends on a vendor SDK.
 */
export type ElectronicInvoiceDispatchPayload = {
  invoiceId: string;
  /** Raw domain identifiers — adapter maps to provider format */
  saleId?: string | null;
  onlineOrderId?: string | null;
};

export type ElectronicInvoiceDispatchResult = {
  ok: boolean;
  providerTrackId?: string;
  raw?: Record<string, unknown>;
};

export interface ElectronicInvoiceProviderPort {
  /**
   * Submit or refresh invoice state with external provider.
   * No-op implementations return `{ ok: false }` until P6 wiring exists.
   */
  submitInvoice(payload: ElectronicInvoiceDispatchPayload): Promise<ElectronicInvoiceDispatchResult>;
}
