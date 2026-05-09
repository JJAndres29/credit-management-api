import { Router } from 'express';
import { ClientController } from './client.controller';
import {
  CreateClientUseCase,
  GetClientsUseCase,
  GetClientByIdUseCase,
  UpdateClientUseCase,
  DeleteClientUseCase,
  NotifyClientUseCase,
} from '../../domain/use-cases/clients';
import { ClientRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaClientDatasource } from '../../infrastructure/datasources';
import { AuthMiddleware, checkRole } from '../middlewares';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { JwtAdapter, NodemailerEmailService, PdfkitPdfService } from '../../infrastructure/services';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { Role } from '../../domain/entities';
import { globalEventEmitter } from '../../infrastructure/events';
import { ClientNotifySubscriber } from '../../infrastructure/subscribers';
import { GenerateAccountStatementUseCase } from '../../domain/use-cases/reports';
import { SaleRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaSaleDatasource } from '../../infrastructure/datasources';
import { PaymentRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaPaymentDatasource } from '../../infrastructure/datasources';
import { ProductRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaProductDatasource } from '../../infrastructure/datasources';
import { globalLogger } from '../../infrastructure/services/pino-logger.service';

export class ClientRouter {
  static get routes(): Router {
    const router = Router();

    const clientRepository = new ClientRepositoryImpl(new PrismaClientDatasource());

    // Dependencias para el subscriber de notificación
    const emailService = new NodemailerEmailService();
    const saleRepository = new SaleRepositoryImpl(new PrismaSaleDatasource());
    const paymentRepository = new PaymentRepositoryImpl(new PrismaPaymentDatasource());
    const productRepository = new ProductRepositoryImpl(new PrismaProductDatasource());

    const accountStatementUseCase = new GenerateAccountStatementUseCase(
      clientRepository,
      saleRepository,
      paymentRepository,
      productRepository,
      new PdfkitPdfService(),
    );

    // Subscriber: escucha ClientNotifyRequested y envía email con PDF adjunto
    new ClientNotifySubscriber(
      globalEventEmitter,
      clientRepository,
      emailService.isEnabled ? emailService : null,
      accountStatementUseCase,
      globalLogger,
    );

    const controller = new ClientController(
      new CreateClientUseCase(clientRepository),
      new GetClientsUseCase(clientRepository),
      new GetClientByIdUseCase(clientRepository),
      new UpdateClientUseCase(clientRepository),
      new DeleteClientUseCase(clientRepository),
      new NotifyClientUseCase(clientRepository, globalEventEmitter, saleRepository, paymentRepository),
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    router.use(middleware.validateJwt);

    // GET  /api/clients
    router.get('/', controller.getAll);

    // GET  /api/clients/:id
    router.get('/:id', controller.getById);

    // POST /api/clients
    router.post('/', controller.create);

    // PUT  /api/clients/:id
    router.put('/:id', controller.update);

    // DELETE /api/clients/:id
    router.delete('/:id', checkRole(Role.ADMIN), controller.delete);

    // POST /api/clients/:id/notify — reenvía estado de cuenta por WhatsApp payload + email
    router.post('/:id/notify', RateLimitMiddleware.clientNotifyLimiter, controller.notify);

    return router;
  }
}
