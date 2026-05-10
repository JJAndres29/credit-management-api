import { prisma } from '../../config/prisma';
import type {
  StorefrontCatalogReadPort,
  StorefrontCategorySnapshot,
  StorefrontProductSnapshot,
  SitemapUrlEntry,
} from '../../domain/services/storefront-catalog-read.port';

const productInclude = {
  category: true,
  images: { orderBy: { order: 'asc' as const } },
  variants: {
    where: { isDefault: true },
    take: 1,
  },
} as const;

function mapProduct(
  p: {
    id: string;
    name: string;
    description: string | null;
    slug: string | null;
    brand: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    retailPrice: { toString(): string } | null;
    currencyCode: string;
    stock: number;
    updatedAt: Date;
    category: {
      id: string;
      name: string;
      slug: string | null;
    } | null;
    images: { url: string }[];
    variants: { id: string; slug: string | null; sku: string | null }[];
  },
  canonicalSlug: string,
  matchedByVariantSlug: string | null,
  displaySku: string | null,
): StorefrontProductSnapshot {
  const def = p.variants[0] ?? null;
  return {
    productId: p.id,
    name: p.name,
    description: p.description,
    slug: canonicalSlug,
    brand: p.brand,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    retailPrice: p.retailPrice != null ? Number(p.retailPrice.toString()) : null,
    currencyCode: p.currencyCode,
    stock: p.stock,
    imageUrls: p.images.map((i) => i.url),
    category: p.category
      ? { id: p.category.id, name: p.category.name, slug: p.category.slug }
      : null,
    defaultVariant: def
      ? { id: def.id, slug: def.slug, sku: def.sku }
      : null,
    matchedByVariantSlug,
    displaySku,
    updatedAt: p.updatedAt,
  };
}

export class PrismaStorefrontCatalogDatasource implements StorefrontCatalogReadPort {
  async findProductSlugRedirect(oldSlug: string): Promise<{ newSlug: string } | null> {
    const row = await prisma.productSlugHistory.findUnique({
      where: { oldSlug },
      include: { product: true },
    });
    if (!row?.product.isActive || !row.product.slug) return null;
    return { newSlug: row.product.slug };
  }

  async findActiveProductBySlug(slug: string): Promise<StorefrontProductSnapshot | null> {
    const p = await prisma.product.findFirst({
      where: { slug, isActive: true },
      include: productInclude,
    });
    if (!p?.slug) return null;
    const sku = p.variants[0]?.sku ?? null;
    return mapProduct(p, p.slug, null, sku);
  }

  async findActiveProductByVariantSlug(slug: string): Promise<StorefrontProductSnapshot | null> {
    const v = await prisma.productVariant.findFirst({
      where: {
        slug,
        isActive: true,
        product: { isActive: true },
      },
      include: {
        product: { include: productInclude },
      },
    });
    if (!v) return null;
    const p = v.product;
    const canonical = p.slug ?? v.slug;
    if (!canonical) return null;
    const displaySku = v.sku ?? p.variants[0]?.sku ?? null;
    const matched = v.slug ?? slug;
    return mapProduct(p, canonical, matched, displaySku);
  }

  async findCategoryBySlug(slug: string): Promise<StorefrontCategorySnapshot | null> {
    const c = await prisma.category.findFirst({
      where: { slug },
    });
    if (!c?.slug) return null;
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      metaTitle: c.metaTitle,
      metaDescription: c.metaDescription,
      updatedAt: c.updatedAt,
    };
  }

  async listActiveProductSlugEntries(): Promise<SitemapUrlEntry[]> {
    const rows = await prisma.product.findMany({
      where: { isActive: true, slug: { not: null } },
      select: { slug: true, updatedAt: true },
    });
    return rows
      .filter((r): r is { slug: string; updatedAt: Date } => r.slug != null && r.slug.length > 0)
      .map((r) => ({ locPath: r.slug, lastmod: r.updatedAt }));
  }

  async listActiveCategorySlugEntries(): Promise<SitemapUrlEntry[]> {
    const rows = await prisma.category.findMany({
      where: { slug: { not: null } },
      select: { slug: true, updatedAt: true },
    });
    return rows
      .filter((r): r is { slug: string; updatedAt: Date } => r.slug != null && r.slug.length > 0)
      .map((r) => ({ locPath: r.slug, lastmod: r.updatedAt }));
  }
}
