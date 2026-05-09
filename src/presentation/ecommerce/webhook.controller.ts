import { Request, Response } from 'express';
import { IPaymentGateway } from '../../domain/services/payment-gateway.port';
import { ProcessPaymentWebhookUseCase } from '../../domain/use-cases/online-orders';
import { globalLogger } from '../../infrastructure/services';

export class WebhookController {
  constructor(
    private readonly mercadoPagoGateway: IPaymentGateway,
    private readonly processWebhookUseCase: ProcessPaymentWebhookUseCase,
  ) {}

  mercadopago = async (req: Request, res: Response): Promise<void> => {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body ?? {}));
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers[key] = value;
      else if (Array.isArray(value)) headers[key] = value.join(',');
    }

    if (!this.mercadoPagoGateway.verifyWebhookSignature(rawBody, headers, req.query)) {
      globalLogger.warn('[Webhook] Invalid Mercado Pago signature - request rejected');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const { eventId, paymentId } = this.mercadoPagoGateway.parseWebhookEvent(rawBody);
    const result = await this.processWebhookUseCase.execute({
      provider: 'mercadopago',
      eventId,
      paymentId,
    });

    res.status(200).json({ result });
  };
}
