import { Router } from 'express';
import { CollectionController } from './collection.controller';
import { GetCollectionsUseCase } from '../../domain/use-cases/collections';
import { InstallmentScheduleService } from '../../domain/services/installments';
import { SaleRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaSaleDatasource } from '../../infrastructure/datasources';
import { PaymentRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaPaymentDatasource } from '../../infrastructure/datasources';
import { ClientRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaClientDatasource } from '../../infrastructure/datasources';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { AuthMiddleware } from '../middlewares';
import { JwtAdapter } from '../../infrastructure/services';

export class CollectionRouter {
  static get routes(): Router {
    const router = Router();

    const saleRepository = new SaleRepositoryImpl(new PrismaSaleDatasource());
    const paymentRepository = new PaymentRepositoryImpl(new PrismaPaymentDatasource());
    const clientRepository = new ClientRepositoryImpl(new PrismaClientDatasource());
    const scheduleService = new InstallmentScheduleService();

    const useCase = new GetCollectionsUseCase(
      saleRepository,
      paymentRepository,
      clientRepository,
      scheduleService,
    );

    const controller = new CollectionController(useCase);

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    router.use(middleware.validateJwt);

    // GET /api/collections/installments
    // Query params: status?, clientId?, dueFrom?, dueTo?, month?, page?, limit?
    router.get('/installments', controller.getInstallments);

    return router;
  }
}
