export interface DomainEvent<T = unknown> {
  /** Nombre único del evento, e.g. "PaymentRegistered" */
  eventName: string;
  /** Timestamp de cuando ocurrió el evento */
  occurredOn: Date;
  /** Datos relevantes del evento */
  data: T;
}
