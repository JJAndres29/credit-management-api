import { Router } from 'express';
import { AuthController } from './auth.controller';
import { LoginUseCase, RenewTokenUseCase } from '../../domain/use-cases/auth';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { JwtAdapter } from '../../infrastructure/services';
import { AuthMiddleware } from '../middlewares';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware'; 

export class AuthRouter {
  static get routes(): Router {
    const router = Router();

    const datasource = new PrismaAuthDatasource();
    const repository = new AuthRepositoryImpl(datasource);
    const jwtService = new JwtAdapter();

    const middleware = new AuthMiddleware(jwtService, repository);

    const controller = new AuthController(
      new LoginUseCase(repository, jwtService),
      new RenewTokenUseCase(repository, jwtService),
    );

    // POST /api/auth/login
    router.post('/login', RateLimitMiddleware.loginLimiter, controller.login);

    // POST /api/auth/renew  — requiere JWT válido
    router.post('/renew', middleware.validateJwt, controller.renewToken);

    return router;
  }
}
