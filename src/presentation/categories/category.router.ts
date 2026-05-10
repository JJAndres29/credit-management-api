import { Router } from 'express';
import { AuthMiddleware, cachePublic, checkRole } from '../middlewares';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { JwtAdapter } from '../../infrastructure/services';
import { AuthRepositoryImpl, CategoryRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource, PrismaCategoryDatasource } from '../../infrastructure/datasources';
import { Role } from '../../domain/entities';
import {
  CreateCategoryAttributeUseCase,
  CreateCategoryUseCase,
  DeleteCategoryAttributeUseCase,
  DeleteCategoryUseCase,
  GetCategoryAttributesUseCase,
  GetCategoriesUseCase,
  UpdateCategoryUseCase,
} from '../../domain/use-cases/categories';
import { CategoryController } from './category.controller';
import { PrismaStorefrontCatalogDatasource } from '../../infrastructure/datasources/prisma-storefront-catalog.datasource';
import { envs } from '../../config/envs';
import { GetCategoryBySlugUseCase } from '../../domain/use-cases/seo';

export class CategoryRouter {
  static get routes(): Router {
    const router = Router();

    const categoryRepository = new CategoryRepositoryImpl(new PrismaCategoryDatasource());
    const storefrontCatalog = new PrismaStorefrontCatalogDatasource();
    const categorySeoConfig = {
      publicOrigin: envs.publicSiteUrl,
      categoryPathPrefix: envs.seoCategoryPathPrefix,
    };

    const controller = new CategoryController(
      new CreateCategoryUseCase(categoryRepository),
      new GetCategoriesUseCase(categoryRepository),
      new UpdateCategoryUseCase(categoryRepository),
      new DeleteCategoryUseCase(categoryRepository),
      new CreateCategoryAttributeUseCase(categoryRepository),
      new GetCategoryAttributesUseCase(categoryRepository),
      new DeleteCategoryAttributeUseCase(categoryRepository),
      new GetCategoryBySlugUseCase(storefrontCatalog),
      categorySeoConfig,
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    // Público (estáticas antes de /:id/attributes)
    router.get(
      '/by-slug/:slug',
      RateLimitMiddleware.publicProductsReadLimiter,
      cachePublic({ maxAgeSeconds: 300 }),
      controller.getBySlug,
    );
    router.get('/', cachePublic({ maxAgeSeconds: 300 }), controller.getAll);
    router.get('/:id/attributes', controller.getCategoryAttributes);

    // Staff JWT + ADMIN
    router.post('/', middleware.validateJwt, checkRole(Role.ADMIN), controller.create);
    router.put('/:id', middleware.validateJwt, checkRole(Role.ADMIN), controller.update);
    router.delete('/:id', middleware.validateJwt, checkRole(Role.ADMIN), controller.delete);
    router.post('/:id/attributes', middleware.validateJwt, checkRole(Role.ADMIN), controller.createAttribute);

    return router;
  }
}
