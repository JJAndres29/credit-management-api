import { DomainEvent } from './domain-event';

export interface PaymentRegisteredData {
  paymentId: string;
  clientId: string;
  amount: number;
  /** Balance del cliente DESPUÉS de aplicar el pago */
  newBalance: number;
  note: string | null;
  /** Datos de cuotas de la venta asociada (solo cuando saleId tiene plan de cuotas) */
  saleInstallmentsCount?: number | null;
  saleInstallmentAmount?: number | null;
  /** Total acumulado pagado en la venta DESPUÉS de este pago */
  saleTotalPaidAfter?: number;
}

export type PaymentRegisteredEvent = DomainEvent<PaymentRegisteredData>;

export const PAYMENT_REGISTERED = 'PaymentRegistered';
