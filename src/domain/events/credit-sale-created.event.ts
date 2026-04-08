import { DomainEvent } from './domain-event';

export interface CreditSaleCreatedData {
  saleId: string;
  clientId: string;
  total: number;
  /** Balance del cliente DESPUÉS de registrar la venta a crédito */
  newBalance: number;
}

export type CreditSaleCreatedEvent = DomainEvent<CreditSaleCreatedData>;

export const CREDIT_SALE_CREATED = 'CreditSaleCreated';
