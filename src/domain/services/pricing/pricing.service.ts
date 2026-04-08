import { CustomError } from '../../errors';
import { PricingContext } from './pricing-context';
import { PricingResult } from './pricing-result';
import { PricingStrategy } from './pricing-strategy.interface';

/**
 * Domain Service que orquesta el cálculo de precios.
 *
 * No contiene lógica de negocio propia: delega en la PricingStrategy
 * de mayor prioridad que aplique al contexto dado.
 *
 * Al recibir las strategies por constructor, el servicio es completamente
 * agnóstico al conjunto de reglas activas. Agregar una nueva regla de
 * pricing = crear una nueva strategy y registrarla en el composition root
 * (sale.router.ts), sin tocar este archivo.
 *
 * Uso:
 *   const service = new PricingService([
 *     new CashPricingStrategy(),
 *     new CreditPricingStrategy(15),
 *   ]);
 *   const result = service.calculate(context);
 */
export class PricingService {
  private readonly sortedStrategies: PricingStrategy[];

  constructor(strategies: PricingStrategy[]) {
    if (strategies.length === 0) {
      throw new Error('PricingService requires at least one strategy');
    }
    // Ordenar de mayor a menor priority una sola vez en el constructor.
    // Así calculate() no repite el sort en cada llamada.
    this.sortedStrategies = [...strategies].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calcula el precio para el contexto dado.
   * Selecciona la primera strategy (de mayor priority) que `appliesTo` el contexto.
   *
   * @throws CustomError.internalServer si ninguna strategy coincide.
   *         Esto indica un error de configuración en el composition root.
   */
  calculate(context: PricingContext): PricingResult {
    const strategy = this.sortedStrategies.find((s) => s.appliesTo(context));

    if (!strategy) {
      throw CustomError.internalServer(
        `No pricing strategy found for saleType="${context.saleType}". ` +
          `Check that PricingService is configured with strategies for all sale types.`,
      );
    }

    return strategy.calculate(context);
  }
}
