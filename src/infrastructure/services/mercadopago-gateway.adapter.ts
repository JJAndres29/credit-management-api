import { createHmac, timingSafeEqual } from 'crypto';
import { CustomError } from '../../domain/errors';
import { OnlineOrderEntity } from '../../domain/entities/online-order.entity';
import { IPaymentGateway, GatewayTransactionStatus } from '../../domain/services/payment-gateway.port';
import { envs } from '../../config/envs';

export class MercadoPagoGatewayAdapter implements IPaymentGateway {
  private readonly enabled: boolean;

  constructor() {
    this.enabled = !!(envs.mercadopago.accessToken && envs.mercadopago.webhookSecret);
    if (!this.enabled) {
      console.warn('[MercadoPagoGatewayAdapter] Disabled — MP_ACCESS_TOKEN or MP_WEBHOOK_SECRET missing');
    }
  }

  async generatePaymentLink(order: OnlineOrderEntity): Promise<{ url: string; gatewayReference: string }> {
    const { accessToken, baseUrl, appUrl, backUrls } = envs.mercadopago;

    const body = {
      items: order.items.map((item) => ({
        title: item.productNameSnapshot,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        currency_id: 'COP',
      })),
      external_reference: order.id,
      notification_url: `${appUrl}/api/ecommerce/webhooks/mercadopago`,
      ...(backUrls.success || backUrls.failure || backUrls.pending
        ? {
            back_urls: {
              ...(backUrls.success && { success: backUrls.success }),
              ...(backUrls.failure && { failure: backUrls.failure }),
              ...(backUrls.pending && { pending: backUrls.pending }),
            },
          }
        : {}),
    };

    const response = await fetch(`${baseUrl}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw CustomError.internalServer(
        `Mercado Pago preference creation failed (${response.status}): ${text}`,
      );
    }

    const preference = await response.json() as Record<string, unknown>;
    const isProduction = envs.nodeEnv === 'production';
    const url = isProduction
      ? (preference.init_point as string)
      : (preference.sandbox_init_point as string);

    return { url, gatewayReference: preference.id as string };
  }

  async verifyTransaction(paymentId: string): Promise<{
    status: GatewayTransactionStatus;
    amount: number;
    externalReference: string;
  }> {
    const { accessToken, baseUrl } = envs.mercadopago;

    const response = await fetch(`${baseUrl}/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { status: 'PENDING', amount: 0, externalReference: '' };
      }
      const text = await response.text().catch(() => '');
      throw CustomError.internalServer(
        `Mercado Pago payment lookup failed (${response.status}): ${text}`,
      );
    }

    const payment = await response.json() as Record<string, unknown>;
    const mpStatus = payment.status as string;

    let status: GatewayTransactionStatus;
    if (mpStatus === 'approved') {
      status = 'APPROVED';
    } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
      status = 'DECLINED';
    } else {
      status = 'PENDING';
    }

    return {
      status,
      amount: payment.transaction_amount as number,
      externalReference: (payment.external_reference as string) ?? '',
    };
  }

  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string>, queryParams: Record<string, any> = {}): boolean {
    const { webhookSecret } = envs.mercadopago;
    if (!webhookSecret) return false;

    const xSignature = headers['x-signature'] ?? '';
    if (!xSignature) return false;

    const xRequestId = headers['x-request-id'] ?? '';

    let ts = '';
    const v1s: string[] = [];
    for (const part of xSignature.split(',')) {
      const [key, value] = part.split('=');
      if (key === 'ts') ts = value ?? '';
      if (key === 'v1' && value) v1s.push(value);
    }

    if (!ts || v1s.length === 0) return false;

    let dataId = queryParams['data.id'] ?? queryParams['id'] ?? '';
    
    if (!dataId) {
      try {
        const parsed = JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>;
        const data = parsed.data as Record<string, unknown> | undefined;
        dataId = data?.id != null ? String(data.id) : '';
      } catch {
        return false;
      }
    }

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = createHmac('sha256', webhookSecret).update(manifest).digest('hex');

    const isValid = v1s.some(v1 => {
      try {
        return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
      } catch {
        return false;
      }
    });

    if (!isValid) {
      console.warn(`[Webhook Signature Mismatch] manifest: "${manifest}", expected: ${expected}, received: ${v1s.join(' OR ')}`);
    }

    return isValid;
  }

  parseWebhookEvent(rawBody: Buffer): { eventId: string; paymentId: string } {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>;
    } catch {
      return { eventId: crypto.randomUUID(), paymentId: '' };
    }

    if (body.type !== 'payment') {
      return { eventId: crypto.randomUUID(), paymentId: '' };
    }

    const data = body.data as Record<string, unknown> | undefined;
    return {
      eventId: String(body.id ?? crypto.randomUUID()),
      paymentId: data?.id != null ? String(data.id) : '',
    };
  }
}
