import { ProductVariantEntity } from '../entities';

export interface VariantCreateData {
  productId: string;
  sku?: string | null;
  label?: string | null;
  stock: number;
  retailPrice?: number | null;
  investmentCost?: number | null;
  /** AttributeValue IDs that define this variant's combination (e.g. Color=Rojo + Tamaño=Doble). */
  attributeValueIds: string[];
}

export interface VariantUpdateData {
  sku?: string | null;
  label?: string | null;
  stock?: number;
  retailPrice?: number | null;
  investmentCost?: number | null;
  isActive?: boolean;
  /**
   * When set, replaces the variant's defining attribute combination (merged with product-level ProductAttribute).
   * Same rules as create: one value per CategoryAttribute; must not collide with another variant's hash.
   */
  attributeValueIds?: string[];
}

export interface VariantDatasource {
  findByProductId(productId: string): Promise<ProductVariantEntity[]>;
  findById(id: string): Promise<ProductVariantEntity | null>;
  /**
   * Creates a non-default variant for a product.
   * Computes attributeHash from sorted valueIds and enforces uniqueness within the product.
   */
  create(data: VariantCreateData): Promise<ProductVariantEntity>;
  update(id: string, data: VariantUpdateData): Promise<ProductVariantEntity>;
  /**
   * Deletes a non-default variant. Default variants cannot be deleted.
   */
  delete(id: string): Promise<ProductVariantEntity>;
}
