import { PricingContext } from '../pricing-context';
import { PricingResult } from '../pricing-result';
import { PricingStrategy } from '../pricing-strategy.interface';
import { SaleType } from '../../../entities/sale.entity';

/**
 * Estrategia de precio para ventas de CONTADO (CASH).
 *
 * Aplica el precio base del producto sin modificación alguna.
 * Es la strategy más básica y sirve como baseline: define qué significa
 * "precio de contado" en el sistema. Si en el futuro se agrega un descuento
 * por pago inmediato, se implementa aquí sin tocar ningún otro archivo.
 *
 * Priority 10: es la regla base. Strategies más específicas (mayoristas,
 * promociones) deben usar priority >= 20 para sobreescribirla cuando apliquen.
 */
export class CashPricingStrategy implements PricingStrategy {
  readonly name = 'CASH_BASE';
  readonly priority = 10;

  appliesTo(context: PricingContext): boolean {
    return context.saleType === SaleType.CASH;
  }

  calculate(context: PricingContext): PricingResult {
    const basePrice = context.product.price;

    return {
      basePrice,
      unitPrice: basePrice,
      surchargeAmount: 0,
      appliedRule: this.name,
    };
  }
}
