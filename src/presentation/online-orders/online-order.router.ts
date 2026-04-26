import { Router, Request, Response, NextFunction } from 'express';
import { OnlineOrderController } from './online-order.controller';
import {
  CreateOnlineOrderUseCase,
  GetOnlineOrderByIdUseCase,
  GetOnlineOrdersUseCase,
} from '../../domain/use-cases/online-orders';
import { OnlineOrderRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaOnlineOrderDatasource } from '../../infrastructure/datasources';
import { ProductCatalogAdapter, CustomerJwtAdapter, MercadoPagoGatewayAdapter } from '../../infrastructure/services';
import { CustomerRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaCustomerDatasource } from '../../infrastructure/datasources';
import { AuthMiddleware, checkRole } from '../middlewares';
import { JwtAdapter } from '../../infrastructure/services';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { Role, CustomerEntity } from '../../domain/entities';
import { CustomerJwtService } from '../../domain/services';
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
    const paymentGateway = new MercadoPagoGatewayAdapter();

    const customerRepository = new CustomerRepositoryImpl(new PrismaCustomerDatasource());
    const customerJwt = new CustomerJwtAdapter();
    const optionalCustomerJwt = buildOptionalCustomerJwt(customerJwt, customerRepository);

    const staffMiddleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    const controller = new OnlineOrderController(
      new CreateOnlineOrderUseCase(orderRepository, productCatalog, paymentGateway),
      new GetOnlineOrderByIdUseCase(orderRepository),
      new GetOnlineOrdersUseCase(orderRepository),
    );

    // POST /api/online-orders — público, customer JWT opcional
    router.post('/', optionalCustomerJwt, controller.create);

    // GET /api/online-orders/:id — público + email query O JWT customer dueño
    router.get('/:id', optionalCustomerJwt, controller.getById);

    // GET /api/online-orders — Admin staff
    router.get('/', staffMiddleware.validateJwt, checkRole(Role.ADMIN), controller.getAll);

    return router;
  }
}
