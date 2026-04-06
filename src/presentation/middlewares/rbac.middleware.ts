import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../../domain/errors';
import { Role, UserEntity } from '../../domain/entities';

type AuthRequest = Request & { user?: UserEntity };

export const checkRole = (...roles: Role[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      next(CustomError.unauthorized('No autorizado'));
      return;
    }

    if (!roles.includes(user.role)) {
      next(CustomError.forbidden('Acceso denegado: permisos insuficientes'));
      return;
    }

    next();
  };
};
