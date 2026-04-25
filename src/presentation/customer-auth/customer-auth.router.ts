import { Router } from 'express';
import { CustomerAuthController } from './customer-auth.controller';
import {
  RegisterCustomerUseCase,
  LoginCustomerUseCase,
  RenewCustomerTokenUseCase,
} from '../../domain/use-cases/customer-auth';
import { PrismaCustomerDatasource } from '../../infrastructure/datasources';
import { CustomerRepositoryImpl } from '../../infrastructure/repositories';
import { CustomerJwtAdapter } from '../../infrastructure/services';
import { CustomerAuthMiddleware } from '../middlewares/customer-auth.middleware';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';

export class CustomerAuthRouter {
  static get routes(): Router {
    const router = Router();

    const datasource = new PrismaCustomerDatasource();
    const repository = new CustomerRepositoryImpl(datasource);
    const jwtService = new CustomerJwtAdapter();

    const middleware = new CustomerAuthMiddleware(jwtService, repository);

    const controller = new CustomerAuthController(
      new RegisterCustomerUseCase(repository, jwtService),
      new LoginCustomerUseCase(repository, jwtService),
      new RenewCustomerTokenUseCase(repository, jwtService),
    );

    router.post('/register', RateLimitMiddleware.loginLimiter, controller.register);
    router.post('/login', RateLimitMiddleware.loginLimiter, controller.login);
    router.post('/renew', middleware.validateCustomerJwt, controller.renewToken);

    return router;
  }
}
