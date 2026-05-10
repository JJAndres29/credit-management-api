import { OrderVelocityPort } from '../../services/order-velocity.port';

export type OrderRiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

export type OrderRiskEvaluation = {
  score: number;
  tier: OrderRiskTier;
};

export type EvaluateOrderRiskInput = {
  ipAddress: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  customerId: string | null;
  /** When known — email-young accounts get extra weight */
  customerAccountCreatedAt: Date | null;
  merchandiseTotalCop: number;
  fraudStrictMode: boolean;
};

/**
 * P3 velocity + heuristic score. Gateway integration (Radar, etc.) can wrap/replace this later.
 */
export class EvaluateOrderRiskUseCase {
  constructor(private readonly velocity: OrderVelocityPort) {}

  async execute(input: EvaluateOrderRiskInput): Promise<OrderRiskEvaluation> {
    const strict = input.fraudStrictMode;
    let score = 0;

    const tenMin = new Date(Date.now() - 10 * 60 * 1000);
    const oneHour = new Date(Date.now() - 60 * 60 * 1000);

    if (input.ipAddress) {
      const ipCount = await this.velocity.countByIpSince(input.ipAddress, tenMin);
      if (ipCount > (strict ? 3 : 5)) score += 30;
    }

    if (input.guestEmail) {
      const eCount = await this.velocity.countByGuestEmailSince(input.guestEmail.toLowerCase(), oneHour);
      if (eCount > (strict ? 2 : 3)) score += 20;
    }

    if (input.guestPhone && input.guestPhone.trim().length > 0) {
      const pCount = await this.velocity.countByGuestPhoneSince(input.guestPhone.trim(), oneHour);
      if (pCount > (strict ? 2 : 3)) score += 20;
    }

    if (input.customerId) {
      const cCount = await this.velocity.countByCustomerSince(input.customerId, oneHour);
      if (cCount > (strict ? 2 : 3)) score += 15;
    }

    if (input.customerAccountCreatedAt) {
      const ageMs = Date.now() - input.customerAccountCreatedAt.getTime();
      if (ageMs < 24 * 60 * 60 * 1000) score += 15;
    }

    const bigOrderThreshold = strict ? 800_000 : 2_000_000;
    if (input.merchandiseTotalCop > bigOrderThreshold) score += 20;

    let tier: OrderRiskTier = 'LOW';
    if (score >= 80) tier = 'HIGH';
    else if (score >= 50) tier = 'MEDIUM';

    return { score, tier };
  }
}
