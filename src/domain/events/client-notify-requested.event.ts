import { DomainEvent } from './domain-event';

export interface ClientNotifyRequestedData {
  clientId: string;
  /** Nombre del usuario del staff que solicitó el reenvío */
  requestedBy: string;
}

export type ClientNotifyRequestedEvent = DomainEvent<ClientNotifyRequestedData>;

export const CLIENT_NOTIFY_REQUESTED = 'ClientNotifyRequested';
