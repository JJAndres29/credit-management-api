export class FilterProductsDto {
  private constructor(
    public readonly search?: string,
    public readonly minPrice?: number,
    public readonly maxPrice?: number,
    public readonly minStock?: number,
    public readonly maxStock?: number,
  ) {}

  static create(object: Record<string, unknown>): [string?, FilterProductsDto?] {
    const { search, minPrice, maxPrice, minStock, maxStock } = object;

    if (search !== undefined && typeof search !== 'string') {
      return ['search debe ser una cadena de texto'];
    }

    let minPriceNum: number | undefined;
    if (minPrice !== undefined) {
      minPriceNum = parseFloat(String(minPrice));
      if (isNaN(minPriceNum) || minPriceNum < 0) {
        return ['minPrice debe ser un número mayor o igual a 0'];
      }
    }

    let maxPriceNum: number | undefined;
    if (maxPrice !== undefined) {
      maxPriceNum = parseFloat(String(maxPrice));
      if (isNaN(maxPriceNum) || maxPriceNum < 0) {
        return ['maxPrice debe ser un número mayor o igual a 0'];
      }
    }

    if (minPriceNum !== undefined && maxPriceNum !== undefined && minPriceNum > maxPriceNum) {
      return ['minPrice no puede ser mayor que maxPrice'];
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
        minPriceNum,
        maxPriceNum,
        minStockNum,
        maxStockNum,
      ),
    ];
  }
}
