/**
 * Tests — Bloque 1a: Pricing Strategies
 *
 * Funciones puras. Sin mocks de infraestructura, sin DB, sin HTTP.
 * Input: PricingContext  →  Output: PricingResult
 */

import { ClientEntity } from '../../entities/client.entity';
import { ProductEntity } from '../../entities/product.entity';
import { SaleType } from '../../entities/sale.entity';
import { PricingContext } from './pricing-context';
import { PricingService } from './pricing.service';
import { PricingStrategy } from './pricing-strategy.interface';
import { CashPricingStrategy } from './strategies/cash-pricing.strategy';
import { CreditPricingStrategy } from './strategies/credit-pricing.strategy';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeProduct(price: number): ProductEntity {
  return new ProductEntity('prod-1', 'Test Product', price, 10, [], true, new Date(), new Date());
}

function makeClient(): ClientEntity {
  return new ClientEntity('cli-1', 'Test Client', '555-0000', null, 5000, 0, true, new Date(), new Date());
}

function makeContext(saleType: SaleType, price: number, quantity = 1): PricingContext {
  return {
    product: makeProduct(price),
    saleType,
    client: makeClient(),
    quantity,
    saleDate: new Date('2026-04-09'),
  };
}

const cashCtx = (price: number) => makeContext(SaleType.CASH, price);
const creditCtx = (price: number) => makeContext(SaleType.CREDIT, price);

// ─── CashPricingStrategy ─────────────────────────────────────────────────────

describe('CashPricingStrategy', () => {
  const strategy = new CashPricingStrategy();

  describe('appliesTo', () => {
    it('returns true for CASH sale type', () => {
      expect(strategy.appliesTo(cashCtx(100))).toBe(true);
    });

    it('returns false for CREDIT sale type', () => {
      expect(strategy.appliesTo(creditCtx(100))).toBe(false);
    });
  });

  describe('calculate', () => {
    it('unitPrice equals basePrice (no markup)', () => {
      const result = strategy.calculate(cashCtx(250));
      expect(result.unitPrice).toBe(250);
      expect(result.unitPrice).toBe(result.basePrice);
    });

    it('surchargeAmount is exactly 0', () => {
      const result = strategy.calculate(cashCtx(99.99));
      expect(result.surchargeAmount).toBe(0);
    });

    it('appliedRule is "CASH_BASE"', () => {
      const result = strategy.calculate(cashCtx(100));
      expect(result.appliedRule).toBe('CASH_BASE');
    });

    it('basePrice matches product.price', () => {
      const result = strategy.calculate(cashCtx(1234.56));
      expect(result.basePrice).toBe(1234.56);
    });
  });
});

// ─── CreditPricingStrategy ───────────────────────────────────────────────────

describe('CreditPricingStrategy', () => {
  describe('constructor guard', () => {
    it('throws when surchargePercent is negative', () => {
      expect(() => new CreditPricingStrategy(-1)).toThrow(
        'CreditPricingStrategy: surchargePercent cannot be negative',
      );
    });

    it('accepts 0 as a valid surcharge', () => {
      expect(() => new CreditPricingStrategy(0)).not.toThrow();
    });
  });

  describe('appliesTo', () => {
    const strategy = new CreditPricingStrategy(15);

    it('returns true for CREDIT sale type', () => {
      expect(strategy.appliesTo(creditCtx(100))).toBe(true);
    });

    it('returns false for CASH sale type', () => {
      expect(strategy.appliesTo(cashCtx(100))).toBe(false);
    });
  });

  describe('calculate — 0% surcharge', () => {
    const strategy = new CreditPricingStrategy(0);

    it('unitPrice equals basePrice when surcharge is 0%', () => {
      const result = strategy.calculate(creditCtx(100));
      expect(result.unitPrice).toBe(100);
    });

    it('surchargeAmount is 0 when surcharge is 0%', () => {
      const result = strategy.calculate(creditCtx(100));
      expect(result.surchargeAmount).toBe(0);
    });

    it('appliedRule is "CREDIT_SURCHARGE_0PCT"', () => {
      const result = strategy.calculate(creditCtx(100));
      expect(result.appliedRule).toBe('CREDIT_SURCHARGE_0PCT');
    });
  });

  describe('calculate — 15% surcharge', () => {
    const strategy = new CreditPricingStrategy(15);

    it('unitPrice is basePrice + 15%', () => {
      const result = strategy.calculate(creditCtx(100));
      expect(result.unitPrice).toBe(115);
    });

    it('surchargeAmount is 15% of basePrice', () => {
      const result = strategy.calculate(creditCtx(100));
      expect(result.surchargeAmount).toBe(15);
    });

    it('appliedRule is "CREDIT_SURCHARGE_15PCT"', () => {
      const result = strategy.calculate(creditCtx(100));
      expect(result.appliedRule).toBe('CREDIT_SURCHARGE_15PCT');
    });

    it('rounds surchargeAmount to 2 decimal places', () => {
      // 10.01 * 0.15 = 1.5015 (floating point) → should round to 1.50
      const result = strategy.calculate(creditCtx(10.01));
      expect(result.surchargeAmount).toBe(1.5);
      expect(result.unitPrice).toBe(11.51);
    });
  });

  describe('calculate — 100% surcharge', () => {
    const strategy = new CreditPricingStrategy(100);

    it('unitPrice doubles the basePrice at 100% surcharge', () => {
      const result = strategy.calculate(creditCtx(200));
      expect(result.unitPrice).toBe(400);
    });

    it('surchargeAmount equals basePrice at 100% surcharge', () => {
      const result = strategy.calculate(creditCtx(200));
      expect(result.surchargeAmount).toBe(200);
    });

    it('appliedRule is "CREDIT_SURCHARGE_100PCT"', () => {
      const result = strategy.calculate(creditCtx(200));
      expect(result.appliedRule).toBe('CREDIT_SURCHARGE_100PCT');
    });
  });
});

