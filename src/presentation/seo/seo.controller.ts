import { Request, Response } from 'express';
import { envs } from '../../config/envs';
import type { StorefrontCatalogReadPort } from '../../domain/services/storefront-catalog-read.port';
import {
  BuildSitemapXmlUseCase,
  toAbsoluteSitemapUrls,
} from '../../domain/use-cases/seo';

export class SeoController {
  constructor(
    private readonly catalog: StorefrontCatalogReadPort,
    private readonly buildSitemapXml = new BuildSitemapXmlUseCase(),
  ) {}

  sitemap = async (_req: Request, res: Response): Promise<void> => {
    const [products, categories] = await Promise.all([
      this.catalog.listActiveProductSlugEntries(),
      this.catalog.listActiveCategorySlugEntries(),
    ]);

    const origin = envs.publicSiteUrl;
    const xml = this.buildSitemapXml.execute([
      {
        urls: toAbsoluteSitemapUrls(origin, envs.seoProductPathPrefix, products),
      },
      {
        urls: toAbsoluteSitemapUrls(origin, envs.seoCategoryPathPrefix, categories),
      },
    ]);

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  };

  robots = (_req: Request, res: Response): void => {
    const base = envs.publicSiteUrl.replace(/\/$/, '');
    const body = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      '',
      `Sitemap: ${base}/sitemap.xml`,
      '',
    ].join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(body);
  };
}
