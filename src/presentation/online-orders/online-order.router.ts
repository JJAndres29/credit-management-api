import { Router, Request, Response, NextFunction } from 'express';
import { OnlineOrderController } from './online-order.controller';
import {
  CreateOnlineOrderUseCase,
  EvaluateOrderRiskUseCase,
  GetOnlineOrderByIdUseCase,
  GetOnlineOrdersUseCase,
  UpdateOnlineOrderStatusUseCase,
} from '../../domain/use-cases/online-orders';
import { ClearCheckoutCartUseCase } from '../../domain/use-cases/cart';
import { OnlineOrderRepositoryImpl, SaleRepositoryImpl, CartRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaOnlineOrderDatasource, PrismaSaleDatasource, PrismaCartDatasource, PrismaCustomerDatasource } from '../../infrastructure/datasources';
import {
  ProductCatalogAdapter,
  CustomerJwtAdapter,
  MercadoPagoGatewayAdapter,
  CustomerLinkAdapter,
  PostgresFeatureFlagAdapter,
  globalLogger,
  PrismaOrderVelocityAdapter,
  PrismaShippingQuoteAdapter,
  PrismaCouponLookupAdapter,
  PrismaCustomerAddressVerifyAdapter,
  CustomerRiskProfileAdapter,
} from '../../infrastructure/services';
import { CustomerRepositoryImpl } from '../../infrastructure/repositories';
import { AuthMiddleware, checkRole, FeatureFlagMiddleware, idempotencyKeyMiddleware } from '../middlewares';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { JwtAdapter } from '../../infrastructure/services';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { Role, CustomerEntity } from '../../domain/entities';
import { CustomerJwtService, FeatureFlagKey } from '../../domain/services';
import { CustomerRepository } from '../../domain/repositories';

function buildOptionalCustomerJwt(
  jwtService: CustomerJwtService,
  customerRepository: CustomerRepository,
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authorization = req.headers['authorization'];
    if (!authorization || !authorization.startsWith('Bearer ')) {
      next();
      return;
    }
    const token = authorization.split(' ')[1];
    const payload = await jwtService.verifyToken<{ id: string }>(token);
    if (!payload) { next(); return; }

    const customer = await customerRepository.findById(payload.id);
    if (customer && customer.isActive) {
      (req as Request & { customer: CustomerEntity }).customer = customer;
    }
    next();
  };
}

export class OnlineOrderRouter {
  static get routes(): Router {
    const router = Router();

    const orderRepository = new OnlineOrderRepositoryImpl(new PrismaOnlineOrderDatasource());
    const productCatalog = new ProductCatalogAdapter();
    const featureFlags = new PostgresFeatureFlagAdapter();
    const paymentGateway = new MercadoPagoGatewayAdapter(featureFlags);

    const customerRepository = new CustomerRepositoryImpl(new PrismaCustomerDatasource());
    const customerJwt = new CustomerJwtAdapter();
    const optionalCustomerJwt = buildOptionalCustomerJwt(customerJwt, customerRepository);

    const staffMiddleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    const velocityPort = new PrismaOrderVelocityAdapter();
    const evaluateRisk = new EvaluateOrderRiskUseCase(velocityPort);

    const createOnlineOrderUseCase = new CreateOnlineOrderUseCase(
      orderRepository,
      productCatalog,
      paymentGateway,
      featureFlags,
      evaluateRisk,
      new PrismaShippingQuoteAdapter(),
      new PrismaCouponLookupAdapter(),
      new PrismaCustomerAddressVerifyAdapter(),
      new CustomerRiskProfileAdapter(customerRepository),
    );

    const clearCheckoutCartUseCase = new ClearCheckoutCartUseCase(
      new CartRepositoryImpl(new PrismaCartDatasource()),
    );

    const controller = new OnlineOrderController(
      createOnlineOrderUseCase,
      new GetOnlineOrderByIdUseCase(orderRepository),
      new GetOnlineOrdersUseCase(orderRepository),
      new UpdateOnlineOrderStatusUseCase(
        orderRepository,
        new SaleRepositoryImpl(new PrismaSaleDatasource()),
        new CustomerLinkAdapter(new CustomerRepositoryImpl(new PrismaCustomerDatasource())),
        productCatalog,
        globalLogger,
      ),
      clearCheckoutCartUseCase,
    );

    // POST /api/online-orders — público, customer JWT opcional
    router.post(
      '/',
      FeatureFlagMiddleware.requireEnabled(featureFlags, FeatureFlagKey.CHECKOUT_ENABLED, {
        disabledStatus: 503,
        disabledMessage: 'Compras temporalmente deshabilitadas',
      }),
      RateLimitMiddleware.onlineOrderCreateLimiter,
      idempotencyKeyMiddleware,
      optionalCustomerJwt,
      controller.create,
    );

    // GET /api/online-orders/:id — público + email query O JWT customer dueño
    router.get('/:id', optionalCustomerJwt, controller.getById);

    // GET /api/online-orders — Admin staff
    router.get('/', staffMiddleware.validateJwt, checkRole(Role.ADMIN), controller.getAll);

    // PATCH /api/online-orders/:id/status — solo ADMIN
    router.patch('/:id/status', staffMiddleware.validateJwt, checkRole(Role.ADMIN), controller.updateStatus);

    return router;
  }
}
