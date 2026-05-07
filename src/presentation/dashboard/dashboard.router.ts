import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { GetDashboardUseCase } from '../../domain/use-cases/dashboard';
import { GetMonthlySummaryUseCase } from '../../domain/use-cases/dashboard/get-monthly-summary.use-case';
import { DashboardRepositoryImpl } from '../../infrastructure/repositories/dashboard.repository.impl';
import { PrismaDashboardDatasource } from '../../infrastructure/datasources/prisma-dashboard.datasource';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { AuthMiddleware } from '../middlewares';
import { JwtAdapter } from '../../infrastructure/services';

export class DashboardRouter {
  static get routes(): Router {
    const router = Router();

    const datasource = new PrismaDashboardDatasource();
    const dashboardRepo = new DashboardRepositoryImpl(datasource);

    const getDashboardUseCase = new GetDashboardUseCase(dashboardRepo);
    const getMonthlySummaryUseCase = new GetMonthlySummaryUseCase(dashboardRepo);

    const controller = new DashboardController(getDashboardUseCase, getMonthlySummaryUseCase);

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    router.use(middleware.validateJwt);

    // Static segment /monthly-summary must come before any dynamic /:id routes.
    router.get('/monthly-summary', controller.getMonthlySummary);
    router.get('/', controller.get);

    return router;
  }
}
