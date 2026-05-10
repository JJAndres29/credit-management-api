import { prisma } from '../../config/prisma';
import {
  CouponAdminDatasource,
  CouponAdminCreateRow,
} from '../../domain/datasources/coupon-admin.datasource';

export class PrismaCouponAdminDatasource implements CouponAdminDatasource {
  async create(row: CouponAdminCreateRow): Promise<{ id: string; code: string }> {
    const created = await prisma.coupon.create({
      data: {
        code: row.code,
        type: row.type,
        value: row.value,
        scope: row.scope,
        categoryId: row.categoryId,
        productId: row.productId,
        maxUses: row.maxUses,
        perCustomerLimit: row.perCustomerLimit,
        minOrderAmount: row.minOrderAmount,
        validFrom: row.validFrom,
        validUntil: row.validUntil,
      },
      select: { id: true, code: true },
    });
    return created;
  }
}
