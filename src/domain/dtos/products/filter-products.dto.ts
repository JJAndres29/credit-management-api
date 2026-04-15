export class FilterProductsDto {
  private constructor(
    public readonly search?: string,
    public readonly minStock?: number,
    public readonly maxStock?: number,
  ) {}

  static create(object: Record<string, unknown>): [string?, FilterProductsDto?] {
    const { search, minStock, maxStock } = object;

    if (search !== undefined && typeof search !== 'string') {
      return ['search debe ser una cadena de texto'];
    }

    let minStockNum: number | undefined;
    if (minStock !== undefined) {
      minStockNum = parseInt(String(minStock), 10);
      if (isNaN(minStockNum) || minStockNum < 0) {
        return ['minStock debe ser un entero mayor o igual a 0'];
      }
    }

    let maxStockNum: number | undefined;
    if (maxStock !== undefined) {
      maxStockNum = parseInt(String(maxStock), 10);
      if (isNaN(maxStockNum) || maxStockNum < 0) {
        return ['maxStock debe ser un entero mayor o igual a 0'];
      }
    }

    if (minStockNum !== undefined && maxStockNum !== undefined && minStockNum > maxStockNum) {
      return ['minStock no puede ser mayor que maxStock'];
    }

    return [
      undefined,
      new FilterProductsDto(
        search ? (search as string).trim() : undefined,
        minStockNum,
        maxStockNum,
      ),
    ];
  }
}
