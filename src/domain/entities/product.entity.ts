import { ProductImageEntity } from './product-image.entity';

export interface ProductSelectedAttribute {
  attribute: string;
  value: string;
}

/** Shape of each entry in `attributes` in API JSON (scalar strings). */
export interface ProductAttributeValue {
  attribute: string;
  value: string;
}

export class ProductEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly stock: number,
    public readonly retailPrice: number | null,
    public readonly investmentCost: number | null,
    public readonly images: ProductImageEntity[],
    public readonly categoryId: string | null,
    public readonly categoryName: string | null,
    public readonly attributes: ProductSelectedAttribute[],
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      stock: this.stock,
      retailPrice: this.retailPrice,
      investmentCost: this.investmentCost,
      images: this.images,
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      attributes: this.attributes.map((a) => ({ attribute: a.attribute, value: a.value })),
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromObject(object: Record<string, unknown>): ProductEntity {
    const { id, name, description, stock, retailPrice, investmentCost, images, categoryId, category, attributes, isActive, createdAt, updatedAt } = object;

    if (!id) throw new Error('Product id is required');
    if (!name) throw new Error('Product name is required');

    const parsedImages = Array.isArray(images)
      ? images.map((img) => ProductImageEntity.fromObject(img as Record<string, unknown>))
      : [];

    const categoryName = category && typeof category === 'object'
      ? ((category as Record<string, unknown>).name as string | undefined) ?? null
      : null;

    const parsedAttributes = Array.isArray(attributes)
      ? attributes
          .map((entry) => {
            const relation = entry as Record<string, unknown>;
            const valueObj = relation.value as Record<string, unknown> | undefined;
            const attributeObj = valueObj?.attribute as Record<string, unknown> | undefined;
            const attributeName = attributeObj?.name;
            const valueName = valueObj?.value;

            if (typeof attributeName !== 'string' || typeof valueName !== 'string') return null;

            return { attribute: attributeName, value: valueName };
          })
          .filter((entry): entry is ProductSelectedAttribute => entry !== null)
      : [];

    return new ProductEntity(
      id as string,
      name as string,
      (description as string | null | undefined) ?? null,
      Number(stock ?? 0),
      retailPrice != null ? Number(retailPrice) : null,
      investmentCost != null ? Number(investmentCost) : null,
      parsedImages,
      (categoryId as string | null | undefined) ?? null,
      categoryName,
      parsedAttributes,
      (isActive as boolean) ?? true,
      (createdAt as Date) ?? new Date(),
      (updatedAt as Date) ?? new Date(),
    );
  }
}
