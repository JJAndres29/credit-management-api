import { prisma } from '../../config/prisma';
import {
  ApplicableCoupon,
  CouponCartLine,
  CouponLookupPort,
} from '../../domain/services/coupon-lookup.port';

function appliesScope(
  coupon: { scope: string; categoryId: string | null; productId: string | null },
  lines: CouponCartLine[],
): boolean {
  if (coupon.scope === 'ORDER') return true;
  if (coupon.scope === 'PRODUCT' && coupon.productId) {
    return lines.some((l) => l.productId === coupon.productId);
  }
  if (coupon.scope === 'CATEGORY' && coupon.categoryId) {
    return lines.some((l) => l.categoryId === coupon.categoryId);
  }
  return false;
}

export class PrismaCouponLookupAdapter implements CouponLookupPort {
  async findApplicable(normalizedCode: string, ctx: {
    merchandiseTotalCop: number;
    lines: CouponCartLine[];
  }): Promise<ApplicableCoupon | null> {
    const code = normalizedCode.trim().toUpperCase();
    if (!code) return null;

    const coupon = await prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.isActive) return null;

    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) return null;
    if (coupon.validUntil && coupon.validUntil < now) return null;

    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return null;

    if (coupon.minOrderAmount != null && ctx.merchandiseTotalCop < Number(coupon.minOrderAmount)) {
      return null;
    }

    if (!appliesScope(coupon, ctx.lines)) return null;

    return {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type as ApplicableCoupon['type'],
      value: Number(coupon.value),
      scope: coupon.scope as ApplicableCoupon['scope'],
      categoryId: coupon.categoryId,
      productId: coupon.productId,
      minOrderAmount: coupon.minOrderAmount != null ? Number(coupon.minOrderAmount) : null,
    };
  }
}
