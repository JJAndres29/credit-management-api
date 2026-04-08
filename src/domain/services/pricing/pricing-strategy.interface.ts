import { PricingContext } from './pricing-context';
import { PricingResult } from './pricing-result';

/**
 * Contrato que debe cumplir toda estrategia de precio.
 *
 * Cada implementación encapsula una regla de negocio de pricing:
 * - CashPricingStrategy     → precio base para ventas de contado
 * - CreditPricingStrategy   → precio con recargo para ventas a crédito
 * - WholesaleClientStrategy → precio especial para clientes mayoristas (futuro)
 * - PromoPricingStrategy    → precio promocional por fecha (futuro)
 *
 * El PricingService selecciona la strategy con mayor `priority` que `appliesTo`
 * el contexto dado, garantizando que reglas más específicas siempre ganan
 * sobre las genéricas sin necesidad de modificar código existente.
 */
export interface PricingStrategy {
  /** Identificador único de la strategy (para logs y debugging) */
  readonly name: string;

  /**
   * Número de prioridad: mayor número = se evalúa primero.
   * Strategies base usan 10. Strategies específicas deben usar 20+.
   * Ejemplo: WholesaleClientStrategy con priority 20 gana sobre CreditPricingStrategy con 10.
   */
  readonly priority: number;

  /** Determina si esta strategy aplica para el contexto dado */
  appliesTo(context: PricingContext): boolean;

  /** Calcula y retorna el resultado de pricing para el contexto dado */
  calculate(context: PricingContext): PricingResult;
}
