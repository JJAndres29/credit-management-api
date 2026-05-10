import { Router } from 'express';
import { ListShippingZonesUseCase } from '../../domain/use-cases/shipping/list-shipping-zones.use-case';
import { PrismaShippingZoneDatasource } from '../../infrastructure/datasources/prisma-shipping-zone.datasource';

export class ShippingRouter {
  static get routes(): Router {
    const router = Router();
    const useCase = new ListShippingZonesUseCase(new PrismaShippingZoneDatasource());

    router.get('/zones', async (_req, res) => {
      try {
        const zones = await useCase.execute();
        res.json({ zones });
      } catch {
        res.status(500).json({ error: 'No se pudieron cargar zonas de envío' });
      }
    });

    return router;
  }
}
