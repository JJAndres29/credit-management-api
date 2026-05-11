import { ProductImageEntity } from './product-image.entity';
import { ProductVariantEntity } from './product-variant.entity';

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
    /** kg por unidad (envío); null si no configurado */
    public readonly weightKg: number | null,
    public readonly images: ProductImageEntity[],
    public readonly categoryId: string | null,
    public readonly categoryName: string | null,
    public readonly attributes: ProductSelectedAttribute[],
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly slug: string | null = null,
    public readonly brand: string | null = null,
    public readonly metaTitle: string | null = null,
    public readonly metaDescription: string | null = null,
    public readonly categorySlug: string | null = null,
    public readonly variants: ProductVariantEntity[] = [],
  ) {}

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      stock: this.stock,
      retailPrice: this.retailPrice,
      investmentCost: this.investmentCost,
      weightKg: this.weightKg,
      images: this.images,
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      categorySlug: this.categorySlug,
      attributes: this.attributes.map((a) => ({ attribute: a.attribute, value: a.value })),
      variants: this.variants.map((v) => v.toJSON()),
      isActive: this.isActive,
      slug: this.slug,
      brand: this.brand,
      metaTitle: this.metaTitle,
      metaDescription: this.metaDescription,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromObject(object: Record<string, unknown>): ProductEntity {
    const {
      id,
      name,
      description,
      stock,
      retailPrice,
      investmentCost,
      weightKg,
      images,
      categoryId,
      category,
      attributes,
      variants,
      isActive,
      createdAt,
      updatedAt,
      slug,
      brand,
      metaTitle,
      metaDescription,
    } = object;

    if (!id) throw new Error('Product id is required');
    if (!name) throw new Error('Product name is required');

    const parsedImages = Array.isArray(images)
      ? images.map((img) => ProductImageEntity.fromObject(img as Record<string, unknown>))
      : [];

    const categoryName = category && typeof category === 'object'
      ? ((category as Record<string, unknown>).name as string | undefined) ?? null
      : null;

    const categorySlug = category && typeof category === 'object'
      ? ((category as Record<string, unknown>).slug as string | null | undefined) ?? null
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

    const parsedVariants: ProductVariantEntity[] = Array.isArray(variants)
      ? variants.map((v) => ProductVariantEntity.fromObject(v as Record<string, unknown>))
      : [];

    return new ProductEntity(
      id as string,
      name as string,
      (description as string | null | undefined) ?? null,
      Number(stock ?? 0),
      retailPrice != null ? Number(retailPrice) : null,
      investmentCost != null ? Number(investmentCost) : null,
      weightKg != null ? Number(weightKg) : null,
      parsedImages,
      (categoryId as string | null | undefined) ?? null,
      categoryName,
      parsedAttributes,
      (isActive as boolean) ?? true,
      (createdAt as Date) ?? new Date(),
      (updatedAt as Date) ?? new Date(),
      (slug as string | null | undefined) ?? null,
      (brand as string | null | undefined) ?? null,
      (metaTitle as string | null | undefined) ?? null,
      (metaDescription as string | null | undefined) ?? null,
      categorySlug,
      parsedVariants,
    );
  }
}
