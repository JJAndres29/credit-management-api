import { Router } from 'express';
import { SaleController } from './sale.controller';
import { CreateSaleUseCase, GetSalesUseCase, GetSaleByIdUseCase, GetSalesByClientUseCase } from '../../domain/use-cases/sales';
import { SaleRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaSaleDatasource } from '../../infrastructure/datasources';
import { ClientRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaClientDatasource } from '../../infrastructure/datasources';
import { ProductRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaProductDatasource } from '../../infrastructure/datasources';
import { PaymentRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaPaymentDatasource } from '../../infrastructure/datasources';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { AuthMiddleware } from '../middlewares';
import { JwtAdapter, MetaWhatsAppService, NodemailerEmailService, PdfkitPdfService } from '../../infrastructure/services';
import { globalLogger } from '../../infrastructure/services/pino-logger.service';
import { InstallmentCalculatorService } from '../../domain/services/installments';
import { globalEventEmitter } from '../../infrastructure/events';
import { SaleNotificationSubscriber } from '../../infrastructure/subscribers';
import { GenerateAccountStatementUseCase } from '../../domain/use-cases/reports';

export class SaleRouter {
  static get routes(): Router {
    const router = Router();

    // Repositorios
    const saleRepository = new SaleRepositoryImpl(new PrismaSaleDatasource());
    const clientRepository = new ClientRepositoryImpl(new PrismaClientDatasource());
    const productRepository = new ProductRepositoryImpl(new PrismaProductDatasource());
    const paymentRepository = new PaymentRepositoryImpl(new PrismaPaymentDatasource());

    // Servicios de notificación — se deshabilitan automáticamente si faltan las env vars
    const whatsAppService = new MetaWhatsAppService();
    const emailService = new NodemailerEmailService();

    // Use case de PDF para adjuntarlo al email de notificación de venta
    const accountStatementUseCase = new GenerateAccountStatementUseCase(
      clientRepository,
      saleRepository,
      paymentRepository,
      productRepository,
      new PdfkitPdfService(),
    );

    // Subscriber: escucha CreditSaleCreated y envía WhatsApp + Email (con PDF adjunto).
    // Se pasa null cuando el servicio no está configurado para evitar registros FAILED innecesarios.
    new SaleNotificationSubscriber(
      globalEventEmitter,
      clientRepository,
      whatsAppService.isEnabled ? whatsAppService : null,
      emailService.isEnabled ? emailService : null,
      accountStatementUseCase,
      globalLogger,
    );

    const installmentCalculator = new InstallmentCalculatorService();

    const controller = new SaleController(
      new CreateSaleUseCase(
        saleRepository,
        clientRepository,
        productRepository,
        globalEventEmitter,
        installmentCalculator,
        paymentRepository,
      ),
      new GetSalesUseCase(saleRepository),
      new GetSaleByIdUseCase(saleRepository),
      new GetSalesByClientUseCase(saleRepository, clientRepository),
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    // JWT obligatorio en todas las rutas del módulo
    router.use(middleware.validateJwt);

    // GET  /api/sales
    router.get('/', controller.getAll);

    // GET  /api/sales/client/:clientId
    // IMPORTANTE: va ANTES de /:id para que Express no confunda "client"
    // con el id de una venta
    router.get('/client/:clientId', controller.getByClient);

    // GET  /api/sales/:id
    router.get('/:id', controller.getById);

    // POST /api/sales  — cualquier usuario autenticado puede crear ventas
    router.post('/', controller.create);

    return router;
  }
}
