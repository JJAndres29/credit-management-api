export type CouponAdminCreateRow = {
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  scope: 'ORDER' | 'CATEGORY' | 'PRODUCT';
  categoryId: string | null;
  productId: string | null;
  maxUses: number | null;
  perCustomerLimit: number | null;
  minOrderAmount: number | null;
  validFrom: Date | null;
  validUntil: Date | null;
};

export interface CouponAdminDatasource {
  create(row: CouponAdminCreateRow): Promise<{ id: string; code: string }>;
}
