import { ProcessPaymentWebhookUseCase } from './process-payment-webhook.use-case';
import { OnlineOrderRepository } from '../../repositories/online-order.repository';
import { IPaymentGateway, GatewayTransactionStatus } from '../../services/payment-gateway.port';
import { ProductCatalogPort } from '../../services/product-catalog.port';
import {
  OnlineOrderEntity,
  OnlineOrderItemEntity,
  OrderStatus,
  OrderPaymentMethod,
} from '../../entities/online-order.entity';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeItem(productId = 'prod-1', quantity = 2): OnlineOrderItemEntity {
  return new OnlineOrderItemEntity('item-1', 'order-1', productId, quantity, 50, 'Camisa');
}

function makeOrder(overrides: Partial<{
  id: string;
  status: OrderStatus;
  totalAmount: number;
  items: OnlineOrderItemEntity[];
}> = {}): OnlineOrderEntity {
  return new OnlineOrderEntity(
    overrides.id ?? 'order-uuid-1',
    1001,
    null,
    'Juan Guest',
    '+57300',
    'juan@example.com',
    'Calle 1 #2-3',
    overrides.status ?? OrderStatus.PENDING_PAYMENT,
    overrides.totalAmount ?? 100,
    OrderPaymentMethod.ONLINE_GATEWAY,
    new Date(Date.now() + 30 * 60 * 1000),
    null,
    new Date(),
    overrides.items ?? [makeItem()],
    'pref-123',
    'https://mp.com/pay',
  );
}

function makeVerifyResult(overrides: Partial<{
  status: GatewayTransactionStatus;
  amount: number;
  externalReference: string;
}> = {}) {
  return {
    status: overrides.status ?? 'APPROVED' as GatewayTransactionStatus,
    amount: overrides.amount ?? 100,
    externalReference: overrides.externalReference ?? 'order-uuid-1',
  };
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRepo: jest.Mocked<OnlineOrderRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByOrderNumberAndEmail: jest.fn(),
  findAll: jest.fn(),
  updatePaymentLink: jest.fn(),
  markAsPaid: jest.fn(),
  markAsCancelled: jest.fn(),
  webhookExists: jest.fn(),
  saveProcessedWebhook: jest.fn(),
};

const mockGateway: jest.Mocked<IPaymentGateway> = {
  generatePaymentLink: jest.fn(),
  verifyTransaction: jest.fn(),
  verifyWebhookSignature: jest.fn(),
  parseWebhookEvent: jest.fn(),
};

