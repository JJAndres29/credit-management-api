export class CreateVariantDto {
  private constructor(
    public readonly productId: string,
    public readonly attributeValueIds: string[],
    public readonly stock: number,
    public readonly sku: string | null,
    public readonly label: string | null,
    public readonly retailPrice: number | null,
    public readonly investmentCost: number | null,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateVariantDto?] {
    const { productId, attributeValueIds, stock, sku, label, retailPrice, investmentCost } = object;

    if (!productId || typeof productId !== 'string') {
      return ['productId es requerido'];
    }

    if (!Array.isArray(attributeValueIds) || attributeValueIds.length === 0) {
      return ['attributeValueIds debe ser un arreglo con al menos un ID'];
    }

    for (const id of attributeValueIds) {
      if (typeof id !== 'string' || id.trim().length === 0) {
        return ['Cada attributeValueId debe ser un string no vacío'];
      }
    }

    const uniqueIds = new Set(attributeValueIds);
    if (uniqueIds.size !== attributeValueIds.length) {
      return ['attributeValueIds contiene IDs duplicados'];
    }

    if (stock === undefined || stock === null) {
      return ['stock es requerido'];
    }
    const parsedStock = Number(stock);
    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      return ['stock debe ser un entero >= 0'];
    }

    let parsedSku: string | null = null;
    if (sku !== undefined && sku !== null) {
      if (typeof sku !== 'string') return ['sku debe ser un string'];
      parsedSku = sku.trim() || null;
    }

    let parsedLabel: string | null = null;
    if (label !== undefined && label !== null) {
      if (typeof label !== 'string') return ['label debe ser un string'];
      parsedLabel = label.trim() || null;
    }

    let parsedRetailPrice: number | null = null;
    if (retailPrice !== undefined && retailPrice !== null) {
      parsedRetailPrice = Number(retailPrice);
      if (isNaN(parsedRetailPrice) || parsedRetailPrice < 0) {
        return ['retailPrice debe ser un número >= 0'];
      }
    }

    let parsedInvestmentCost: number | null = null;
    if (investmentCost !== undefined && investmentCost !== null) {
      parsedInvestmentCost = Number(investmentCost);
      if (isNaN(parsedInvestmentCost) || parsedInvestmentCost < 0) {
        return ['investmentCost debe ser un número >= 0'];
      }
    }

    return [
      undefined,
      new CreateVariantDto(
        productId as string,
        attributeValueIds as string[],
        parsedStock,
        parsedSku,
        parsedLabel,
        parsedRetailPrice,
        parsedInvestmentCost,
      ),
    ];
  }
}
