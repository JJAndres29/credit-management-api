const MAX_STOCK_ADJUSTMENT = 100_000;

export class AdjustStockDto {
  private constructor(public readonly quantity: number) {}

  static create(object: Record<string, unknown>): [string?, AdjustStockDto?] {
    const { quantity } = object;

    if (quantity === undefined || quantity === null) {
      return ['La cantidad es requerida'];
    }

    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity === 0) {
      return ['La cantidad debe ser un número entero distinto de 0'];
    }
    if (Math.abs(quantity) > MAX_STOCK_ADJUSTMENT) {
      return [`La cantidad no puede superar +/-${MAX_STOCK_ADJUSTMENT}`];
    }

    return [undefined, new AdjustStockDto(quantity)];
  }
}
