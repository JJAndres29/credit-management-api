import { Router } from 'express';
import { ReportController } from './report.controller';
import {
  GenerateAccountStatementUseCase,
  GetMonthlySummaryUseCase,
} from '../../domain/use-cases/reports';
import { ClientRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaClientDatasource } from '../../infrastructure/datasources';
import { SaleRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaSaleDatasource } from '../../infrastructure/datasources';
import { PaymentRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaPaymentDatasource } from '../../infrastructure/datasources';
import { ProductRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaProductDatasource } from '../../infrastructure/datasources';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { AuthMiddleware, checkRole } from '../middlewares';
import {
  JwtAdapter,
  PdfkitPdfService,
  PrismaMonthlySummaryAdapter,
} from '../../infrastructure/services';
import { Role } from '../../domain/entities';

export class ReportRouter {
  static get routes(): Router {
    const router = Router();

    // Repositorios
    const clientRepository = new ClientRepositoryImpl(new PrismaClientDatasource());
    const saleRepository = new SaleRepositoryImpl(new PrismaSaleDatasource());
    const paymentRepository = new PaymentRepositoryImpl(new PrismaPaymentDatasource());
    const productRepository = new ProductRepositoryImpl(new PrismaProductDatasource());

    // Implementación concreta del PdfService
    const pdfService = new PdfkitPdfService();
    const summaryAdapter = new PrismaMonthlySummaryAdapter();

    const controller = new ReportController(
      new GenerateAccountStatementUseCase(
        clientRepository,
        saleRepository,
        paymentRepository,
        productRepository,
        pdfService,
      ),
      new GetMonthlySummaryUseCase(summaryAdapter),
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    // JWT obligatorio + solo ADMIN puede generar reportes
    router.use(middleware.validateJwt);
    router.use(checkRole(Role.ADMIN));

    // GET /api/reports/account-statement/:clientId
    router.get('/account-statement/:clientId', controller.getAccountStatement);
    router.get('/monthly-summary', controller.getMonthlySummary);

    return router;
  }
}
