import { Router } from 'express';
import { SaleController } from './sale.controller';
import { CreateSaleUseCase, GetSalesUseCase, GetSaleByIdUseCase, GetSalesByClientUseCase } from '../../domain/use-cases/sales';
import { SaleRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaSaleDatasource } from '../../infrastructure/datasources';
import { ClientRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaClientDatasource } from '../../infrastructure/datasources';
import { ProductRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaProductDatasource } from '../../infrastructure/datasources';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { AuthMiddleware } from '../middlewares';
import { JwtAdapter } from '../../infrastructure/services';
import { PricingService, CashPricingStrategy, CreditPricingStrategy } from '../../domain/services/pricing';
import { envs } from '../../config/envs';

export class SaleRouter {
  static get routes(): Router {
    const router = Router();

    // Repositorios
    const saleRepository = new SaleRepositoryImpl(new PrismaSaleDatasource());
    const clientRepository = new ClientRepositoryImpl(new PrismaClientDatasource());
    const productRepository = new ProductRepositoryImpl(new PrismaProductDatasource());

    /**
     * Composition root del Pricing Domain Service.
     *
     * Este es el único lugar del sistema donde se decide qué strategies están activas
     * y en qué orden. Agregar una nueva regla de pricing = instanciarla aquí y pasarla
     * al array. Nada más cambia en el resto del sistema.
     *
     * Las strategies base tienen priority 10.
     * Strategies futuras más específicas (mayoristas, VIP, promociones) deben usar
     * priority >= 20 para sobreescribir la base cuando apliquen.
     */
    const pricingService = new PricingService([
      new CashPricingStrategy(),
      new CreditPricingStrategy(envs.creditSurchargePercent),
    ]);

    const controller = new SaleController(
      new CreateSaleUseCase(saleRepository, clientRepository, productRepository, pricingService),
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
