import { Router } from 'express';
import { ProductController } from './product.controller';
import {
  GetProductsUseCase,
  GetProductByIdUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  AdjustStockUseCase,
  UpdateRetailPriceUseCase,
  DeleteProductUseCase,
  UploadProductImagesUseCase,
  DeleteProductImageUseCase,
} from '../../domain/use-cases/products';
import { AssignProductAttributesUseCase, RemoveProductAttributeUseCase, ReplaceProductAttributesUseCase } from '../../domain/use-cases/categories';
import { CategoryRepositoryImpl, ProductRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaCategoryDatasource, PrismaProductDatasource } from '../../infrastructure/datasources';
import { CloudinaryAdapter } from '../../infrastructure/services';
import { AuthMiddleware, checkRole, uploadImages } from '../middlewares';
import { JwtAdapter } from '../../infrastructure/services';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { Role } from '../../domain/entities';

export class ProductRouter {
  static get routes(): Router {
    const router = Router();

    const repository = new ProductRepositoryImpl(new PrismaProductDatasource());
    const categoryRepository = new CategoryRepositoryImpl(new PrismaCategoryDatasource());
    const cloudinary = new CloudinaryAdapter();

    const controller = new ProductController(
      new GetProductsUseCase(repository),
      new GetProductByIdUseCase(repository),
      new CreateProductUseCase(repository, categoryRepository),
      new UpdateProductUseCase(repository, categoryRepository),
      new AdjustStockUseCase(repository),
      new UpdateRetailPriceUseCase(repository),
      new DeleteProductUseCase(repository),
      new UploadProductImagesUseCase(repository, cloudinary),
      new DeleteProductImageUseCase(repository, cloudinary),
      new AssignProductAttributesUseCase(repository, categoryRepository),
      new ReplaceProductAttributesUseCase(repository, categoryRepository),
      new RemoveProductAttributeUseCase(repository),
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    // Público
    router.get('/', controller.getAll);
    router.get('/:id', controller.getById);

    // Staff JWT + ADMIN
    router.post('/:id/attributes', middleware.validateJwt, checkRole(Role.ADMIN), controller.assignAttributes);
    router.put('/:id/attributes', middleware.validateJwt, checkRole(Role.ADMIN), controller.replaceAttributes);
    router.delete('/:id/attributes/:valueId', middleware.validateJwt, checkRole(Role.ADMIN), controller.deleteAttribute);
    router.post('/', middleware.validateJwt, checkRole(Role.ADMIN), controller.create);
    router.put('/:id', middleware.validateJwt, checkRole(Role.ADMIN), controller.update);
    router.patch('/:id/stock', middleware.validateJwt, checkRole(Role.ADMIN), controller.adjustStock);
    router.patch('/:id/retail-price', middleware.validateJwt, checkRole(Role.ADMIN), controller.updateRetailPrice);
    router.post('/:id/images', middleware.validateJwt, checkRole(Role.ADMIN), uploadImages, controller.uploadImages);
    router.delete('/:id/images/:imageId', middleware.validateJwt, checkRole(Role.ADMIN), controller.deleteImage);
    router.delete('/:id', middleware.validateJwt, checkRole(Role.ADMIN), controller.delete);

    return router;
  }
}
