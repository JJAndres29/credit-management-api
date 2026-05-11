import { Router } from 'express';
import { ProductController } from './product.controller';
import {
  GetProductsUseCase,
  GetProductByIdUseCase,
  CreateProductUseCase,
  QuickCreateProductUseCase,
  QuickCreateWithVariantsUseCase,
  UpdateProductUseCase,
  AdjustStockUseCase,
  UpdateRetailPriceUseCase,
  DeleteProductUseCase,
  UploadProductImagesUseCase,
  DeleteProductImageUseCase,
} from '../../domain/use-cases/products';
import { UploadProductAssetsUseCase } from '../../domain/use-cases/products/upload-product-assets.use-case';
import { DeleteProductAssetUseCase } from '../../domain/use-cases/products/delete-product-asset.use-case';
import { AssignProductAttributesUseCase, RemoveProductAttributeUseCase, ReplaceProductAttributesUseCase } from '../../domain/use-cases/categories';
import { CategoryRepositoryImpl, ProductRepositoryImpl } from '../../infrastructure/repositories';
import { VariantRepositoryImpl } from '../../infrastructure/repositories/variant.repository.impl';
import { PrismaCategoryDatasource, PrismaProductDatasource } from '../../infrastructure/datasources';
import { PrismaVariantDatasource } from '../../infrastructure/datasources/prisma-variant.datasource';
import { CloudinaryAdapter } from '../../infrastructure/services';
import { AuthMiddleware, cachePublic, checkRole, uploadImages, validateImageMagicBytes } from '../middlewares';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { JwtAdapter } from '../../infrastructure/services';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { PrismaStorefrontCatalogDatasource } from '../../infrastructure/datasources/prisma-storefront-catalog.datasource';
import { Role } from '../../domain/entities';
import { envs } from '../../config/envs';
import { GetProductBySlugUseCase } from '../../domain/use-cases/seo';
import { VariantRouter } from '../variants/variant.router';

export class ProductRouter {
  static get routes(): Router {
    const router = Router();

    const repository = new ProductRepositoryImpl(new PrismaProductDatasource());
    const categoryRepository = new CategoryRepositoryImpl(new PrismaCategoryDatasource());
    const variantRepository = new VariantRepositoryImpl(new PrismaVariantDatasource());
    const cloudinary = new CloudinaryAdapter();
    const storefrontCatalog = new PrismaStorefrontCatalogDatasource();
    const productSeoConfig = {
      publicOrigin: envs.publicSiteUrl,
      productPathPrefix: envs.seoProductPathPrefix,
      categoryPathPrefix: envs.seoCategoryPathPrefix,
    };

    const controller = new ProductController(
      new GetProductsUseCase(repository),
      new GetProductByIdUseCase(repository),
      new CreateProductUseCase(repository, categoryRepository),
      new QuickCreateProductUseCase(repository),
      new UpdateProductUseCase(repository, categoryRepository),
      new AdjustStockUseCase(repository),
      new UpdateRetailPriceUseCase(repository),
      new DeleteProductUseCase(repository),
      new UploadProductImagesUseCase(repository, cloudinary),
      new DeleteProductImageUseCase(repository, cloudinary),
      new AssignProductAttributesUseCase(repository, categoryRepository),
      new ReplaceProductAttributesUseCase(repository, categoryRepository),
      new RemoveProductAttributeUseCase(repository),
      new GetProductBySlugUseCase(storefrontCatalog),
      new QuickCreateWithVariantsUseCase(repository),
      new UploadProductAssetsUseCase(repository, variantRepository, cloudinary),
      new DeleteProductAssetUseCase(repository, cloudinary),
      productSeoConfig,
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    // Público (rutas estáticas antes de /:id)
    router.get(
      '/by-slug/:slug',
      RateLimitMiddleware.publicProductsReadLimiter,
      cachePublic({ maxAgeSeconds: 120 }),
      controller.getBySlug,
    );
    router.get('/', RateLimitMiddleware.publicProductsReadLimiter, cachePublic({ maxAgeSeconds: 120 }), controller.getAll);
    router.get('/:id', RateLimitMiddleware.publicProductsReadLimiter, cachePublic({ maxAgeSeconds: 120 }), controller.getById);

    // Variant sub-routes (nested under /:productId/variants)
    router.use('/:productId/variants', VariantRouter.routes);

    // Staff JWT + ADMIN
    router.post('/quick-create', middleware.validateJwt, checkRole(Role.ADMIN), controller.quickCreate);
    router.post('/quick-create-with-variants', middleware.validateJwt, checkRole(Role.ADMIN), controller.quickCreateWithVariants);
    router.post('/:id/attributes', middleware.validateJwt, checkRole(Role.ADMIN), controller.assignAttributes);
    router.put('/:id/attributes', middleware.validateJwt, checkRole(Role.ADMIN), controller.replaceAttributes);
    router.delete('/:id/attributes/:valueId', middleware.validateJwt, checkRole(Role.ADMIN), controller.deleteAttribute);
    router.post('/', middleware.validateJwt, checkRole(Role.ADMIN), controller.create);
    router.put('/:id', middleware.validateJwt, checkRole(Role.ADMIN), controller.update);
    router.patch('/:id/stock', middleware.validateJwt, checkRole(Role.ADMIN), controller.adjustStock);
    router.patch('/:id/retail-price', middleware.validateJwt, checkRole(Role.ADMIN), controller.updateRetailPrice);
    router.post('/:id/images', middleware.validateJwt, checkRole(Role.ADMIN), uploadImages, validateImageMagicBytes, controller.uploadImages);
    router.delete('/:id/images/:imageId', middleware.validateJwt, checkRole(Role.ADMIN), controller.deleteImage);
    router.post('/:id/assets', middleware.validateJwt, checkRole(Role.ADMIN), uploadImages, validateImageMagicBytes, controller.uploadAssets);
    router.delete('/:id/assets/:assetId', middleware.validateJwt, checkRole(Role.ADMIN), controller.deleteAsset);
    router.delete('/:id', middleware.validateJwt, checkRole(Role.ADMIN), controller.delete);

    return router;
  }
}
