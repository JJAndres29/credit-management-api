export type ApplicableCoupon = {
  id: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  scope: 'ORDER' | 'CATEGORY' | 'PRODUCT';
  categoryId: string | null;
  productId: string | null;
  minOrderAmount: number | null;
};

export type CouponCartLine = { productId: string; categoryId: string | null };

/**
 * Read-only coupon resolution for checkout. Atomic consumption happens in OnlineOrder create transaction.
 */
export interface CouponLookupPort {
  findApplicable(normalizedCode: string, ctx: {
    merchandiseTotalCop: number;
    lines: CouponCartLine[];
  }): Promise<ApplicableCoupon | null>;
}
