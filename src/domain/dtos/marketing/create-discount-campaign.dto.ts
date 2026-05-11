const MAX_NAME = 120;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class CreateDiscountCampaignDto {
  private constructor(
    public readonly name: string,
    public readonly categoryId: string | null,
    public readonly percentOff: number,
    public readonly startsAt: Date,
    public readonly endsAt: Date,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateDiscountCampaignDto?] {
    const { name, categoryId, percentOff, startsAt, endsAt } = object;
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return ['name es requerido'];
    }
    if (name.trim().length > MAX_NAME) {
      return [`name máximo ${MAX_NAME}`];
    }
    if (categoryId !== undefined && categoryId !== null) {
      if (typeof categoryId !== 'string' || !UUID_V4.test(categoryId.trim())) {
        return ['categoryId debe ser UUID v4 o null'];
      }
    }
    if (typeof percentOff !== 'number' || !Number.isFinite(percentOff) || percentOff <= 0 || percentOff > 100) {
      return ['percentOff debe estar entre 0 y 100'];
    }
    if (typeof startsAt !== 'string' && !(startsAt instanceof Date)) {
      return ['startsAt debe ser ISO 8601'];
    }
    if (typeof endsAt !== 'string' && !(endsAt instanceof Date)) {
      return ['endsAt debe ser ISO 8601'];
    }
    const s = startsAt instanceof Date ? startsAt : new Date(String(startsAt));
    const e = endsAt instanceof Date ? endsAt : new Date(String(endsAt));
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      return ['fechas inválidas'];
    }
    if (e <= s) {
      return ['endsAt debe ser posterior a startsAt'];
    }
    const cat =
      categoryId === undefined || categoryId === null ? null : (categoryId as string).trim();
    return [undefined, new CreateDiscountCampaignDto(name.trim(), cat, percentOff, s, e)];
  }
}
