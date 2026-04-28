import { Router } from 'express';
import { CustomerAuthController } from './customer-auth.controller';
import {
  GoogleAuthUseCase,
  RenewCustomerTokenUseCase,
  ClaimClientUseCase,
  GetCustomerProfileUseCase,
  GetCustomersUseCase,
  UpdateCustomerUseCase,
  UpdateCustomerProfileUseCase,
  RegisterCustomerUseCase,
  LoginCustomerUseCase,
  ChangeCustomerPasswordUseCase,
  ForgotCustomerPasswordUseCase,
  ResetCustomerPasswordUseCase,
} from '../../domain/use-cases/customer-auth';
import { Role } from '../../domain/entities';
import {
  PrismaCustomerDatasource,
  PrismaClientDatasource,
  PrismaAuthDatasource,
} from '../../infrastructure/datasources';
import {
  CustomerRepositoryImpl,
  ClientRepositoryImpl,
  AuthRepositoryImpl,
} from '../../infrastructure/repositories';
import {
  CustomerJwtAdapter,
  ClientLookupAdapter,
  JwtAdapter,
  NodemailerEmailService,
} from '../../infrastructure/services';
import { CustomerPasswordResetSubscriber } from '../../infrastructure/subscribers';
import { CustomerAuthMiddleware } from '../middlewares/customer-auth.middleware';
import { AuthMiddleware } from '../middlewares/auth.middleware';
import { checkRole } from '../middlewares/rbac.middleware';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { envs } from '../../config/envs';
import { globalEventEmitter } from '../../infrastructure/events';

export class CustomerAuthRouter {
  static get routes(): Router {
    const router = Router();

    // ─── Subscribers ────────────────────────────────────────────────────────
    new CustomerPasswordResetSubscriber(
      globalEventEmitter,
      new NodemailerEmailService(),
    );

    // ─── Repositories ───────────────────────────────────────────────────────
    const customerDatasource = new PrismaCustomerDatasource();
    const customerRepository = new CustomerRepositoryImpl(customerDatasource);

    const clientDatasource = new PrismaClientDatasource();
    const clientRepository = new ClientRepositoryImpl(clientDatasource);

    const clientLookupPort = new ClientLookupAdapter(clientRepository, customerRepository);

    // ─── Staff auth (admin routes) ──────────────────────────────────────────
    const jwtAdapter = new JwtAdapter();
    const authDatasource = new PrismaAuthDatasource();
    const authRepository = new AuthRepositoryImpl(authDatasource);
    const staffMiddleware = new AuthMiddleware(jwtAdapter, authRepository);

    // ─── Customer JWT ────────────────────────────────────────────────────────
    const customerJwtService = new CustomerJwtAdapter();
    const customerMiddleware = new CustomerAuthMiddleware(customerJwtService, customerRepository);

    // ─── Controller ─────────────────────────────────────────────────────────
    const controller = new CustomerAuthController(
      new GoogleAuthUseCase(customerRepository, customerJwtService, envs.googleClientId),
      new RenewCustomerTokenUseCase(customerRepository, customerJwtService),
      new ClaimClientUseCase(customerRepository, clientLookupPort),
      new GetCustomerProfileUseCase(customerRepository, clientLookupPort),
      new GetCustomersUseCase(customerRepository),
      new UpdateCustomerUseCase(customerRepository),
      new UpdateCustomerProfileUseCase(customerRepository),
      new RegisterCustomerUseCase(customerRepository, customerJwtService),
      new LoginCustomerUseCase(customerRepository, customerJwtService),
      new ChangeCustomerPasswordUseCase(customerRepository),
      new ForgotCustomerPasswordUseCase(customerRepository, globalEventEmitter),
      new ResetCustomerPasswordUseCase(customerRepository, globalEventEmitter),
    );

    // ─── Routes — STATIC before DYNAMIC ─────────────────────────────────────

    // Public
    router.post('/register', RateLimitMiddleware.loginLimiter, controller.register);
    router.post('/login', RateLimitMiddleware.loginLimiter, controller.login);
    router.post('/google', RateLimitMiddleware.loginLimiter, controller.googleAuth);
    router.post('/forgot-password', controller.forgotPassword);

    // Customer JWT
    router.post('/renew', customerMiddleware.validateCustomerJwt, controller.renewToken);
    router.post('/claim-client', customerMiddleware.validateCustomerJwt, controller.claimClient);
    router.get('/me', customerMiddleware.validateCustomerJwt, controller.getProfile);
    router.patch('/me', customerMiddleware.validateCustomerJwt, controller.updateProfile);
    router.patch('/change-password', customerMiddleware.validateCustomerJwt, controller.changePassword);

    // Admin (staff JWT + ADMIN role)
    router.get('/', staffMiddleware.validateJwt, checkRole(Role.ADMIN), controller.getCustomers);
    router.patch('/:id', staffMiddleware.validateJwt, checkRole(Role.ADMIN), controller.updateCustomer);
    router.post('/:id/reset-password', staffMiddleware.validateJwt, checkRole(Role.ADMIN), controller.resetPassword);

    return router;
  }
}
