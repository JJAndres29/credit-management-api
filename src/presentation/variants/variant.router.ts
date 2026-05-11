import { Router } from 'express';
import { VariantController } from './variant.controller';
import {
  GetVariantsUseCase,
  CreateVariantUseCase,
  UpdateVariantUseCase,
  DeleteVariantUseCase,
} from '../../domain/use-cases/variants';
import { ProductRepositoryImpl } from '../../infrastructure/repositories';
import { VariantRepositoryImpl } from '../../infrastructure/repositories/variant.repository.impl';
import { PrismaProductDatasource } from '../../infrastructure/datasources';
import { PrismaVariantDatasource } from '../../infrastructure/datasources/prisma-variant.datasource';
import { AuthMiddleware, checkRole } from '../middlewares';
import { JwtAdapter } from '../../infrastructure/services';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { Role } from '../../domain/entities';

export class VariantRouter {
  static get routes(): Router {
    const router = Router({ mergeParams: true });

    const productRepository = new ProductRepositoryImpl(new PrismaProductDatasource());
    const variantRepository = new VariantRepositoryImpl(new PrismaVariantDatasource());

    const controller = new VariantController(
      new GetVariantsUseCase(productRepository, variantRepository),
      new CreateVariantUseCase(productRepository, variantRepository),
      new UpdateVariantUseCase(variantRepository),
      new DeleteVariantUseCase(variantRepository),
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    router.get('/', controller.getByProduct);

    router.post('/', middleware.validateJwt, checkRole(Role.ADMIN), controller.create);
    router.put('/:variantId', middleware.validateJwt, checkRole(Role.ADMIN), controller.update);
    router.delete('/:variantId', middleware.validateJwt, checkRole(Role.ADMIN), controller.delete);

    return router;
  }
}