const mockCatalog: jest.Mocked<ProductCatalogPort> = {
  getForOrder: jest.fn(),
  decrementStockAtomic: jest.fn(),
  incrementStock: jest.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProcessPaymentWebhookUseCase', () => {
  let useCase: ProcessPaymentWebhookUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ProcessPaymentWebhookUseCase(mockRepo, mockGateway, mockCatalog);
  });

  it('paymentId vacío → ignored sin llamar verifyTransaction', async () => {
    const result = await useCase.execute({ provider: 'mercadopago', eventId: 'ev-1', paymentId: '' });
    expect(result).toBe('ignored');
    expect(mockGateway.verifyTransaction).not.toHaveBeenCalled();
  });

  it('eventId duplicado → already_processed sin llamar verifyTransaction', async () => {
    mockRepo.webhookExists.mockResolvedValue(true);
    const result = await useCase.execute({ provider: 'mercadopago', eventId: 'ev-dup', paymentId: 'pay-1' });
    expect(result).toBe('already_processed');
    expect(mockGateway.verifyTransaction).not.toHaveBeenCalled();
  });

  it('APPROVED monto correcto → paid, marca orden como pagada', async () => {
    mockRepo.webhookExists.mockResolvedValue(false);
    mockGateway.verifyTransaction.mockResolvedValue(makeVerifyResult({ status: 'APPROVED', amount: 100 }));
    mockRepo.findById.mockResolvedValue(makeOrder({ totalAmount: 100 }));
    mockRepo.markAsPaid.mockResolvedValue(makeOrder({ status: OrderStatus.PAID }));

    const result = await useCase.execute({ provider: 'mercadopago', eventId: 'ev-1', paymentId: 'pay-1' });

    expect(result).toBe('paid');
    expect(mockRepo.markAsPaid).toHaveBeenCalledWith('order-uuid-1', { provider: 'mercadopago', eventId: 'ev-1' });
    expect(mockRepo.saveProcessedWebhook).not.toHaveBeenCalled();
  });

  it('APPROVED monto incorrecto (diferencia > 1 COP) → amount_mismatch, no cambia status', async () => {
    mockRepo.webhookExists.mockResolvedValue(false);
    mockGateway.verifyTransaction.mockResolvedValue(makeVerifyResult({ status: 'APPROVED', amount: 150 }));
    mockRepo.findById.mockResolvedValue(makeOrder({ totalAmount: 100 }));
    mockRepo.saveProcessedWebhook.mockResolvedValue(undefined);

    const result = await useCase.execute({ provider: 'mercadopago', eventId: 'ev-1', paymentId: 'pay-1' });

    expect(result).toBe('amount_mismatch');
    expect(mockRepo.markAsPaid).not.toHaveBeenCalled();
    expect(mockRepo.saveProcessedWebhook).toHaveBeenCalledWith({ provider: 'mercadopago', eventId: 'ev-1' });
  });

  it('APPROVED monto dentro de tolerancia ±1 COP → paid', async () => {
    mockRepo.webhookExists.mockResolvedValue(false);
    mockGateway.verifyTransaction.mockResolvedValue(makeVerifyResult({ status: 'APPROVED', amount: 100.5 }));
    mockRepo.findById.mockResolvedValue(makeOrder({ totalAmount: 100 }));
    mockRepo.markAsPaid.mockResolvedValue(makeOrder({ status: OrderStatus.PAID }));

    const result = await useCase.execute({ provider: 'mercadopago', eventId: 'ev-1', paymentId: 'pay-1' });
    expect(result).toBe('paid');
  });

  it('DECLINED → cancelled + incrementStock por cada item', async () => {
    const items = [makeItem('prod-A', 3), makeItem('prod-B', 1)];
    mockRepo.webhookExists.mockResolvedValue(false);
    mockGateway.verifyTransaction.mockResolvedValue(makeVerifyResult({ status: 'DECLINED' }));
    mockRepo.findById.mockResolvedValue(makeOrder({ items }));
    mockRepo.markAsCancelled.mockResolvedValue(makeOrder({ status: OrderStatus.CANCELLED, items }));
    mockCatalog.incrementStock.mockResolvedValue(undefined);

    const result = await useCase.execute({ provider: 'mercadopago', eventId: 'ev-1', paymentId: 'pay-1' });

    expect(result).toBe('cancelled');
    expect(mockRepo.markAsCancelled).toHaveBeenCalledWith('order-uuid-1', { provider: 'mercadopago', eventId: 'ev-1' });
    expect(mockCatalog.incrementStock).toHaveBeenCalledWith('prod-A', 3);
    expect(mockCatalog.incrementStock).toHaveBeenCalledWith('prod-B', 1);
    expect(mockCatalog.incrementStock).toHaveBeenCalledTimes(2);
  });

  it('PENDING → pending, no escribe ProcessedWebhook', async () => {
    mockRepo.webhookExists.mockResolvedValue(false);
    mockGateway.verifyTransaction.mockResolvedValue(makeVerifyResult({ status: 'PENDING' }));
    mockRepo.findById.mockResolvedValue(makeOrder());

    const result = await useCase.execute({ provider: 'mercadopago', eventId: 'ev-1', paymentId: 'pay-1' });

    expect(result).toBe('pending');
    expect(mockRepo.saveProcessedWebhook).not.toHaveBeenCalled();
    expect(mockRepo.markAsPaid).not.toHaveBeenCalled();
    expect(mockRepo.markAsCancelled).not.toHaveBeenCalled();
  });

  it('Order no encontrada → order_not_found, escribe ProcessedWebhook', async () => {
    mockRepo.webhookExists.mockResolvedValue(false);
    mockGateway.verifyTransaction.mockResolvedValue(makeVerifyResult({ externalReference: 'unknown-id' }));
    mockRepo.findById.mockResolvedValue(null);
    mockRepo.saveProcessedWebhook.mockResolvedValue(undefined);

    const result = await useCase.execute({ provider: 'mercadopago', eventId: 'ev-1', paymentId: 'pay-1' });

    expect(result).toBe('order_not_found');
    expect(mockRepo.saveProcessedWebhook).toHaveBeenCalledWith({ provider: 'mercadopago', eventId: 'ev-1' });
  });

  it('Order ya PAID → order_not_pending, escribe ProcessedWebhook', async () => {
    mockRepo.webhookExists.mockResolvedValue(false);
    mockGateway.verifyTransaction.mockResolvedValue(makeVerifyResult({ status: 'APPROVED', amount: 100 }));
    mockRepo.findById.mockResolvedValue(makeOrder({ status: OrderStatus.PAID }));
    mockRepo.saveProcessedWebhook.mockResolvedValue(undefined);

    const result = await useCase.execute({ provider: 'mercadopago', eventId: 'ev-1', paymentId: 'pay-1' });

    expect(result).toBe('order_not_pending');
    expect(mockRepo.markAsPaid).not.toHaveBeenCalled();
    expect(mockRepo.saveProcessedWebhook).toHaveBeenCalledWith({ provider: 'mercadopago', eventId: 'ev-1' });
  });
});
