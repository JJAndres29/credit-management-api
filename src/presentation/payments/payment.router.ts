import { Router } from 'express';
import { PaymentController } from './payment.controller';
import {
  CreatePaymentUseCase,
  GetPaymentsUseCase,
  GetPaymentByIdUseCase,
  GetPaymentsByClientUseCase,
  GetPaymentsBySaleUseCase,
} from '../../domain/use-cases/payments';
import { PaymentRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaPaymentDatasource } from '../../infrastructure/datasources';
import { ClientRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaClientDatasource } from '../../infrastructure/datasources';
import { SaleRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaSaleDatasource } from '../../infrastructure/datasources';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { AuthMiddleware } from '../middlewares';
import { JwtAdapter } from '../../infrastructure/services';

export class PaymentRouter {
  static get routes(): Router {
    const router = Router();

    // Repositorios
    const paymentRepository = new PaymentRepositoryImpl(new PrismaPaymentDatasource());
    const clientRepository = new ClientRepositoryImpl(new PrismaClientDatasource());
    const saleRepository = new SaleRepositoryImpl(new PrismaSaleDatasource());

    const controller = new PaymentController(
      new CreatePaymentUseCase(paymentRepository, clientRepository, saleRepository),
      new GetPaymentsUseCase(paymentRepository),
      new GetPaymentByIdUseCase(paymentRepository),
      new GetPaymentsByClientUseCase(paymentRepository, clientRepository),
      new GetPaymentsBySaleUseCase(paymentRepository, saleRepository),
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    // JWT obligatorio en todas las rutas del módulo
    router.use(middleware.validateJwt);

    // GET  /api/payments
    router.get('/', controller.getAll);

    // GET  /api/payments/client/:clientId
    // Va ANTES de /:id para que Express no confunda "client" con un ID de pago
    router.get('/client/:clientId', controller.getByClient);

    // GET  /api/payments/sale/:saleId
    // Va ANTES de /:id por la misma razón
    router.get('/sale/:saleId', controller.getBySale);

    // GET  /api/payments/:id
    router.get('/:id', controller.getById);

    // POST /api/payments  — cualquier usuario autenticado puede registrar pagos
    router.post('/', controller.create);

    return router;
  }
}
