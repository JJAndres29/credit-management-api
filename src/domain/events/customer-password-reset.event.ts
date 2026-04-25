import { DomainEvent } from './domain-event';

export interface CustomerPasswordResetData {
  customerId: string;
  customerEmail: string;
  customerName: string;
  tempPassword: string;
}

export type CustomerPasswordResetEvent = DomainEvent<CustomerPasswordResetData>;

export const CUSTOMER_PASSWORD_RESET = 'CustomerPasswordReset';
