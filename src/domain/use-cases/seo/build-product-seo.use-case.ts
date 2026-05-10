/**
 * P4 — Pure builder for Schema.org JSON-LD (Product + BreadcrumbList).
 * No I/O; callers supply absolute URLs for canonical + breadcrumb items.
 */

export interface ProductSeoBreadcrumbItem {
  name: string;
  /** Absolute URL for this crumb (e.g. category page or home). */
  item: string;
}

export interface BuildProductSeoInput {
  name: string;
  description: string | null;
  brand: string | null;
  sku: string | null;
  imageUrls: string[];
  price: number | null;
  currency: string;
  inStock: boolean;
  /** Page URL for this product (canonical). */
  canonicalUrl: string;
  breadcrumb: ProductSeoBreadcrumbItem[];
}

export class BuildProductSeoUseCase {
  execute(input: BuildProductSeoInput): Record<string, unknown> {
    const availability = input.inStock
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock';

    const desc = input.description?.trim();
    const productNode: Record<string, unknown> = {
      '@type': 'Product',
      name: input.name,
      ...(desc ? { description: desc } : {}),
      ...(input.brand ? { brand: { '@type': 'Brand', name: input.brand } } : {}),
      ...(input.imageUrls.length > 0 ? { image: input.imageUrls } : {}),
      ...(input.sku ? { sku: input.sku } : {}),
      offers: {
        '@type': 'Offer',
        url: input.canonicalUrl,
        priceCurrency: input.currency,
        availability,
        ...(input.price != null ? { price: input.price } : {}),
      },
    };

    const breadcrumbNode: Record<string, unknown> = {
      '@type': 'BreadcrumbList',
      itemListElement: input.breadcrumb.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: b.item,
      })),
    };

    return {
      '@context': 'https://schema.org',
      '@graph': [productNode, breadcrumbNode],
    };
  }
}
