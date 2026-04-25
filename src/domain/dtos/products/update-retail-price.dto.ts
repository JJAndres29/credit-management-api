export class UpdateRetailPriceDto {
  private constructor(
    public readonly retailPrice: number | null,
  ) {}

  static create(object: Record<string, unknown>): [string?, UpdateRetailPriceDto?] {
    if (!('retailPrice' in object)) {
      return ['El campo retailPrice es requerido'];
    }

    const { retailPrice } = object;

    if (retailPrice !== null) {
      if (typeof retailPrice !== 'number' || retailPrice <= 0) {
        return ['El precio de vitrina debe ser un número mayor a 0'];
      }

      if (Math.round(retailPrice * 100) / 100 !== retailPrice) {
        return ['El precio de vitrina no puede tener más de 2 decimales'];
      }
    }

    return [undefined, new UpdateRetailPriceDto(retailPrice as number | null)];
  }
}
