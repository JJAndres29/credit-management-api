import { DomainEvent } from './domain-event';

export interface CreditSaleCreatedData {
  saleId: string;
  clientId: string;
  total: number;
  /** Balance del cliente DESPUÉS de registrar la venta a crédito */
  newBalance: number;
  /** Número de cuotas pactadas. Null si no hay plan de cuotas. */
  installmentsCount: number | null;
  /** Monto de cada cuota. Null si no hay plan de cuotas. */
  installmentAmount: number | null;
}

export type CreditSaleCreatedEvent = DomainEvent<CreditSaleCreatedData>;

export const CREDIT_SALE_CREATED = 'CreditSaleCreated';
