import { Router } from 'express';
import { Role } from '../../domain/entities';
import {
  PrismaAuthDatasource,
  PrismaCategoryDatasource,
  PrismaMarketingToolsDatasource,
  PrismaProductDatasource,
  PrismaAnalyticsReadModelDatasource,
} from '../../infrastructure/datasources';
import {
  AuthRepositoryImpl,
  CategoryRepositoryImpl,
  MarketingToolsRepositoryImpl,
  ProductRepositoryImpl,
} from '../../infrastructure/repositories';
import { JwtAdapter } from '../../infrastructure/services';
import { AuthMiddleware, checkRole } from '../middlewares';
import {
  CreateDiscountCampaignUseCase,
  CreatePriceExperimentUseCase,
  GetRotationAlertsUseCase,
  ListDiscountCampaignsUseCase,
  ListPriceExperimentsUseCase,
} from '../../domain/use-cases/marketing';
import { AdminMarketingController } from './marketing.controller';

export class AdminMarketingRouter {
  static get routes(): Router {
    const router = Router();

    const marketingRepo = new MarketingToolsRepositoryImpl(new PrismaMarketingToolsDatasource());
    const categoryRepo = new CategoryRepositoryImpl(new PrismaCategoryDatasource());
    const productRepo = new ProductRepositoryImpl(new PrismaProductDatasource());
    const readModels = new PrismaAnalyticsReadModelDatasource();

    const controller = new AdminMarketingController(
      new CreateDiscountCampaignUseCase(marketingRepo, categoryRepo),
      new ListDiscountCampaignsUseCase(marketingRepo),
      new CreatePriceExperimentUseCase(marketingRepo, productRepo),
      new ListPriceExperimentsUseCase(marketingRepo),
      new GetRotationAlertsUseCase(readModels),
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    router.use(middleware.validateJwt, checkRole(Role.ADMIN));

    router.post('/discount-campaigns', controller.postDiscountCampaign);
    router.get('/discount-campaigns', controller.getDiscountCampaigns);
    router.post('/price-experiments', controller.postPriceExperiment);
    router.get('/price-experiments', controller.getPriceExperiments);
    router.get('/rotation-alerts', controller.getRotationAlerts);

    return router;
  }
}
