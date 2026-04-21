import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { GetDashboardUseCase } from '../../domain/use-cases/dashboard';
import { DashboardRepositoryImpl } from '../../infrastructure/repositories/dashboard.repository.impl';
import { PrismaDashboardDatasource } from '../../infrastructure/datasources/prisma-dashboard.datasource';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { AuthMiddleware } from '../middlewares';
import { JwtAdapter } from '../../infrastructure/services';

export class DashboardRouter {
  static get routes(): Router {
    const router = Router();

    const useCase = new GetDashboardUseCase(
      new DashboardRepositoryImpl(new PrismaDashboardDatasource()),
    );
    const controller = new DashboardController(useCase);

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    router.use(middleware.validateJwt);

    router.get('/', controller.get);

    return router;
  }
}
