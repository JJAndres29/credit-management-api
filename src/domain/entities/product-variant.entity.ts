export interface VariantAttributeValuePair {
  attributeId: string;
  attributeName: string;
  valueId: string;
  value: string;
}

export class ProductVariantEntity {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly sku: string | null,
    public readonly slug: string | null,
    public readonly label: string | null,
    public readonly stock: number,
    public readonly retailPrice: number | null,
    public readonly investmentCost: number | null,
    public readonly currencyCode: string,
    public readonly isDefault: boolean,
    public readonly isActive: boolean,
    public readonly attributeValues: VariantAttributeValuePair[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  toJSON() {
    return {
      id: this.id,
      productId: this.productId,
      sku: this.sku,
      slug: this.slug,
      label: this.label,
      stock: this.stock,
      retailPrice: this.retailPrice,
      investmentCost: this.investmentCost,
      currencyCode: this.currencyCode,
      isDefault: this.isDefault,
      isActive: this.isActive,
      attributeValues: this.attributeValues.map((av) => ({
        attributeId: av.attributeId,
        attributeName: av.attributeName,
        valueId: av.valueId,
        value: av.value,
      })),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromObject(object: Record<string, unknown>): ProductVariantEntity {
    const {
      id, productId, sku, slug, label, stock, retailPrice, investmentCost,
      currencyCode, isDefault, isActive, attributeValues, createdAt, updatedAt,
    } = object;

    if (!id) throw new Error('ProductVariant id is required');
    if (!productId) throw new Error('ProductVariant productId is required');

    const parsedAttributeValues: VariantAttributeValuePair[] = Array.isArray(attributeValues)
      ? attributeValues
          .map((entry) => {
            const row = entry as Record<string, unknown>;
            const valueObj = row.value as Record<string, unknown> | undefined;
            if (!valueObj) return null;

            const attrObj = valueObj.attribute as Record<string, unknown> | undefined;
            if (!attrObj) return null;

            const attributeId = attrObj.id as string | undefined;
            const attributeName = attrObj.name as string | undefined;
            const valueId = valueObj.id as string | undefined;
            const valueName = valueObj.value as string | undefined;

            if (!attributeId || !attributeName || !valueId || !valueName) return null;

            return {
              attributeId,
              attributeName,
              valueId,
              value: valueName,
            };
          })
          .filter((entry): entry is VariantAttributeValuePair => entry !== null)
      : [];

    return new ProductVariantEntity(
      id as string,
      productId as string,
      (sku as string | null | undefined) ?? null,
      (slug as string | null | undefined) ?? null,
      (label as string | null | undefined) ?? null,
      Number(stock ?? 0),
      retailPrice != null ? Number(retailPrice) : null,
      investmentCost != null ? Number(investmentCost) : null,
      (currencyCode as string | undefined) ?? 'COP',
      (isDefault as boolean | undefined) ?? false,
      (isActive as boolean | undefined) ?? true,
      parsedAttributeValues,
      (createdAt as Date) ?? new Date(),
      (updatedAt as Date) ?? new Date(),
    );
  }
}
