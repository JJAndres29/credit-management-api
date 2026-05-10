import { Router } from 'express';
import { PrismaStorefrontCatalogDatasource } from '../../infrastructure/datasources/prisma-storefront-catalog.datasource';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { cachePublic } from '../middlewares';
import { SeoController } from './seo.controller';

export class SeoRouter {
  static get routes(): Router {
    const router = Router();
    const catalog = new PrismaStorefrontCatalogDatasource();
    const controller = new SeoController(catalog);

    router.get(
      '/sitemap.xml',
      RateLimitMiddleware.publicProductsReadLimiter,
      cachePublic({ maxAgeSeconds: 300 }),
      controller.sitemap,
    );
    router.get('/robots.txt', cachePublic({ maxAgeSeconds: 3600 }), controller.robots);

    return router;
  }
}
