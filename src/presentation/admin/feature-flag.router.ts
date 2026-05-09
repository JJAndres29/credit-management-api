import { Router } from 'express';
import { GetFeatureFlagsUseCase, UpdateFeatureFlagUseCase } from '../../domain/use-cases/feature-flags';
import { Role } from '../../domain/entities';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { JwtAdapter, PostgresFeatureFlagAdapter } from '../../infrastructure/services';
import { AuthMiddleware, checkRole } from '../middlewares';
import { FeatureFlagController } from './feature-flag.controller';

export class FeatureFlagRouter {
  static get routes(): Router {
    const router = Router();

    const featureFlags = new PostgresFeatureFlagAdapter();
    const controller = new FeatureFlagController(
      new GetFeatureFlagsUseCase(featureFlags),
      new UpdateFeatureFlagUseCase(featureFlags),
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    router.use(middleware.validateJwt, checkRole(Role.ADMIN));
    router.get('/', controller.getAll);
    router.patch('/:key', controller.update);

    return router;
  }
}
