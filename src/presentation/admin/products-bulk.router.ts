import { Router } from 'express';
import { Role } from '../../domain/entities';
import { PrismaAuthDatasource, PrismaProductDatasource } from '../../infrastructure/datasources';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { ProductRepositoryImpl } from '../../infrastructure/repositories/product.repository.impl';
import { JwtAdapter } from '../../infrastructure/services';
import { BulkSetProductsActiveUseCase } from '../../domain/use-cases/products';
import { AuthMiddleware, checkRole } from '../middlewares';
import { AdminProductsBulkController } from './products-bulk.controller';

export class AdminProductsBulkRouter {
  static get routes(): Router {
    const router = Router();
    const productRepo = new ProductRepositoryImpl(new PrismaProductDatasource());
    const controller = new AdminProductsBulkController(new BulkSetProductsActiveUseCase(productRepo));
    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );
    router.use(middleware.validateJwt, checkRole(Role.ADMIN));
    router.patch('/bulk-active', controller.patchBulkActive);
    return router;
  }
}
