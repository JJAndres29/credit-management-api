export class UpdateCartItemDto {
  private constructor(public readonly quantity: number) {}

  static create(object: Record<string, unknown>): [string?, UpdateCartItemDto?] {
    const { quantity } = object;
    if (quantity === undefined || quantity === null) return ['quantity es requerido'];
    const q = Number(quantity);
    if (!Number.isInteger(q) || q < 0 || q > 999) {
      return ['quantity debe ser entero 0–999 (0 elimina la línea)'];
    }
    return [undefined, new UpdateCartItemDto(q)];
  }
}
