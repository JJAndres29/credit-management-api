import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { LoggerService } from '../../domain/services/logger.service';

/**
 * GET /health
 *
 * Endpoint público (sin auth) usado por load balancers, Kubernetes y
 * herramientas de monitoreo para verificar el estado del servicio.
 *
 * Respuestas:
 *   200 — { status: 'ok', database: 'connected', uptime: <segundos> }
 *   503 — { status: 'error', database: 'disconnected' }
 *
 * No expone credenciales, versiones ni rutas internas.
 */
export class HealthRouter {
  static routes(logger?: LoggerService): Router {
    const router = Router();

    router.get('/', async (_req: Request, res: Response) => {
      try {
        await prisma.$queryRaw`SELECT 1`;

        res.status(200).json({
          status: 'ok',
          database: 'connected',
          uptime: Math.floor(process.uptime()),
        });
      } catch (error) {
        logger?.error('[HealthCheck] Fallo en la conexión a la base de datos', error);

        res.status(503).json({
          status: 'error',
          database: 'disconnected',
        });
      }
    });

    return router;
  }
}
