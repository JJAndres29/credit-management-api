const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class FilterProductsDto {
  private constructor(
    public readonly search?: string,
    public readonly minStock?: number,
    public readonly maxStock?: number,
    public readonly categoryId?: string,
    public readonly inStock?: boolean,
  ) {}

  static create(object: Record<string, unknown>): [string?, FilterProductsDto?] {
    const { search, minStock, maxStock, categoryId, inStock } = object;

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

    let categoryIdStr: string | undefined;
    if (categoryId !== undefined) {
      if (typeof categoryId !== 'string' || !UUID_V4.test(categoryId)) {
        return ['categoryId debe ser un UUID v4 válido'];
      }
      categoryIdStr = categoryId;
    }

    let inStockBool: boolean | undefined;
    if (inStock !== undefined) {
      if (inStock === 'true' || inStock === true) inStockBool = true;
      else if (inStock === 'false' || inStock === false) inStockBool = false;
      else return ['inStock debe ser true o false'];
    }

    return [
      undefined,
      new FilterProductsDto(
        search ? (search as string).trim() : undefined,
        minStockNum,
        maxStockNum,
        categoryIdStr,
        inStockBool,
      ),
    ];
  }
}
