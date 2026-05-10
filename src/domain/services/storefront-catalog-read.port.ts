/**
 * P4 — Read-only port for public storefront SEO (slug resolution, sitemap).
 * Implemented in infrastructure with Prisma; use cases depend only on this interface.
 */

export interface StorefrontCategoryRef {
  id: string;
  name: string;
  slug: string | null;
}

export interface StorefrontProductSnapshot {
  productId: string;
  name: string;
  description: string | null;
  slug: string;
  brand: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  retailPrice: number | null;
  currencyCode: string;
  stock: number;
  imageUrls: string[];
  category: StorefrontCategoryRef | null;
  defaultVariant: { id: string; slug: string | null; sku: string | null } | null;
  /** When the request matched `ProductVariant.slug` instead of `Product.slug`. */
  matchedByVariantSlug: string | null;
  /** SKU for structured data (matched variant when resolved via variant slug, else default). */
  displaySku: string | null;
  updatedAt: Date;
}

export interface StorefrontCategorySnapshot {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  updatedAt: Date;
}

export interface SitemapUrlEntry {
  locPath: string;
  lastmod: Date;
}

export interface StorefrontCatalogReadPort {
  findProductSlugRedirect(oldSlug: string): Promise<{ newSlug: string } | null>;
  findActiveProductBySlug(slug: string): Promise<StorefrontProductSnapshot | null>;
  findActiveProductByVariantSlug(slug: string): Promise<StorefrontProductSnapshot | null>;
  findCategoryBySlug(slug: string): Promise<StorefrontCategorySnapshot | null>;
  listActiveProductSlugEntries(): Promise<SitemapUrlEntry[]>;
  listActiveCategorySlugEntries(): Promise<SitemapUrlEntry[]>;
}
