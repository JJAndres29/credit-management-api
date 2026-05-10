export class CreateCouponDto {
  private constructor(
    public readonly code: string,
    public readonly type: 'PERCENT' | 'FIXED',
    public readonly value: number,
    public readonly scope: 'ORDER' | 'CATEGORY' | 'PRODUCT',
    public readonly categoryId: string | null,
    public readonly productId: string | null,
    public readonly maxUses: number | null,
    public readonly perCustomerLimit: number | null,
    public readonly minOrderAmount: number | null,
    public readonly validFromIso: string | null,
    public readonly validUntilIso: string | null,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateCouponDto?] {
    const {
      code,
      type,
      value,
      scope,
      categoryId,
      productId,
      maxUses,
      perCustomerLimit,
      minOrderAmount,
      validFrom,
      validUntil,
    } = object;

    if (!code || typeof code !== 'string' || code.trim().length < 2) return ['code es requerido'];
    if (!type || (type !== 'PERCENT' && type !== 'FIXED')) return ['type debe ser PERCENT o FIXED'];
    if (value === undefined || value === null) return ['value es requerido'];
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return ['value inválido'];
    if (type === 'PERCENT' && v > 100) return ['PERCENT no puede exceder 100'];

    let sc: 'ORDER' | 'CATEGORY' | 'PRODUCT' = 'ORDER';
    if (scope != null) {
      const s = String(scope).toUpperCase();
      if (!['ORDER', 'CATEGORY', 'PRODUCT'].includes(s)) return ['scope inválido'];
      sc = s as 'ORDER' | 'CATEGORY' | 'PRODUCT';
    }

    let cat: string | null = null;
    if (categoryId != null) {
      if (typeof categoryId !== 'string') return ['categoryId inválido'];
      cat = categoryId.trim() || null;
    }
    let prod: string | null = null;
    if (productId != null) {
      if (typeof productId !== 'string') return ['productId inválido'];
      prod = productId.trim() || null;
    }

    if (sc === 'CATEGORY' && !cat) return ['categoryId requerido para scope CATEGORY'];
    if (sc === 'PRODUCT' && !prod) return ['productId requerido para scope PRODUCT'];

    let maxU: number | null = null;
    if (maxUses !== undefined && maxUses !== null) {
      const m = Number(maxUses);
      if (!Number.isInteger(m) || m < 1) return ['maxUses inválido'];
      maxU = m;
    }

    let perC: number | null = null;
    if (perCustomerLimit !== undefined && perCustomerLimit !== null) {
      const p = Number(perCustomerLimit);
      if (!Number.isInteger(p) || p < 1) return ['perCustomerLimit inválido'];
      perC = p;
    }

    let minOrd: number | null = null;
    if (minOrderAmount !== undefined && minOrderAmount !== null) {
      const mo = Number(minOrderAmount);
      if (!Number.isFinite(mo) || mo < 0) return ['minOrderAmount inválido'];
      minOrd = mo;
    }

    let vf: string | null = null;
    if (validFrom != null && typeof validFrom === 'string' && validFrom.trim()) vf = validFrom.trim();
    let vu: string | null = null;
    if (validUntil != null && typeof validUntil === 'string' && validUntil.trim()) vu = validUntil.trim();

    return [
      undefined,
      new CreateCouponDto(
        code.trim().toUpperCase(),
        type as 'PERCENT' | 'FIXED',
        v,
        sc,
        cat,
        prod,
        maxU,
        perC,
        minOrd,
        vf,
        vu,
      ),
    ];
  }
}
