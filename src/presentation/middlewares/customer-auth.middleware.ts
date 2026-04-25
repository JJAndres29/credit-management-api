import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../../domain/errors';
import { CustomerJwtService } from '../../domain/services';
import { CustomerRepository } from '../../domain/repositories';
import { CustomerEntity } from '../../domain/entities';

interface CustomerJwtPayload {
  id: string;
}

export class CustomerAuthMiddleware {
  constructor(
    private readonly jwtService: CustomerJwtService,
    private readonly customerRepository: CustomerRepository,
  ) {}

  validateCustomerJwt = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authorization = req.headers['authorization'];

    if (!authorization || !authorization.startsWith('Bearer ')) {
      next(CustomError.unauthorized('No autorizado'));
      return;
    }

    const token = authorization.split(' ')[1];
    const payload = await this.jwtService.verifyToken<CustomerJwtPayload>(token);

    if (!payload) {
      next(CustomError.unauthorized('Token inválido o expirado'));
      return;
    }

    const customer = await this.customerRepository.findById(payload.id);

    if (!customer || !customer.isActive) {
      next(CustomError.unauthorized('No autorizado'));
      return;
    }

    (req as Request & { customer: CustomerEntity }).customer = customer;
    next();
  };
}
