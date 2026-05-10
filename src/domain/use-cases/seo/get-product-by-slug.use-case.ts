import { CustomError } from '../../errors';
import type {
  StorefrontCatalogReadPort,
  StorefrontProductSnapshot,
} from '../../services/storefront-catalog-read.port';
import { normalizeSlugParam, isValidSlugFormat } from '../../services/slug';
import { BuildProductSeoUseCase, type BuildProductSeoInput } from './build-product-seo.use-case';

export type GetProductBySlugResult =
  | { kind: 'redirect'; statusCode: 301; location: string }
  | {
      kind: 'ok';
      product: StorefrontProductSnapshot;
      pageTitle: string;
      pageDescription: string;
      jsonLd: Record<string, unknown>;
      canonicalUrl: string;
    };

export interface GetProductBySlugConfig {
  publicOrigin: string;
  productPathPrefix: string;
  categoryPathPrefix: string;
}

export class GetProductBySlugUseCase {
  constructor(
    private readonly catalog: StorefrontCatalogReadPort,
    private readonly buildSeo = new BuildProductSeoUseCase(),
  ) {}

  async execute(rawSlug: string, config: GetProductBySlugConfig): Promise<GetProductBySlugResult> {
    const slug = normalizeSlugParam(rawSlug);
    if (!isValidSlugFormat(slug)) {
      throw CustomError.badRequest('Slug inválido');
    }

    const redirect = await this.catalog.findProductSlugRedirect(slug);
    if (redirect) {
      const location = this.absUrl(
        config.publicOrigin,
        `${config.productPathPrefix}/${encodeURIComponent(redirect.newSlug)}`,
      );
      return { kind: 'redirect', statusCode: 301, location };
    }

    let snap =
      (await this.catalog.findActiveProductBySlug(slug)) ??
      (await this.catalog.findActiveProductByVariantSlug(slug));

    if (!snap) throw CustomError.notFound('Producto no encontrado');

    const origin = config.publicOrigin.replace(/\/$/, '');
    const pPrefix = config.productPathPrefix.startsWith('/')
      ? config.productPathPrefix
      : `/${config.productPathPrefix}`;
    const cPrefix = config.categoryPathPrefix.startsWith('/')
      ? config.categoryPathPrefix
      : `/${config.categoryPathPrefix}`;

    const canonicalUrl = `${origin}${pPrefix}/${encodeURIComponent(snap.slug)}`;

    const breadcrumb: BuildProductSeoInput['breadcrumb'] = [
      { name: 'Inicio', item: `${origin}/` },
    ];
    if (snap.category?.slug) {
      breadcrumb.push({
        name: snap.category.name,
        item: `${origin}${cPrefix}/${encodeURIComponent(snap.category.slug)}`,
      });
    }
    breadcrumb.push({ name: snap.name, item: canonicalUrl });

    const jsonLd = this.buildSeo.execute({
      name: snap.name,
      description: snap.description,
      brand: snap.brand,
      sku: snap.displaySku,
      imageUrls: snap.imageUrls,
      price: snap.retailPrice,
      currency: snap.currencyCode || 'COP',
      inStock: snap.stock > 0,
      canonicalUrl,
      breadcrumb,
    });

    const pageTitle = snap.metaTitle?.trim() || snap.name;
    const pageDescription =
      snap.metaDescription?.trim() || snap.description?.trim() || pageTitle;

    return {
      kind: 'ok',
      product: snap,
      pageTitle,
      pageDescription,
      jsonLd,
      canonicalUrl,
    };
  }

  private absUrl(origin: string, path: string): string {
    const base = origin.replace(/\/$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  }
}
