import {
  ElectronicInvoiceDispatchPayload,
  ElectronicInvoiceDispatchResult,
  ElectronicInvoiceProviderPort,
} from '../../domain/services/electronic-invoice-provider.port';

/** Placeholder until DIAN integration — keeps composition roots type-safe. */
export class NoopElectronicInvoiceProviderAdapter implements ElectronicInvoiceProviderPort {
  async submitInvoice(_payload: ElectronicInvoiceDispatchPayload): Promise<ElectronicInvoiceDispatchResult> {
    return { ok: false };
  }
}
