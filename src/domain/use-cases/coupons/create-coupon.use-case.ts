import { CustomError } from '../../errors';
import { CreateCouponDto } from '../../dtos/admin/create-coupon.dto';
import { CouponAdminDatasource } from '../../datasources/coupon-admin.datasource';

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object'
    && e !== null
    && 'code' in e
    && (e as { code?: string }).code === 'P2002'
  );
}

export class CreateCouponUseCase {
  constructor(private readonly coupons: CouponAdminDatasource) {}

  async execute(dto: CreateCouponDto) {
    try {
      return await this.coupons.create({
        code: dto.code,
        type: dto.type,
        value: dto.value,
        scope: dto.scope,
        categoryId: dto.categoryId,
        productId: dto.productId,
        maxUses: dto.maxUses,
        perCustomerLimit: dto.perCustomerLimit,
        minOrderAmount: dto.minOrderAmount,
        validFrom: dto.validFromIso ? new Date(dto.validFromIso) : null,
        validUntil: dto.validUntilIso ? new Date(dto.validUntilIso) : null,
      });
    } catch (e: unknown) {
      if (isUniqueViolation(e)) {
        throw CustomError.conflict('Ya existe un cupón con ese código');
      }
      throw e;
    }
  }
}