// ─── PricingService ──────────────────────────────────────────────────────────

describe('PricingService', () => {
  describe('constructor', () => {
    it('throws when strategies array is empty', () => {
      expect(() => new PricingService([])).toThrow('PricingService requires at least one strategy');
    });
  });

  describe('priority selection', () => {
    it('selects the strategy with the highest priority when both apply', () => {
      // Two strategies that both appliesTo CREDIT, different priorities
      const lowPriority: PricingStrategy = {
        name: 'LOW',
        priority: 5,
        appliesTo: () => true,
        calculate: () => ({ basePrice: 0, unitPrice: 1, surchargeAmount: 0, appliedRule: 'LOW' }),
      };
      const highPriority: PricingStrategy = {
        name: 'HIGH',
        priority: 20,
        appliesTo: () => true,
        calculate: () => ({ basePrice: 0, unitPrice: 99, surchargeAmount: 0, appliedRule: 'HIGH' }),
      };

      // Pass low before high to prove ordering is by priority, not insertion order
      const service = new PricingService([lowPriority, highPriority]);
      const result = service.calculate(cashCtx(100));

      expect(result.appliedRule).toBe('HIGH');
      expect(result.unitPrice).toBe(99);
    });

    it('falls through to a lower-priority strategy when higher one does not apply', () => {
      const neverApplies: PricingStrategy = {
        name: 'NEVER',
        priority: 20,
        appliesTo: () => false,
        calculate: () => ({ basePrice: 0, unitPrice: 0, surchargeAmount: 0, appliedRule: 'NEVER' }),
      };
      const alwaysApplies: PricingStrategy = {
        name: 'ALWAYS',
        priority: 10,
        appliesTo: () => true,
        calculate: () => ({
          basePrice: 0,
          unitPrice: 50,
          surchargeAmount: 0,
          appliedRule: 'ALWAYS',
        }),
      };

      const service = new PricingService([neverApplies, alwaysApplies]);
      const result = service.calculate(cashCtx(100));

      expect(result.appliedRule).toBe('ALWAYS');
    });

    it('in a tie, first strategy (by insertion order) wins', () => {
      // Both have same priority; stable sort preserves insertion order
      const first: PricingStrategy = {
        name: 'FIRST',
        priority: 10,
        appliesTo: () => true,
        calculate: () => ({ basePrice: 0, unitPrice: 1, surchargeAmount: 0, appliedRule: 'FIRST' }),
      };
      const second: PricingStrategy = {
        name: 'SECOND',
        priority: 10,
        appliesTo: () => true,
        calculate: () => ({ basePrice: 0, unitPrice: 2, surchargeAmount: 0, appliedRule: 'SECOND' }),
      };

      const service = new PricingService([first, second]);
      const result = service.calculate(cashCtx(100));

      expect(result.appliedRule).toBe('FIRST');
    });
  });

  describe('no matching strategy', () => {
    it('throws an internal error when no strategy applies to the context', () => {
      const neverApplies: PricingStrategy = {
        name: 'NEVER',
        priority: 10,
        appliesTo: () => false,
        calculate: () => ({ basePrice: 0, unitPrice: 0, surchargeAmount: 0, appliedRule: 'NEVER' }),
      };

      const service = new PricingService([neverApplies]);

      expect(() => service.calculate(cashCtx(100))).toThrow(
        /No pricing strategy found for saleType="CASH"/,
      );
    });
  });

  describe('routing CASH and CREDIT to correct strategies', () => {
    const cash = new CashPricingStrategy();
    const credit = new CreditPricingStrategy(15);
    const service = new PricingService([cash, credit]);

    it('routes CASH context to CashPricingStrategy (appliedRule = CASH_BASE)', () => {
      const result = service.calculate(cashCtx(100));
      expect(result.appliedRule).toBe('CASH_BASE');
      expect(result.surchargeAmount).toBe(0);
    });

    it('routes CREDIT context to CreditPricingStrategy (appliedRule = CREDIT_SURCHARGE_15PCT)', () => {
      const result = service.calculate(creditCtx(100));
      expect(result.appliedRule).toBe('CREDIT_SURCHARGE_15PCT');
      expect(result.unitPrice).toBe(115);
    });
  });
});
