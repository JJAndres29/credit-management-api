import { createHmac, timingSafeEqual } from 'crypto';
import { CustomError } from '../../domain/errors';
import { OnlineOrderEntity } from '../../domain/entities/online-order.entity';
import { IPaymentGateway, GatewayTransactionStatus } from '../../domain/services/payment-gateway.port';
import { envs } from '../../config/envs';

export class MercadoPagoGatewayAdapter implements IPaymentGateway {
  private readonly enabled: boolean;
  private readonly webhookDebug: boolean;

  private sanitizeSecret(secret: string | undefined): string {
    const trimmed = secret?.trim() ?? '';
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
      || (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  }

  private pickFirst(value: unknown): string {
    if (Array.isArray(value)) return value.length > 0 ? String(value[0]).trim() : '';
    if (value == null) return '';
    return String(value).trim();
  }

  private mask(value: string, visible = 6): string {
    if (!value) return '<empty>';
    if (value.length <= visible * 2) return `${value.slice(0, 2)}...${value.slice(-2)}`;
    return `${value.slice(0, visible)}...${value.slice(-visible)}`;
  }

  constructor() {
    this.enabled = !!(envs.mercadopago.accessToken && envs.mercadopago.webhookSecret);
    this.webhookDebug = envs.mercadopago.webhookDebug;
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
    const isTestToken = accessToken.startsWith('TEST-');
    const isProductionEnv = envs.nodeEnv === 'production';
    
    // Always use sandbox if explicit flag is set, if using a TEST- token, or if not in production
    const useSandbox = envs.mercadopago.sandboxMode || isTestToken || !isProductionEnv;
    const url = useSandbox
      ? (preference.sandbox_init_point as string)
      : (preference.init_point as string);

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
    const primarySecret = this.sanitizeSecret(envs.mercadopago.webhookSecret);
    const altSecret = this.sanitizeSecret(envs.mercadopago.webhookSecretAlt);
    const webhookSecrets = [primarySecret, altSecret].filter((secret, index, arr) => {
      return !!secret && arr.indexOf(secret) === index;
    });
    if (webhookSecrets.length === 0) return false;

    const xSignature = headers['x-signature']?.trim() ?? '';
    if (!xSignature) return false;

    const xRequestId = headers['x-request-id']?.trim() ?? '';
    if (!xRequestId) return false;

    let ts = '';
    const v1s: string[] = [];
    for (const part of xSignature.split(',')) {
      const [rawKey, rawValue] = part.split('=');
      const key = rawKey?.trim();
      const value = rawValue?.trim();
      if (key === 'ts') ts = value ?? '';
      if (key === 'v1' && value) v1s.push(value);
    }

    if (!ts || v1s.length === 0) return false;

    if (this.webhookDebug) {
      const bodySha256 = createHmac('sha256', 'mp-body-fingerprint')
        .update(rawBody)
        .digest('hex');
      const secretFingerprints = webhookSecrets
        .map((secret, idx) => {
          const fp = createHmac('sha256', 'mp-webhook-secret-fingerprint')
            .update(secret)
            .digest('hex');
          return `s${idx + 1}.len=${secret.length},s${idx + 1}.fp=${this.mask(fp)}`;
        })
        .join(' ');
      console.log(
        `[Webhook Debug] request-id=${xRequestId} ts=${ts} signature=${xSignature} `
        + `${secretFingerprints} `
        + `body.len=${rawBody.length} body.fp=${this.mask(bodySha256)}`,
      );
    }

    const candidateIds: string[] = [];
    const pushCandidateId = (value: unknown): void => {
      const normalized = this.pickFirst(value);
      if (normalized && !candidateIds.includes(normalized)) {
        candidateIds.push(normalized);
      }
    };

    pushCandidateId(queryParams['data.id']);
    pushCandidateId(queryParams?.data?.id);
    pushCandidateId(queryParams['id']);

    let bodyParsed = false;
    let bodyDataId = '';
    let bodyEventId = '';
    try {
      const parsed = JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>;
      const data = parsed.data as Record<string, unknown> | undefined;
      bodyDataId = this.pickFirst(data?.id);
      bodyEventId = this.pickFirst(parsed.id);
      pushCandidateId(bodyDataId);
      pushCandidateId(bodyEventId);
      bodyParsed = true;
    } catch {
      // Keep running with query-derived ids only.
    }

    if (candidateIds.length === 0) return false;

    if (this.webhookDebug) {
      console.log(
        `[Webhook Debug] candidateIds=${candidateIds.join('|')} bodyParsed=${bodyParsed} `
        + `body.data.id=${bodyDataId || '<empty>'} body.id=${bodyEventId || '<empty>'}`,
      );
    }

    const manifests = candidateIds.map((id) => `id:${id};request-id:${xRequestId};ts:${ts};`);

    let matchedManifest = '';
    let matchedSecretLabel = '';
    let lastExpected = '';
    const expectedByManifest: Array<{ secretLabel: string; manifest: string; expected: string }> = [];

    const isValid = webhookSecrets.some((secret, secretIndex) => {
      const secretLabel = `s${secretIndex + 1}`;
      return manifests.some((manifest) => {
        const expected = createHmac('sha256', secret).update(manifest).digest('hex');
        expectedByManifest.push({ secretLabel, manifest, expected });
        lastExpected = expected;
        const match = v1s.some(v1 => {
          try {
            if (!/^[a-fA-F0-9]{64}$/.test(v1)) return false;
            return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
          } catch {
            return false;
          }
        });
        if (match) {
          matchedManifest = manifest;
          matchedSecretLabel = secretLabel;
        }
        return match;
      });
    });

    if (!isValid) {
      console.warn(
        `[Webhook Signature Mismatch] manifestCandidates: "${manifests.join('" | "')}", expected(last): ${lastExpected}, received: ${v1s.join(' OR ')}`,
      );
      if (this.webhookDebug) {
        console.warn(
          '[Webhook Debug] expectedByManifest='
            + expectedByManifest
              .map((entry) => `{secret:"${entry.secretLabel}",manifest:"${entry.manifest}",expected:"${entry.expected}"}`)
              .join(','),
        );
      }
    } else {
      console.log(`[Webhook Signature OK] secret=${matchedSecretLabel} manifest: "${matchedManifest}"`);
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
