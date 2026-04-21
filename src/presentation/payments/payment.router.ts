import { Router } from 'express';
import { PaymentController } from './payment.controller';
import {
  CreatePaymentUseCase,
  GetPaymentsUseCase,
  GetPaymentByIdUseCase,
  GetPaymentsByClientUseCase,
  GetPaymentsBySaleUseCase,
  UpdatePaymentUseCase,
} from '../../domain/use-cases/payments';
import { PaymentRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaPaymentDatasource } from '../../infrastructure/datasources';
import { ClientRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaClientDatasource } from '../../infrastructure/datasources';
import { SaleRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaSaleDatasource } from '../../infrastructure/datasources';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { AuthMiddleware, checkRole } from '../middlewares';
import { Role } from '../../domain/entities';
import { JwtAdapter, MetaWhatsAppService, NodemailerEmailService, PdfkitPdfService } from '../../infrastructure/services';
import { globalLogger } from '../../infrastructure/services/pino-logger.service';
import { globalEventEmitter } from '../../infrastructure/events';
import { PaymentNotificationSubscriber } from '../../infrastructure/subscribers';
import { GenerateAccountStatementUseCase } from '../../domain/use-cases/reports';
import { ProductRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaProductDatasource } from '../../infrastructure/datasources';

export class PaymentRouter {
  static get routes(): Router {
    const router = Router();

    // Repositorios
    const paymentRepository = new PaymentRepositoryImpl(new PrismaPaymentDatasource());
    const clientRepository = new ClientRepositoryImpl(new PrismaClientDatasource());
    const saleRepository = new SaleRepositoryImpl(new PrismaSaleDatasource());

    // Servicios de notificación — se deshabilitan automáticamente si faltan las env vars
    const whatsAppService = new MetaWhatsAppService();
    const emailService = new NodemailerEmailService();

    // Use case de PDF para adjuntarlo al email de notificación de pago
    const productRepository = new ProductRepositoryImpl(new PrismaProductDatasource());
    const accountStatementUseCase = new GenerateAccountStatementUseCase(
      clientRepository,
      saleRepository,
      paymentRepository,
      productRepository,
      new PdfkitPdfService(),
    );

    // Subscriber: escucha PaymentRegistered y envía WhatsApp + Email (con PDF adjunto).
    // Se pasa null cuando el servicio no está configurado para evitar registros FAILED innecesarios.
    new PaymentNotificationSubscriber(
      globalEventEmitter,
      clientRepository,
      whatsAppService.isEnabled ? whatsAppService : null,
      emailService.isEnabled ? emailService : null,
      accountStatementUseCase,
      globalLogger,
    );

    const controller = new PaymentController(
      new CreatePaymentUseCase(paymentRepository, clientRepository, saleRepository, globalEventEmitter),
      new GetPaymentsUseCase(paymentRepository),
      new GetPaymentByIdUseCase(paymentRepository),
      new GetPaymentsByClientUseCase(paymentRepository, clientRepository),
      new GetPaymentsBySaleUseCase(paymentRepository, saleRepository),
      new UpdatePaymentUseCase(paymentRepository, clientRepository, saleRepository),
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

    // PUT  /api/payments/:id  — solo ADMIN puede modificar pagos existentes
    router.put('/:id', checkRole(Role.ADMIN), controller.update);

    return router;
  }
}
