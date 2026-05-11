export class UpdateVariantDto {
  private constructor(
    public readonly sku?: string | null,
    public readonly label?: string | null,
    public readonly stock?: number,
    public readonly retailPrice?: number | null,
    public readonly investmentCost?: number | null,
    public readonly isActive?: boolean,
  ) {}

  static create(object: Record<string, unknown>): [string?, UpdateVariantDto?] {
    const { sku, label, stock, retailPrice, investmentCost, isActive } = object;

    const hasAtLeastOne =
      sku !== undefined ||
      label !== undefined ||
      stock !== undefined ||
      retailPrice !== undefined ||
      investmentCost !== undefined ||
      isActive !== undefined;

    if (!hasAtLeastOne) {
      return ['Debe proporcionar al menos un campo para actualizar'];
    }

    let parsedSku: string | null | undefined;
    if (sku !== undefined) {
      if (sku === null) {
        parsedSku = null;
      } else if (typeof sku !== 'string') {
        return ['sku debe ser un string o null'];
      } else {
        parsedSku = sku.trim() || null;
      }
    }

    let parsedLabel: string | null | undefined;
    if (label !== undefined) {
      if (label === null) {
        parsedLabel = null;
      } else if (typeof label !== 'string') {
        return ['label debe ser un string o null'];
      } else {
        parsedLabel = label.trim() || null;
      }
    }

    let parsedStock: number | undefined;
    if (stock !== undefined) {
      parsedStock = Number(stock);
      if (!Number.isInteger(parsedStock) || parsedStock < 0) {
        return ['stock debe ser un entero >= 0'];
      }
    }

    let parsedRetailPrice: number | null | undefined;
    if (retailPrice !== undefined) {
      if (retailPrice === null) {
        parsedRetailPrice = null;
      } else {
        parsedRetailPrice = Number(retailPrice);
        if (isNaN(parsedRetailPrice) || parsedRetailPrice < 0) {
          return ['retailPrice debe ser un número >= 0'];
        }
      }
    }

    let parsedInvestmentCost: number | null | undefined;
    if (investmentCost !== undefined) {
      if (investmentCost === null) {
        parsedInvestmentCost = null;
      } else {
        parsedInvestmentCost = Number(investmentCost);
        if (isNaN(parsedInvestmentCost) || parsedInvestmentCost < 0) {
          return ['investmentCost debe ser un número >= 0'];
        }
      }
    }

    let parsedIsActive: boolean | undefined;
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return ['isActive debe ser un boolean'];
      }
      parsedIsActive = isActive;
    }

    return [
      undefined,
      new UpdateVariantDto(
        parsedSku,
        parsedLabel,
        parsedStock,
        parsedRetailPrice,
        parsedInvestmentCost,
        parsedIsActive,
      ),
    ];
  }
}
