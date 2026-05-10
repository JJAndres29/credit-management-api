/**
 * Lectura mínima del perfil de customer para scoring de riesgo en checkout.
 * Implementación en infra (adaptador sobre CustomerRepository) para que OnlineOrders
 * no importe `customer.repository` (guard no-coupling).
 */
export interface CustomerRiskProfilePort {
  getAccountCreatedAt(customerId: string): Promise<Date | null>;
}
