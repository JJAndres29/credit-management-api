import { Router } from 'express';
import { Role } from '../../domain/entities';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { JwtAdapter } from '../../infrastructure/services';
import {
  PrismaAnalyticsReadModelDatasource,
  PrismaBusinessMetricsSnapshotDatasource,
} from '../../infrastructure/datasources';
import { globalEventEmitter } from '../../infrastructure/events';
import { AuthMiddleware, checkRole } from '../middlewares';
import {
  GetCohortRetentionUseCase,
  GetCustomerLtvReportUseCase,
  GetDailySalesSummaryUseCase,
  GetDeadStockReportUseCase,
  GetInventoryTurnoverReportUseCase,
  GetProfitabilityReportUseCase,
  GetTicketAverageUseCase,
  RefreshAnalyticsReadModelsUseCase,
} from '../../domain/use-cases/analytics';
import { EvaluateBusinessAlertsUseCase } from '../../domain/use-cases/business-alerts';
import { AdminAnalyticsController } from './analytics.controller';

export class AdminAnalyticsRouter {
  static get routes(): Router {
    const router = Router();

    const readModels = new PrismaAnalyticsReadModelDatasource();
    const metrics = new PrismaBusinessMetricsSnapshotDatasource();

    const controller = new AdminAnalyticsController(
      new RefreshAnalyticsReadModelsUseCase(readModels),
      new GetDailySalesSummaryUseCase(readModels),
      new GetProfitabilityReportUseCase(readModels),
      new GetDeadStockReportUseCase(readModels),
      new GetInventoryTurnoverReportUseCase(readModels),
      new GetCohortRetentionUseCase(readModels),
      new GetCustomerLtvReportUseCase(readModels),
      new GetTicketAverageUseCase(readModels),
      new EvaluateBusinessAlertsUseCase(readModels, metrics, globalEventEmitter),
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    router.use(middleware.validateJwt, checkRole(Role.ADMIN));

    router.post('/read-models/refresh', controller.refreshMaterializedViews);
    router.get('/daily-sales', controller.getDailySales);
    router.get('/profitability', controller.getProfitability);
    router.get('/dead-stock', controller.getDeadStock);
    router.get('/inventory-turnover', controller.getInventoryTurnover);
    router.get('/cohorts', controller.getCohorts);
    router.get('/customer-ltv', controller.getCustomerLtv);
    router.get('/ticket-average', controller.getTicketAverage);
    router.post('/business-alerts/evaluate', controller.evaluateBusinessAlerts);

    return router;
  }
}
