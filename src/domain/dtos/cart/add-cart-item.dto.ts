export class AddCartItemDto {
  private constructor(
    public readonly productId: string,
    public readonly quantity: number,
  ) {}

  static create(object: Record<string, unknown>): [string?, AddCartItemDto?] {
    const { productId, quantity } = object;
    if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
      return ['productId es requerido'];
    }
    if (quantity === undefined || quantity === null) return ['quantity es requerido'];
    const q = Number(quantity);
    if (!Number.isInteger(q) || q < 1 || q > 999) return ['quantity debe ser entero 1–999'];

    return [undefined, new AddCartItemDto(productId.trim(), q)];
  }
}
