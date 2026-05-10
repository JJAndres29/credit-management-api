import { Router, Request, Response, NextFunction } from 'express';
import { CartController } from './cart.controller';
import {
  CartRepositoryImpl,
  CustomerRepositoryImpl,
} from '../../infrastructure/repositories';
import { PrismaCartDatasource, PrismaCustomerDatasource } from '../../infrastructure/datasources';
import { ProductCatalogAdapter, CustomerJwtAdapter } from '../../infrastructure/services';
import {
  GetCartUseCase,
  AddCartItemUseCase,
  UpdateCartItemUseCase,
  RemoveCartItemUseCase,
} from '../../domain/use-cases/cart';
import { CustomerJwtService } from '../../domain/services';
import { CustomerRepository } from '../../domain/repositories';
import { CustomerEntity } from '../../domain/entities';

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

export class CartRouter {
  static get routes(): Router {
    const router = Router();

    const cartRepository = new CartRepositoryImpl(new PrismaCartDatasource());
    const catalog = new ProductCatalogAdapter();
    const getCartUseCase = new GetCartUseCase(cartRepository);
    const addCartItemUseCase = new AddCartItemUseCase(cartRepository, catalog, getCartUseCase);
    const updateCartItemUseCase = new UpdateCartItemUseCase(cartRepository, getCartUseCase);
    const removeCartItemUseCase = new RemoveCartItemUseCase(cartRepository, getCartUseCase);

    const customerRepository = new CustomerRepositoryImpl(new PrismaCustomerDatasource());
    const optionalCustomerJwt = buildOptionalCustomerJwt(
      new CustomerJwtAdapter(),
      customerRepository,
    );

    const controller = new CartController(
      getCartUseCase,
      addCartItemUseCase,
      updateCartItemUseCase,
      removeCartItemUseCase,
    );

    router.get('/', optionalCustomerJwt, controller.get);
    router.post('/items', optionalCustomerJwt, controller.addItem);
    router.patch('/items/:itemId', optionalCustomerJwt, controller.updateItem);
    router.delete('/items/:itemId', optionalCustomerJwt, controller.removeItem);

    return router;
  }
}
