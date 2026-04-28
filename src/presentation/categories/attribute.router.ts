import { Router } from 'express';
import { AuthMiddleware, checkRole } from '../middlewares';
import { JwtAdapter } from '../../infrastructure/services';
import { AuthRepositoryImpl, CategoryRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource, PrismaCategoryDatasource } from '../../infrastructure/datasources';
import { Role } from '../../domain/entities';
import {
  CreateAttributeValueUseCase,
  DeleteCategoryAttributeUseCase,
  DeleteAttributeValueUseCase,
  GetAttributeValuesUseCase,
  UpdateAttributeValueUseCase,
  UpdateCategoryAttributeUseCase,
} from '../../domain/use-cases/categories';
import { AttributeController } from './attribute.controller';

export class AttributeRouter {
  static get routes(): Router {
    const router = Router();

    const categoryRepository = new CategoryRepositoryImpl(new PrismaCategoryDatasource());
    const controller = new AttributeController(
      new DeleteCategoryAttributeUseCase(categoryRepository),
      new UpdateCategoryAttributeUseCase(categoryRepository),
      new CreateAttributeValueUseCase(categoryRepository),
      new GetAttributeValuesUseCase(categoryRepository),
      new DeleteAttributeValueUseCase(categoryRepository),
      new UpdateAttributeValueUseCase(categoryRepository),
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    router.delete('/attributes/:id', middleware.validateJwt, checkRole(Role.ADMIN), controller.deleteAttribute);
    router.put('/attributes/:id', middleware.validateJwt, checkRole(Role.ADMIN), controller.updateAttribute);
    router.post('/attributes/:id/values', middleware.validateJwt, checkRole(Role.ADMIN), controller.createValue);
    router.get('/attributes/:id/values', controller.getValues);
    router.put('/values/:id', middleware.validateJwt, checkRole(Role.ADMIN), controller.updateValue);
    router.delete('/values/:id', middleware.validateJwt, checkRole(Role.ADMIN), controller.deleteValue);

    return router;
  }
}
