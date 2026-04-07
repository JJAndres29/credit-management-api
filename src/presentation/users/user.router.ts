import { Router, Request, Response, NextFunction } from 'express';
import { UserController } from './user.controller';
import {
  GetUsersUseCase,
  GetUserByIdUseCase,
  CreateUserUseCase,
  UpdateUserUseCase,
  ToggleUserStatusUseCase,
  ChangePasswordUseCase,
} from '../../domain/use-cases/users';
import { UserRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaUserDatasource } from '../../infrastructure/datasources';
import { AuthMiddleware, checkRole } from '../middlewares';
import { JwtAdapter } from '../../infrastructure/services';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { Role, UserEntity } from '../../domain/entities';
import { CustomError } from '../../domain/errors';

type AuthRequest = Request & { user?: UserEntity };

// Permite acceso si el usuario es ADMIN o si está accediendo a su propio recurso
const isSelfOrAdmin = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const user = req.user;

  if (!user) {
    next(CustomError.unauthorized('No autorizado'));
    return;
  }

  const isAdmin = user.role === Role.ADMIN;
  const isSelf = user.id === req.params.id;

  if (!isAdmin && !isSelf) {
    next(CustomError.forbidden('Acceso denegado: permisos insuficientes'));
    return;
  }

  next();
};

export class UserRouter {
  static get routes(): Router {
    const router = Router();

    const repository = new UserRepositoryImpl(new PrismaUserDatasource());

    const controller = new UserController(
      new GetUsersUseCase(repository),
      new GetUserByIdUseCase(repository),
      new CreateUserUseCase(repository),
      new UpdateUserUseCase(repository),
      new ToggleUserStatusUseCase(repository),
      new ChangePasswordUseCase(repository),
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    // Todas las rutas requieren JWT válido
    router.use(middleware.validateJwt);

    // GET  /api/users         — solo ADMIN
    router.get('/', checkRole(Role.ADMIN), controller.getAll);

    // GET  /api/users/:id     — solo ADMIN
    router.get('/:id', checkRole(Role.ADMIN), controller.getById);

    // POST /api/users         — solo ADMIN (crea vendedores/admins)
    router.post('/', checkRole(Role.ADMIN), controller.create);

    // PUT  /api/users/:id     — solo ADMIN
    router.put('/:id', checkRole(Role.ADMIN), controller.update);

    // PATCH /api/users/:id/status  — solo ADMIN (activar/desactivar)
    router.patch('/:id/status', checkRole(Role.ADMIN), controller.toggleStatus);

    // PATCH /api/users/:id/password — ADMIN o el propio usuario
    router.patch('/:id/password', isSelfOrAdmin, controller.changePassword);

    return router;
  }
}
