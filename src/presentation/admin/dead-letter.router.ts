import { Router } from 'express';
import { AuthMiddleware } from '../middlewares/auth.middleware';
import { checkRole } from '../middlewares/rbac.middleware';
import { Role } from '../../domain/entities';
import { JwtAdapter } from '../../infrastructure/services/jwt.adapter';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { getStaffNotificationQueue } from '../../infrastructure/messaging/staff-notification.queue';

/**
 * Inspección de jobs fallidos BullMQ (misma cola que emails staff).
 * Sin REDIS_URL devuelve lista vacía — no rompe el panel admin.
 */
export class DeadLetterRouter {
  static get routes(): Router {
    const router = Router();

    const staffMiddleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    router.use(staffMiddleware.validateJwt, checkRole(Role.ADMIN));

    router.get('/', async (_req, res) => {
      const queue = getStaffNotificationQueue();
      if (!queue) {
        res.json({
          queueEnabled: false,
          failedCount: 0,
          alertRecommended: false,
          jobs: [],
        });
        return;
      }

      const failedCount = await queue.getFailedCount();
      const jobs = await queue.getFailed(0, 49);

      res.json({
        queueEnabled: true,
        failedCount,
        alertRecommended: failedCount > 10,
        jobs: jobs.map((j) => ({
          id: j.id,
          name: j.name,
          failedReason: j.failedReason,
          attemptsMade: j.attemptsMade,
          timestamp: j.timestamp,
          data: j.data,
        })),
      });
    });

    return router;
  }
}
