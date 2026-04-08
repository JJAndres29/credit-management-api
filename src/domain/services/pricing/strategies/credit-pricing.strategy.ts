import { PricingContext } from '../pricing-context';
import { PricingResult } from '../pricing-result';
import { PricingStrategy } from '../pricing-strategy.interface';
import { SaleType } from '../../../entities/sale.entity';

/**
 * Estrategia de precio para ventas a CRÉDITO.
 *
 * Aplica un recargo porcentual sobre el precio base del producto.
 * El porcentaje se inyecta en el constructor desde la variable de entorno
 * CREDIT_SURCHARGE_PERCENT, lo que permite modificarlo sin cambiar código.
 *
 * El campo `appliedRule` incluye el porcentaje exacto aplicado
 * (ej. "CREDIT_SURCHARGE_15PCT") para que el registro en SaleItem sea
 * auto-descriptivo y auditable en el futuro.
 *
 * Priority 10: es la regla base para crédito. Si en el futuro se agrega
 * una strategy para clientes VIP con crédito (priority 20), esa sobreescribirá
 * esta sin necesidad de modificarla.
 */
export class CreditPricingStrategy implements PricingStrategy {
  readonly name = 'CREDIT_SURCHARGE';
  readonly priority = 10;

  constructor(private readonly surchargePercent: number) {
    if (surchargePercent < 0) {
      throw new Error('CreditPricingStrategy: surchargePercent cannot be negative');
    }
  }

  appliesTo(context: PricingContext): boolean {
    return context.saleType === SaleType.CREDIT;
  }

  calculate(context: PricingContext): PricingResult {
    const basePrice = context.product.price;
    const surchargeAmount = basePrice * (this.surchargePercent / 100);
    const unitPrice = basePrice + surchargeAmount;

    return {
      basePrice,
      unitPrice,
      surchargeAmount,
      appliedRule: `${this.name}_${this.surchargePercent}PCT`,
    };
  }
}
