import { CustomError } from '../../errors';
import type { StorefrontCatalogReadPort } from '../../services/storefront-catalog-read.port';
import { normalizeSlugParam, isValidSlugFormat } from '../../services/slug';
import type { StorefrontCategorySnapshot } from '../../services/storefront-catalog-read.port';

export interface GetCategoryBySlugConfig {
  publicOrigin: string;
  categoryPathPrefix: string;
}

export class GetCategoryBySlugUseCase {
  constructor(private readonly catalog: StorefrontCatalogReadPort) {}

  async execute(
    rawSlug: string,
    config: GetCategoryBySlugConfig,
  ): Promise<{
    category: StorefrontCategorySnapshot;
    pageTitle: string;
    pageDescription: string;
    canonicalUrl: string;
    jsonLd: Record<string, unknown>;
  }> {
    const slug = normalizeSlugParam(rawSlug);
    if (!isValidSlugFormat(slug)) {
      throw CustomError.badRequest('Slug inválido');
    }

    const category = await this.catalog.findCategoryBySlug(slug);
    if (!category) throw CustomError.notFound('Categoría no encontrada');

    const origin = config.publicOrigin.replace(/\/$/, '');
    const cPrefix = config.categoryPathPrefix.startsWith('/')
      ? config.categoryPathPrefix
      : `/${config.categoryPathPrefix}`;
    const canonicalUrl = `${origin}${cPrefix}/${encodeURIComponent(category.slug!)}`;

    const pageTitle = category.metaTitle?.trim() || category.name;
    const pageDescription =
      category.metaDescription?.trim() || category.description?.trim() || pageTitle;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: pageTitle,
      description: pageDescription,
      url: canonicalUrl,
    };

    return { category, pageTitle, pageDescription, canonicalUrl, jsonLd };
  }
}
