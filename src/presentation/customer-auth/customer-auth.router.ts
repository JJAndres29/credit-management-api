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
  ListCustomerAddressesUseCase,
  CreateCustomerAddressUseCase,
  SetDefaultCustomerAddressUseCase,
  UpdateCustomerAddressUseCase,
  DeleteCustomerAddressUseCase,
} from '../../domain/use-cases/customer-auth';
import { MergeCartOnLoginUseCase } from '../../domain/use-cases/cart';
import { Role } from '../../domain/entities';
import {
  PrismaCustomerDatasource,
  PrismaClientDatasource,
  PrismaAuthDatasource,
  PrismaCartDatasource,
  PrismaCustomerAddressDatasource,
} from '../../infrastructure/datasources';
import {
  CustomerRepositoryImpl,
  ClientRepositoryImpl,
  AuthRepositoryImpl,
  CartRepositoryImpl,
  CustomerAddressRepositoryImpl,
} from '../../infrastructure/repositories';
import {
  CustomerJwtAdapter,
  ClientLookupAdapter,
  JwtAdapter,
} from '../../infrastructure/services';
import { buildStaffChannelServices } from '../../infrastructure/messaging/build-staff-channel-services';
import { CustomerPasswordResetSubscriber } from '../../infrastructure/subscribers';
import { CustomerAuthMiddleware } from '../middlewares/customer-auth.middleware';
import { AuthMiddleware } from '../middlewares/auth.middleware';
import { checkRole } from '../middlewares/rbac.middleware';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { envs } from '../../config/envs';
import { globalEventEmitter } from '../../infrastructure/events';
import { globalLogger } from '../../infrastructure/services/pino-logger.service';

export class CustomerAuthRouter {
  static get routes(): Router {
    const router = Router();

    // ─── Subscribers ────────────────────────────────────────────────────────
    const { emailService: staffEmailForCustomerReset } = buildStaffChannelServices(globalLogger);
    new CustomerPasswordResetSubscriber(globalEventEmitter, staffEmailForCustomerReset);

    // ─── Repositories ───────────────────────────────────────────────────────
    const customerDatasource = new PrismaCustomerDatasource();
    const customerRepository = new CustomerRepositoryImpl(customerDatasource);

    const clientDatasource = new PrismaClientDatasource();
    const clientRepository = new ClientRepositoryImpl(clientDatasource);

    const cartRepository = new CartRepositoryImpl(new PrismaCartDatasource());
    const mergeCartOnLogin = new MergeCartOnLoginUseCase(cartRepository);

    const customerAddressRepository = new CustomerAddressRepositoryImpl(
      new PrismaCustomerAddressDatasource(),
    );

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
      new GoogleAuthUseCase(customerRepository, customerJwtService, envs.googleClientId, mergeCartOnLogin),
      new RenewCustomerTokenUseCase(customerRepository, customerJwtService),
      new ClaimClientUseCase(customerRepository, clientLookupPort),
      new GetCustomerProfileUseCase(customerRepository, clientLookupPort),
      new GetCustomersUseCase(customerRepository),
      new UpdateCustomerUseCase(customerRepository),
      new UpdateCustomerProfileUseCase(customerRepository),
      new RegisterCustomerUseCase(customerRepository, customerJwtService, mergeCartOnLogin),
      new LoginCustomerUseCase(customerRepository, customerJwtService, mergeCartOnLogin),
      new ChangeCustomerPasswordUseCase(customerRepository),
      new ForgotCustomerPasswordUseCase(customerRepository, globalEventEmitter),
      new ResetCustomerPasswordUseCase(customerRepository, globalEventEmitter),
      new ListCustomerAddressesUseCase(customerAddressRepository),
      new CreateCustomerAddressUseCase(customerAddressRepository),
      new SetDefaultCustomerAddressUseCase(customerAddressRepository),
      new UpdateCustomerAddressUseCase(customerAddressRepository),
      new DeleteCustomerAddressUseCase(customerAddressRepository),
    );

    // ─── Routes — STATIC before DYNAMIC ─────────────────────────────────────

    // Public
    router.post('/register', RateLimitMiddleware.loginLimiter, controller.register);
    router.post('/login', RateLimitMiddleware.loginLimiter, controller.login);
    router.post('/google', RateLimitMiddleware.loginLimiter, controller.googleAuth);
    router.post('/forgot-password', RateLimitMiddleware.forgotPasswordLimiter, controller.forgotPassword);

    // Customer JWT
    router.post('/renew', customerMiddleware.validateCustomerJwt, controller.renewToken);
    router.post('/claim-client', customerMiddleware.validateCustomerJwt, controller.claimClient);
    router.get('/me', customerMiddleware.validateCustomerJwt, controller.getProfile);
    router.patch('/me', customerMiddleware.validateCustomerJwt, controller.updateProfile);
    router.get('/me/addresses', customerMiddleware.validateCustomerJwt, controller.listAddresses);
    router.post('/me/addresses', customerMiddleware.validateCustomerJwt, controller.createAddress);
    router.patch(
      '/me/addresses/:addressId/default',
      customerMiddleware.validateCustomerJwt,
      controller.setDefaultAddress,
    );
    router.patch('/me/addresses/:addressId', customerMiddleware.validateCustomerJwt, controller.updateAddress);
    router.delete('/me/addresses/:addressId', customerMiddleware.validateCustomerJwt, controller.deleteAddress);
    router.patch('/change-password', customerMiddleware.validateCustomerJwt, controller.changePassword);

    // Admin (staff JWT + ADMIN role)
    router.get('/', staffMiddleware.validateJwt, checkRole(Role.ADMIN), controller.getCustomers);
    router.patch('/:id', staffMiddleware.validateJwt, checkRole(Role.ADMIN), controller.updateCustomer);
    router.post('/:id/reset-password', staffMiddleware.validateJwt, checkRole(Role.ADMIN), controller.resetPassword);

    return router;
  }
}
