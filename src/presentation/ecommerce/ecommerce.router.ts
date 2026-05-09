import { Router } from 'express';
import express from 'express';
import { WebhookController } from './webhook.controller';
import { MercadoPagoGatewayAdapter, PostgresFeatureFlagAdapter, globalLogger } from '../../infrastructure/services';
import { ProcessPaymentWebhookUseCase } from '../../domain/use-cases/online-orders';
import { OnlineOrderRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaOnlineOrderDatasource } from '../../infrastructure/datasources';
import { ProductCatalogAdapter } from '../../infrastructure/services';

export class EcommerceRouter {
  static get routes(): Router {
    const router = Router();

    const orderRepository = new OnlineOrderRepositoryImpl(new PrismaOnlineOrderDatasource());
    const productCatalog = new ProductCatalogAdapter();
    const featureFlags = new PostgresFeatureFlagAdapter();
    const gateway = new MercadoPagoGatewayAdapter(featureFlags);

    const processWebhookUseCase = new ProcessPaymentWebhookUseCase(
      orderRepository,
      gateway,
      productCatalog,
      globalLogger,
    );

    const controller = new WebhookController(gateway, processWebhookUseCase);

    // express.raw per-route to preserve body bytes for HMAC signature verification
    router.post(
      '/webhooks/mercadopago',
      express.raw({ type: '*/*' }),
      controller.mercadopago,
    );

    return router;
  }
}
