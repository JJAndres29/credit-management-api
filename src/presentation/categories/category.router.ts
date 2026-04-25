import { Router } from 'express';
import { AuthMiddleware, checkRole } from '../middlewares';
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

export class CategoryRouter {
  static get routes(): Router {
    const router = Router();

    const categoryRepository = new CategoryRepositoryImpl(new PrismaCategoryDatasource());
    const controller = new CategoryController(
      new CreateCategoryUseCase(categoryRepository),
      new GetCategoriesUseCase(categoryRepository),
      new UpdateCategoryUseCase(categoryRepository),
      new DeleteCategoryUseCase(categoryRepository),
      new CreateCategoryAttributeUseCase(categoryRepository),
      new GetCategoryAttributesUseCase(categoryRepository),
      new DeleteCategoryAttributeUseCase(categoryRepository),
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    router.use(middleware.validateJwt);

    router.post('/', checkRole(Role.ADMIN), controller.create);
    router.get('/', controller.getAll);
    router.put('/:id', checkRole(Role.ADMIN), controller.update);
    router.delete('/:id', checkRole(Role.ADMIN), controller.delete);

    router.post('/:id/attributes', checkRole(Role.ADMIN), controller.createAttribute);
    router.get('/:id/attributes', controller.getCategoryAttributes);

    return router;
  }
}
