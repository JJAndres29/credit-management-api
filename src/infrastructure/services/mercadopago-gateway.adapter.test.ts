import { createHmac } from 'crypto';

// Mock envs before importing the adapter
jest.mock('../../config/envs', () => ({
  envs: {
    nodeEnv: 'development',
    mercadopago: {
      accessToken: 'TEST_TOKEN',
      webhookSecret: 'TEST_WEBHOOK_SECRET',
      baseUrl: 'https://api.mercadopago.com',
      appUrl: 'https://myapp.com',
      backUrls: { success: '', failure: '', pending: '' },
    },
  },
}));

import { MercadoPagoGatewayAdapter } from './mercadopago-gateway.adapter';
import {
  OnlineOrderEntity,
  OnlineOrderItemEntity,
  OrderStatus,
  OrderPaymentMethod,
} from '../../domain/entities/online-order.entity';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeOrder(): OnlineOrderEntity {
  const item = new OnlineOrderItemEntity('item-1', 'order-1', 'prod-1', 2, 50, 'Camisa Azul');
  return new OnlineOrderEntity(
    'order-uuid-1',
    1001,
    null,
    'Juan Guest',
    '+57300',
    'juan@example.com',
    'Calle 1',
    OrderStatus.PENDING_PAYMENT,
    100,
    OrderPaymentMethod.ONLINE_GATEWAY,
    new Date(),
    null,
    new Date(),
    [item],
    null,
    null,
    null,
  );
}

function buildSignatureHeader(dataId: string | number, requestId: string, ts: string, secret: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MercadoPagoGatewayAdapter', () => {
  let adapter: MercadoPagoGatewayAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new MercadoPagoGatewayAdapter();
    fetchSpy = jest.spyOn(global, 'fetch' as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── generatePaymentLink ───────────────────────────────────────────────────

  describe('generatePaymentLink', () => {
    it('retorna sandbox_init_point en entorno de desarrollo', async () => {
      const mockPreference = {
        id: 'pref-abc123',
        sandbox_init_point: 'https://sandbox.mercadopago.com/pay/pref-abc123',
        init_point: 'https://mercadopago.com/pay/pref-abc123',
      };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreference,
      } as Response);

      const result = await adapter.generatePaymentLink(makeOrder());

      expect(result.gatewayReference).toBe('pref-abc123');
      expect(result.url).toBe(mockPreference.sandbox_init_point);
    });

    it('fetch error → lanza CustomError 500', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as Response);

      await expect(adapter.generatePaymentLink(makeOrder())).rejects.toMatchObject({
        statusCode: 500,
      });
    });
  });

  // ── verifyTransaction ─────────────────────────────────────────────────────

  describe('verifyTransaction — mapeo de statuses', () => {
    const cases: Array<{ mpStatus: string; expected: string }> = [
      { mpStatus: 'approved', expected: 'APPROVED' },
      { mpStatus: 'rejected', expected: 'DECLINED' },
      { mpStatus: 'cancelled', expected: 'DECLINED' },
      { mpStatus: 'pending', expected: 'PENDING' },
      { mpStatus: 'in_process', expected: 'PENDING' },
      { mpStatus: 'authorized', expected: 'PENDING' },
    ];

    for (const { mpStatus, expected } of cases) {
      it(`MP status "${mpStatus}" → ${expected}`, async () => {
        fetchSpy.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: mpStatus,
            transaction_amount: 100,
            external_reference: 'order-uuid-1',
          }),
        } as Response);

        const result = await adapter.verifyTransaction('pay-123');
        expect(result.status).toBe(expected);
        expect(result.amount).toBe(100);
        expect(result.externalReference).toBe('order-uuid-1');
      });
    }
  });

  // ── verifyWebhookSignature ────────────────────────────────────────────────

  describe('verifyWebhookSignature', () => {
    const secret = 'TEST_WEBHOOK_SECRET';

    it('firma válida → true', () => {
      const dataId = 987654;
      const requestId = 'req-abc';
      const ts = '1700000000';
      const xSignature = buildSignatureHeader(dataId, requestId, ts, secret);
      const body = JSON.stringify({ type: 'payment', data: { id: dataId } });

      const result = adapter.verifyWebhookSignature(Buffer.from(body), {
        'x-signature': xSignature,
        'x-request-id': requestId,
      });

      expect(result).toBe(true);
    });

    it('firma inválida → false', () => {
      const body = JSON.stringify({ type: 'payment', data: { id: 123 } });
      const result = adapter.verifyWebhookSignature(Buffer.from(body), {
        'x-signature': 'ts=1234,v1=invalidsignature',
        'x-request-id': 'req-abc',
      });
      expect(result).toBe(false);
    });

    it('header x-signature ausente → false', () => {
      const body = JSON.stringify({ type: 'payment', data: { id: 123 } });
      const result = adapter.verifyWebhookSignature(Buffer.from(body), {
        'x-request-id': 'req-abc',
      });
      expect(result).toBe(false);
    });

    it('acepta data.id desde query params', () => {
      const dataId = '40366786807';
      const requestId = 'req-from-query';
      const ts = '1777430424';
      const xSignature = buildSignatureHeader(dataId, requestId, ts, secret);
      const body = JSON.stringify({ type: 'payment', data: { id: 999999999 } });

      const result = adapter.verifyWebhookSignature(
        Buffer.from(body),
        {
          'x-signature': xSignature,
          'x-request-id': requestId,
        },
        { 'data.id': dataId },
      );

      expect(result).toBe(true);
    });
  });

  // ── parseWebhookEvent ─────────────────────────────────────────────────────

  describe('parseWebhookEvent', () => {
    it('type=payment retorna eventId y paymentId correctos', () => {
      const body = JSON.stringify({ type: 'payment', id: 99, data: { id: 555 } });
      const result = adapter.parseWebhookEvent(Buffer.from(body));
      expect(result.eventId).toBe('99');
      expect(result.paymentId).toBe('555');
    });

    it('type=merchant_order retorna paymentId vacío', () => {
      const body = JSON.stringify({ type: 'merchant_order', id: 77, data: { id: 333 } });
      const result = adapter.parseWebhookEvent(Buffer.from(body));
      expect(result.paymentId).toBe('');
    });

    it('body inválido (no JSON) retorna paymentId vacío', () => {
      const result = adapter.parseWebhookEvent(Buffer.from('not-json'));
      expect(result.paymentId).toBe('');
    });
  });
});
