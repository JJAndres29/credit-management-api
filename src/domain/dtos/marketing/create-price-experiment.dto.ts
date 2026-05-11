const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_NAME = 120;
const MAX_COHORT = 80;

export class CreatePriceExperimentDto {
  private constructor(
    public readonly productId: string,
    public readonly name: string,
    public readonly cohortKey: string | null,
    public readonly priceA: number,
    public readonly priceB: number,
    public readonly startAt: Date,
    public readonly endAt: Date,
    public readonly winnerCriteria: 'REVENUE' | 'CONVERSION_RATE',
  ) {}

  static create(object: Record<string, unknown>): [string?, CreatePriceExperimentDto?] {
    const { productId, name, cohortKey, priceA, priceB, startAt, endAt, winnerCriteria } = object;
    if (!productId || typeof productId !== 'string' || !UUID_V4.test(productId.trim())) {
      return ['productId UUID v4 requerido'];
    }
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return ['name es requerido'];
    }
    if (name.trim().length > MAX_NAME) {
      return [`name máximo ${MAX_NAME}`];
    }
    let ck: string | null = null;
    if (cohortKey !== undefined && cohortKey !== null) {
      if (typeof cohortKey !== 'string' || cohortKey.trim().length > MAX_COHORT) {
        return [`cohortKey máximo ${MAX_COHORT}`];
      }
      ck = cohortKey.trim();
    }
    if (typeof priceA !== 'number' || !Number.isFinite(priceA) || priceA <= 0) {
      return ['priceA > 0'];
    }
    if (typeof priceB !== 'number' || !Number.isFinite(priceB) || priceB <= 0) {
      return ['priceB > 0'];
    }
    if (typeof startAt !== 'string' && !(startAt instanceof Date)) {
      return ['startAt ISO requerido'];
    }
    if (typeof endAt !== 'string' && !(endAt instanceof Date)) {
      return ['endAt ISO requerido'];
    }
    const s = startAt instanceof Date ? startAt : new Date(String(startAt));
    const e = endAt instanceof Date ? endAt : new Date(String(endAt));
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      return ['fechas inválidas'];
    }
    if (e <= s) {
      return ['endAt debe ser posterior a startAt'];
    }
    const wc = winnerCriteria === 'CONVERSION_RATE' ? 'CONVERSION_RATE' : 'REVENUE';
    return [
      undefined,
      new CreatePriceExperimentDto(productId.trim(), name.trim(), ck, priceA, priceB, s, e, wc),
    ];
  }
}
