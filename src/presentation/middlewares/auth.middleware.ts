import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../../domain/errors';
import { JwtService } from '../../domain/services';
import { AuthRepository } from '../../domain/repositories';

interface JwtPayload {
  id: string;
  role: string;
}

export class AuthMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authRepository: AuthRepository,
  ) {}

  validateJwt = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authorization = req.headers['authorization'];

    if (!authorization || !authorization.startsWith('Bearer ')) {
      next(CustomError.unauthorized('No autorizado'));
      return;
    }

    const token = authorization.split(' ')[1];
    const payload = await this.jwtService.verifyToken<JwtPayload>(token);

    if (!payload) {
      next(CustomError.unauthorized('Token inválido o expirado'));
      return;
    }

    const user = await this.authRepository.findById(payload.id);

    if (!user || !user.isActive) {
      next(CustomError.unauthorized('No autorizado'));
      return;
    }

    (req as Request & { user: typeof user }).user = user;
    next();
  };
}
