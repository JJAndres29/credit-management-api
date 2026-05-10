/**
 * Money value object — COP-first; extend currency union when multi-currency is enabled.
 * Persisted amounts remain decimals in the DB; this VO is for domain math & validation.
 */
export type CurrencyCode = 'COP' | 'USD';

export class Money {
  private constructor(
    public readonly amount: number,
    public readonly currency: CurrencyCode = 'COP',
  ) {
    if (!Number.isFinite(amount)) throw new Error('Money.amount must be finite');
  }

  static cop(amount: number): Money {
    return new Money(Money.round2(amount), 'COP');
  }

  static usd(amount: number): Money {
    return new Money(Money.round2(amount), 'USD');
  }

  private static round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
    return new Money(Money.round2(this.amount + other.amount), this.currency);
  }

  subtract(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
    return new Money(Money.round2(this.amount - other.amount), this.currency);
  }

  multiply(factor: number): Money {
    return new Money(Money.round2(this.amount * factor), this.currency);
  }

  isNegative(): boolean {
    return this.amount < 0;
  }

  toNumber(): number {
    return this.amount;
  }
}
