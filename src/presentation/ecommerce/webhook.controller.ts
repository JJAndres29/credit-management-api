import { Request, Response } from 'express';
import { IPaymentGateway } from '../../domain/services/payment-gateway.port';
import { ProcessPaymentWebhookUseCase } from '../../domain/use-cases/online-orders';

export class WebhookController {
  constructor(
    private readonly mercadoPagoGateway: IPaymentGateway,
    private readonly processWebhookUseCase: ProcessPaymentWebhookUseCase,
  ) {}

  mercadopago = async (req: Request, res: Response): Promise<void> => {
    const rawBody = req.body as Buffer;
    const headers = req.headers as Record<string, string>;

    if (!this.mercadoPagoGateway.verifyWebhookSignature(rawBody, headers)) {
      console.warn('[Webhook] Invalid Mercado Pago signature — request rejected');
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
