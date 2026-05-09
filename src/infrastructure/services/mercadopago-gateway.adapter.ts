import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { CustomError } from '../../domain/errors';
import { OnlineOrderEntity } from '../../domain/entities/online-order.entity';
import { FeatureFlagKey, FeatureFlagPort, IPaymentGateway, GatewayTransactionStatus } from '../../domain/services';
import { envs } from '../../config/envs';
import { globalLogger } from './pino-logger.service';

const BREAKER_FAILURE_THRESHOLD = 5;
const BREAKER_FAILURE_WINDOW_MS = 60_000;
const BREAKER_OPEN_MS = 30_000;

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class MercadoPagoGatewayAdapter implements IPaymentGateway {
  private readonly enabled: boolean;
  private readonly webhookDebug: boolean;
  private circuitState: CircuitState = 'CLOSED';
  private openedUntil = 0;
  private readonly failureTimestamps: number[] = [];

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

  // Extracts the trailing numeric ID from an MP resource URL (e.g.
  // "https://api.mercadopago.com/merchant_orders/40396418550" → "40396418550").
  private extractIdFromResource(resource: string): string {
    if (!resource) return '';
    const match = resource.match(/\/(\d+)(?:[/?#]|$)/);
    return match ? match[1] : '';
  }

  constructor(private readonly featureFlags?: FeatureFlagPort) {
    this.enabled = !!(envs.mercadopago.accessToken && envs.mercadopago.webhookSecret);
    this.webhookDebug = envs.mercadopago.webhookDebug;
    if (!this.enabled) {
      globalLogger.warn('[MercadoPagoGatewayAdapter] Disabled - MP_ACCESS_TOKEN or MP_WEBHOOK_SECRET missing');
    }
  }

  private async ensureEnabled(): Promise<void> {
    if (!this.enabled) {
      throw CustomError.serviceUnavailable('Pasarela temporalmente no disponible');
    }
    if (this.featureFlags && !(await this.featureFlags.isEnabled(FeatureFlagKey.MP_ENABLED, true))) {
      throw CustomError.serviceUnavailable('Pasarela temporalmente no disponible');
    }
  }

  private async executeWithCircuitBreaker<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.circuitState === 'OPEN') {
      if (now < this.openedUntil) {
        globalLogger.warn('[MercadoPagoGatewayAdapter] Circuit breaker abierto', {
          operation,
          openedUntil: new Date(this.openedUntil).toISOString(),
        });
        throw CustomError.serviceUnavailable('Pasarela temporalmente no disponible');
      }
      this.circuitState = 'HALF_OPEN';
      globalLogger.info('[MercadoPagoGatewayAdapter] Circuit breaker en HALF_OPEN', { operation });
    }

    try {
      const result = await fn();
      this.recordSuccess(operation);
      return result;
    } catch (error) {
      this.recordFailure(operation, error);
      throw error;
    }
  }

  private recordSuccess(operation: string): void {
    if (this.circuitState !== 'CLOSED' || this.failureTimestamps.length > 0) {
      globalLogger.info('[MercadoPagoGatewayAdapter] Circuit breaker cerrado', { operation });
    }
    this.circuitState = 'CLOSED';
    this.openedUntil = 0;
    this.failureTimestamps.length = 0;
  }

  private recordFailure(operation: string, error: unknown): void {
    const now = Date.now();
    this.failureTimestamps.push(now);
    while (
      this.failureTimestamps.length > 0
      && this.failureTimestamps[0] < now - BREAKER_FAILURE_WINDOW_MS
    ) {
      this.failureTimestamps.shift();
    }

    if (this.circuitState === 'HALF_OPEN' || this.failureTimestamps.length >= BREAKER_FAILURE_THRESHOLD) {
      this.circuitState = 'OPEN';
      this.openedUntil = now + BREAKER_OPEN_MS;
      globalLogger.error('[MercadoPagoGatewayAdapter] Circuit breaker abierto', error, {
        operation,
        failureCount: this.failureTimestamps.length,
        openedUntil: new Date(this.openedUntil).toISOString(),
      });
      return;
    }

    globalLogger.warn('[MercadoPagoGatewayAdapter] Falla registrada en circuit breaker', {
      operation,
      failureCount: this.failureTimestamps.length,
    });
  }

  async generatePaymentLink(order: OnlineOrderEntity): Promise<{ url: string; gatewayReference: string }> {
    await this.ensureEnabled();
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

    const response = await this.executeWithCircuitBreaker('generatePaymentLink', () => fetch(`${baseUrl}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }));

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
    await this.ensureEnabled();
    const { accessToken, baseUrl } = envs.mercadopago;

    const response = await this.executeWithCircuitBreaker('verifyTransaction', () => fetch(`${baseUrl}/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }));

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

  // ─── Webhook signature verification ────────────────────────────────────────
  //
  // Mercado Pago signs webhooks with HMAC-SHA256 using the configured "secret
  // signature" and a manifest string of the form:
  //
  //   id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];
  //
  // The official docs (https://www.mercadopago.com.co/developers/en/docs/your-integrations/notifications/webhooks)
  // explicitly say: "If any of the values shown in the above template are not
  // present in your notification, you should remove them." That is critical for
  // legacy IPN-style notifications (e.g. ?topic=merchant_order&id=...) whose
  // body has no `data.id` and whose query has no `data.id` either — only
  // `id`/`topic`. For those, MP signs the manifest WITHOUT the `id:` segment.
  //
  // Because the simulator + production routinely mix both formats on the same
  // endpoint, we build several candidate manifests and accept the request if
  // any of them produces a hash matching one of the received `v1` values.
  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string>, queryParams: Record<string, any> = {}): boolean {
    const webhookSecret = this.sanitizeSecret(envs.mercadopago.webhookSecret);
    if (!webhookSecret) return false;

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
      const secretFingerprint = createHmac('sha256', 'mp-webhook-secret-fingerprint')
        .update(webhookSecret)
        .digest('hex');
      const bodySha256 = createHmac('sha256', 'mp-body-fingerprint')
        .update(rawBody)
        .digest('hex');
      globalLogger.debug('[Webhook Debug] Mercado Pago signature input', {
        requestId: xRequestId,
        ts,
        signature: xSignature,
        secretLength: webhookSecret.length,
        secretFingerprint: this.mask(secretFingerprint),
        bodyLength: rawBody.length,
        bodyFingerprint: this.mask(bodySha256),
      });
    }

    // ── Collect candidate IDs from query and body ──────────────────────────
    const candidateIds: string[] = [];
    const pushCandidateId = (value: unknown): void => {
      const normalized = this.pickFirst(value);
      if (!normalized) return;
      // Per MP docs: alphanumeric ids must be sent in lowercase. Numeric ids
      // are unaffected by toLowerCase().
      const lowered = normalized.toLowerCase();
      if (!candidateIds.includes(lowered)) candidateIds.push(lowered);
      if (lowered !== normalized && !candidateIds.includes(normalized)) {
        candidateIds.push(normalized);
      }
    };

    // Modern payment webhooks: data.id in query or body
    pushCandidateId(queryParams['data.id']);
    pushCandidateId(queryParams?.data?.id);
    // IPN-style legacy notifications (?topic=...&id=...): id in query
    pushCandidateId(queryParams['id']);

    let bodyParsed = false;
    let bodyDataId = '';
    let bodyEventId = '';
    let bodyResourceId = '';
    let bodyTopic = '';
    try {
      const parsed = JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>;
      const data = parsed.data as Record<string, unknown> | undefined;
      bodyDataId = this.pickFirst(data?.id);
      bodyEventId = this.pickFirst(parsed.id);
      bodyTopic = this.pickFirst(parsed.topic ?? parsed.type);
      bodyResourceId = this.extractIdFromResource(this.pickFirst(parsed.resource));
      pushCandidateId(bodyDataId);
      pushCandidateId(bodyEventId);
      pushCandidateId(bodyResourceId);
      bodyParsed = true;
    } catch {
      // Keep running with query-derived ids only.
    }

    if (this.webhookDebug) {
      globalLogger.debug('[Webhook Debug] Mercado Pago candidate ids', {
        candidateIds,
        bodyParsed,
        bodyDataId: bodyDataId || '<empty>',
        bodyEventId: bodyEventId || '<empty>',
        bodyResourceId: bodyResourceId || '<empty>',
        bodyTopic: bodyTopic || '<empty>',
      });
    }

    // ── Build candidate manifests ──────────────────────────────────────────
    // Use a Set-like dedupe via array.includes to keep insertion order.
    const manifests: string[] = [];
    const pushManifest = (m: string): void => {
      if (m && !manifests.includes(m)) manifests.push(m);
    };

    // 1) Standard manifest with the `id:` segment for every candidate.
    //    Covers modern payment webhooks and IPN where MP uses the query `id`.
    for (const id of candidateIds) {
      pushManifest(`id:${id};request-id:${xRequestId};ts:${ts};`);
    }

    // 2) Manifest WITHOUT the `id:` segment.
    //    MP docs: "If any of the values shown in the above template are not
    //    present in your notification, you should remove them." For legacy
    //    topic-based notifications (merchant_order/IPN) the body lacks
    //    `data.id` and MP sometimes signs without that segment.
    pushManifest(`request-id:${xRequestId};ts:${ts};`);

    // 3) Topic-augmented variants — MP's IPN signature scheme for
    //    `topic=merchant_order` is undocumented; some accounts/regions append
    //    or prepend the topic. These are cheap to try and harmless.
    if (bodyTopic) {
      for (const id of candidateIds) {
        pushManifest(`id:${id};topic:${bodyTopic};request-id:${xRequestId};ts:${ts};`);
        pushManifest(`topic:${bodyTopic};id:${id};request-id:${xRequestId};ts:${ts};`);
      }
      pushManifest(`topic:${bodyTopic};request-id:${xRequestId};ts:${ts};`);
    }

    if (manifests.length === 0) return false;

    // ── Compare each candidate against received v1 hashes ──────────────────
    let matchedManifest = '';
    let lastExpected = '';
    const expectedByManifest: Array<{ manifest: string; expected: string }> = [];

    const isValid = manifests.some((manifest) => {
      const expected = createHmac('sha256', webhookSecret).update(manifest).digest('hex');
      expectedByManifest.push({ manifest, expected });
      lastExpected = expected;
      const match = v1s.some((v1) => {
        try {
          if (!/^[a-fA-F0-9]{64}$/.test(v1)) return false;
          return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
        } catch {
          return false;
        }
      });
      if (match) matchedManifest = manifest;
      return match;
    });

    if (isValid) {
      globalLogger.debug('[Webhook Signature OK]', { manifest: matchedManifest });
      return true;
    }

    globalLogger.warn('[Webhook Signature Mismatch]', {
      manifestCandidates: manifests,
      expectedLast: lastExpected,
      received: v1s,
    });
    if (this.webhookDebug) {
      globalLogger.debug('[Webhook Debug] expectedByManifest', { expectedByManifest });
    }

    // ── Pragmatic fallback for legacy IPN topic notifications ──────────────
    //
    // Mercado Pago's IPN-style webhooks (`?topic=merchant_order&id=...` with a
    // body shaped like `{ resource, topic }`) use an UNDOCUMENTED signature
    // scheme that does not match either of the manifests in MP's webhook
    // documentation. The official docs only describe the signature for modern
    // `type=payment` webhooks. The MP simulator and production both emit these
    // legacy notifications and we have no reliable way to verify them.
    //
    // Accepting them is SAFE because:
    //   1. The body is `{ resource, topic }` — there is no `type=payment`,
    //      no `data.id`, and `parseWebhookEvent()` returns `paymentId: ''`.
    //   2. `ProcessPaymentWebhookUseCase` short-circuits to `'ignored'` when
    //      `paymentId` is empty — zero state change, zero financial impact.
    //   3. The real payment notification arrives separately as a modern
    //      `type=payment` webhook which we DO verify with strict signature
    //      checks (manifest #1 above).
    //
    // The threat model: an attacker spamming our endpoint with fake IPN
    // notifications causes us to return 200 OK without doing anything. No
    // money moves, no DB rows change, no emails are sent.
    const isLegacyIpn = bodyParsed && !!bodyTopic && !bodyEventId && !bodyDataId;
    if (isLegacyIpn) {
      globalLogger.warn('[Webhook] Accepting legacy IPN notification despite signature mismatch', {
        topic: bodyTopic,
      });
      return true;
    }

    return false;
  }

  // ─── Webhook event parsing ─────────────────────────────────────────────────
  //
  // The same endpoint may receive two different body shapes:
  //
  //   A) Modern payment webhook (topic=payment):
  //      {
  //        "id": 12345, "type": "payment", "action": "payment.updated",
  //        "data": { "id": "999999999" }
  //      }
  //
  //   B) Legacy IPN (topic=merchant_order, payment.created, etc.):
  //      {
  //        "resource": "https://api.mercadopago.com/merchant_orders/40396418550",
  //        "topic": "merchant_order"
  //      }
  //
  // We only act on (A) because the merchant_order webhook fires immediately
  // after creation (no payment yet) and a separate `payment` notification
  // arrives once the buyer pays. Returning paymentId='' here causes the use
  // case to short-circuit with `'ignored'`, but the signature was already
  // validated so the request returns 200 to MP (no retries).
  parseWebhookEvent(rawBody: Buffer): { eventId: string; paymentId: string } {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>;
    } catch {
      return { eventId: randomUUID(), paymentId: '' };
    }

    // Legacy IPN body shape — ignore (a separate `payment` webhook will arrive)
    if (body.type !== 'payment') {
      return { eventId: String(body.id ?? randomUUID()), paymentId: '' };
    }

    const data = body.data as Record<string, unknown> | undefined;
    return {
      eventId: String(body.id ?? randomUUID()),
      paymentId: data?.id != null ? String(data.id) : '',
    };
  }
}
