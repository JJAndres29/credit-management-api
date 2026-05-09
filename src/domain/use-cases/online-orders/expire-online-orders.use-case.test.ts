import { ExpireOnlineOrdersUseCase } from './expire-online-orders.use-case';
import { OnlineOrderRepository } from '../../repositories/online-order.repository';
import { ProductCatalogPort } from '../../services/product-catalog.port';
import {
  OnlineOrderEntity,
  OnlineOrderItemEntity,
  OrderPaymentMethod,
  OrderStatus,
} from '../../entities/online-order.entity';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeItem(productId: string, quantity = 1): OnlineOrderItemEntity {
  return new OnlineOrderItemEntity('item-' + productId, 'order-x', productId, quantity, 50, 'P');
}

function makeOrder(
  id: string,
  items: OnlineOrderItemEntity[],
  status: OrderStatus = OrderStatus.PENDING_PAYMENT,
): OnlineOrderEntity {
  return new OnlineOrderEntity(
    id,
    1000,
    null,
    'A',
    null,
    'a@b.com',
    'Calle 1',
    status,
    100,
    OrderPaymentMethod.ONLINE_GATEWAY,
    new Date(Date.now() - 60_000),
    null,
    new Date(),
    items,
    null,
    null,
    null,
  );
}

const mockRepo: jest.Mocked<OnlineOrderRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByOrderNumberAndEmail: jest.fn(),
  findAll: jest.fn(),
  updatePaymentLink: jest.fn(),
  markAsPaid: jest.fn(),
  markAsCancelled: jest.fn(),
  webhookExists: jest.fn(),
  tryClaimProcessedWebhook: jest.fn(),
  releaseProcessedWebhookClaim: jest.fn(),
  saveProcessedWebhook: jest.fn(),
  updateStatus: jest.fn(),
  tryCancelOrExpirePending: jest.fn(),
  markStockRestored: jest.fn(),
  findExpiredPending: jest.fn(),
};

const mockCatalog: jest.Mocked<ProductCatalogPort> = {
  getForOrder: jest.fn(),
  decrementStockAtomic: jest.fn(),
  incrementStock: jest.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ExpireOnlineOrdersUseCase', () => {
  let useCase: ExpireOnlineOrdersUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ExpireOnlineOrdersUseCase(mockRepo, mockCatalog);
  });

  it('sin órdenes vencidas → resultado vacío', async () => {
    mockRepo.findExpiredPending.mockResolvedValue([]);
    const result = await useCase.execute();
    expect(result).toEqual({ scanned: 0, expired: 0, skipped: 0, errors: 0 });
    expect(mockRepo.tryCancelOrExpirePending).not.toHaveBeenCalled();
  });

  it('expira y restaura stock para todas las órdenes vencidas', async () => {
    const o1 = makeOrder('o1', [makeItem('p1', 2)]);
    const o2 = makeOrder('o2', [makeItem('p2', 5), makeItem('p3', 1)]);
    mockRepo.findExpiredPending.mockResolvedValue([o1, o2]);
    mockRepo.tryCancelOrExpirePending.mockImplementation(async (id) =>
      makeOrder(id, id === 'o1' ? [makeItem('p1', 2)] : [makeItem('p2', 5), makeItem('p3', 1)], OrderStatus.EXPIRED),
    );
    mockRepo.markStockRestored.mockResolvedValue(undefined);
    mockCatalog.incrementStock.mockResolvedValue(undefined);

    const result = await useCase.execute();

    expect(result).toEqual({ scanned: 2, expired: 2, skipped: 0, errors: 0 });
    expect(mockCatalog.incrementStock).toHaveBeenCalledWith('p1', 2);
    expect(mockCatalog.incrementStock).toHaveBeenCalledWith('p2', 5);
    expect(mockCatalog.incrementStock).toHaveBeenCalledWith('p3', 1);
    expect(mockRepo.markStockRestored).toHaveBeenCalledWith('o1');
    expect(mockRepo.markStockRestored).toHaveBeenCalledWith('o2');
  });

  it('race con webhook PAID → tryCancelOrExpirePending retorna null → skipped, sin restaurar stock', async () => {
    const o1 = makeOrder('o1', [makeItem('p1', 2)]);
    mockRepo.findExpiredPending.mockResolvedValue([o1]);
    mockRepo.tryCancelOrExpirePending.mockResolvedValue(null);

    const result = await useCase.execute();

    expect(result).toEqual({ scanned: 1, expired: 0, skipped: 1, errors: 0 });
    expect(mockCatalog.incrementStock).not.toHaveBeenCalled();
    expect(mockRepo.markStockRestored).not.toHaveBeenCalled();
  });

  it('un incrementStock falla → expirada cuenta como expired, error reportado, no marca stockRestored', async () => {
    const items = [makeItem('p1', 2), makeItem('p2', 3)];
    const o1 = makeOrder('o1', items);
    mockRepo.findExpiredPending.mockResolvedValue([o1]);
    mockRepo.tryCancelOrExpirePending.mockResolvedValue(makeOrder('o1', items, OrderStatus.EXPIRED));
    mockCatalog.incrementStock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('DB error'));

    const result = await useCase.execute();

    expect(result).toEqual({ scanned: 1, expired: 1, skipped: 0, errors: 1 });
    expect(mockRepo.markStockRestored).not.toHaveBeenCalled();
  });

  it('una orden lanza durante el flujo → contador de errores incrementa, otras siguen', async () => {
    const o1 = makeOrder('o1', [makeItem('p1', 1)]);
    const o2 = makeOrder('o2', [makeItem('p2', 1)]);
    mockRepo.findExpiredPending.mockResolvedValue([o1, o2]);
    mockRepo.tryCancelOrExpirePending
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce(makeOrder('o2', [makeItem('p2', 1)], OrderStatus.EXPIRED));
    mockRepo.markStockRestored.mockResolvedValue(undefined);
    mockCatalog.incrementStock.mockResolvedValue(undefined);

    const result = await useCase.execute();

    expect(result.scanned).toBe(2);
    expect(result.expired).toBe(1);
    expect(result.errors).toBe(1);
    expect(mockCatalog.incrementStock).toHaveBeenCalledWith('p2', 1);
    expect(mockCatalog.incrementStock).toHaveBeenCalledTimes(1);
  });

  it('respeta batchSize en findExpiredPending', async () => {
    mockRepo.findExpiredPending.mockResolvedValue([]);
    await useCase.execute(new Date(), 25);
    expect(mockRepo.findExpiredPending).toHaveBeenCalledWith(expect.any(Date), 25);
  });
});
