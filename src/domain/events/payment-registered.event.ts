import { DomainEvent } from './domain-event';

export interface PaymentRegisteredData {
  paymentId: string;
  clientId: string;
  amount: number;
  /** Balance del cliente DESPUÉS de aplicar el pago */
  newBalance: number;
  note: string | null;
}

export type PaymentRegisteredEvent = DomainEvent<PaymentRegisteredData>;

export const PAYMENT_REGISTERED = 'PaymentRegistered';
