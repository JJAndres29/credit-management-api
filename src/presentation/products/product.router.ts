import { Router } from 'express';
import { ProductController } from './product.controller';
import {
  GetProductsUseCase,
  GetProductByIdUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  AdjustStockUseCase,
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

    // Todas las rutas requieren autenticación
    router.use(middleware.validateJwt);

    // GET /api/products
    router.get('/', controller.getAll);

    // GET /api/products/:id
    router.get('/:id', controller.getById);

    // POST /api/products/:id/attributes
    router.post('/:id/attributes', checkRole(Role.ADMIN), controller.assignAttributes);

    // PUT /api/products/:id/attributes
    router.put('/:id/attributes', checkRole(Role.ADMIN), controller.replaceAttributes);

    // DELETE /api/products/:id/attributes/:valueId
    router.delete('/:id/attributes/:valueId', checkRole(Role.ADMIN), controller.deleteAttribute);

    // POST /api/products
    router.post('/', checkRole(Role.ADMIN), controller.create);

    // PUT /api/products/:id
    router.put('/:id', checkRole(Role.ADMIN), controller.update);

    // PATCH /api/products/:id/stock
    router.patch('/:id/stock', checkRole(Role.ADMIN), controller.adjustStock);

    // POST /api/products/:id/images  — sube 1 a 5 imágenes
    router.post('/:id/images', checkRole(Role.ADMIN), uploadImages, controller.uploadImages);

    // DELETE /api/products/:id/images/:imageId
    router.delete('/:id/images/:imageId', checkRole(Role.ADMIN), controller.deleteImage);

    // DELETE /api/products/:id
    router.delete('/:id', checkRole(Role.ADMIN), controller.delete);

    return router;
  }
}
