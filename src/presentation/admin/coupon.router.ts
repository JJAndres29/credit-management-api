import { Router } from 'express';
import { AuthMiddleware } from '../middlewares/auth.middleware';
import { checkRole } from '../middlewares/rbac.middleware';
import { Role } from '../../domain/entities';
import { JwtAdapter } from '../../infrastructure/services/jwt.adapter';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { CreateCouponDto } from '../../domain/dtos/admin/create-coupon.dto';
import { CreateCouponUseCase } from '../../domain/use-cases/coupons/create-coupon.use-case';
import { PrismaCouponAdminDatasource } from '../../infrastructure/datasources/prisma-coupon-admin.datasource';
import { CustomError } from '../../domain/errors';

export class CouponAdminRouter {
  static get routes(): Router {
    const router = Router();

    const staffMiddleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    const createCoupon = new CreateCouponUseCase(new PrismaCouponAdminDatasource());

    router.use(staffMiddleware.validateJwt, checkRole(Role.ADMIN));

    router.post('/', async (req, res) => {
      const [error, dto] = CreateCouponDto.create(req.body as Record<string, unknown>);
      if (error) { res.status(400).json({ error }); return; }
      try {
        const row = await createCoupon.execute(dto!);
        res.status(201).json(row);
      } catch (err) {
        if (err instanceof CustomError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    return router;
  }
}
