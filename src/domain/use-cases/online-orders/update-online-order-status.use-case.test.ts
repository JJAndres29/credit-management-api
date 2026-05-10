import { UpdateOnlineOrderStatusUseCase } from './update-online-order-status.use-case';
import { OnlineOrderRepository } from '../../repositories/online-order.repository';
import { ProductCatalogPort } from '../../services/product-catalog.port';
import {
  OnlineOrderEntity,
  OnlineOrderItemEntity,
  OrderPaymentMethod,
  OrderStatus,
} from '../../entities/online-order.entity';
import { UpdateOnlineOrderStatusDto } from '../../dtos/online-orders/update-online-order-status.dto';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeItem(productId = 'prod-1', quantity = 2): OnlineOrderItemEntity {
  return new OnlineOrderItemEntity('item-1', 'order-1', productId, quantity, 50, 'Camisa');
}

function makeOrder(
  overrides: Partial<{
    id: string;
    status: OrderStatus;
    items: OnlineOrderItemEntity[];
  }> = {},
): OnlineOrderEntity {
  return new OnlineOrderEntity(
    overrides.id ?? 'order-uuid-1',
    1001,
    null,
    'Juan',
    '+57300',
    'juan@example.com',
    'Calle 1',
    overrides.status ?? OrderStatus.PENDING_PAYMENT,
    100,
    OrderPaymentMethod.WHATSAPP_MANUAL,
    new Date(Date.now() + 60 * 60 * 1000),
    null,
    new Date(),
    overrides.items ?? [makeItem()],
    null,
    null,
    null,
  );
}

function dto(status: 'CANCELLED' | 'EXPIRED' | 'PAID'): UpdateOnlineOrderStatusDto {
  return UpdateOnlineOrderStatusDto.create({ status })[1]!;
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

describe('UpdateOnlineOrderStatusUseCase — stock restoration', () => {
  let useCase: UpdateOnlineOrderStatusUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new UpdateOnlineOrderStatusUseCase(mockRepo, undefined, undefined, mockCatalog);
  });

  it('order no encontrada → 404', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing', dto('CANCELLED'))).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mockRepo.tryCancelOrExpirePending).not.toHaveBeenCalled();
  });

  it('PENDING → CANCELLED: transición atómica + stock restaurado + marker', async () => {
    const items = [makeItem('prod-A', 3), makeItem('prod-B', 1)];
    const order = makeOrder({ items });
    mockRepo.findById.mockResolvedValue(order);
    mockRepo.tryCancelOrExpirePending.mockResolvedValue(
      makeOrder({ items, status: OrderStatus.CANCELLED }),
    );

    const result = await useCase.execute('order-uuid-1', dto('CANCELLED'));

    expect(mockRepo.tryCancelOrExpirePending).toHaveBeenCalledWith('order-uuid-1', 'CANCELLED');
    expect(mockCatalog.incrementStock).toHaveBeenCalledWith('prod-A', 3, {
      orderId: 'order-uuid-1',
    });
    expect(mockCatalog.incrementStock).toHaveBeenCalledWith('prod-B', 1, {
      orderId: 'order-uuid-1',
    });
    expect(mockCatalog.incrementStock).toHaveBeenCalledTimes(2);
    expect(mockRepo.markStockRestored).toHaveBeenCalledWith('order-uuid-1');
    expect(result.status).toBe(OrderStatus.CANCELLED);
  });

  it('PENDING → EXPIRED: mismo flujo que CANCELLED', async () => {
    const order = makeOrder();
    mockRepo.findById.mockResolvedValue(order);
    mockRepo.tryCancelOrExpirePending.mockResolvedValue(
      makeOrder({ status: OrderStatus.EXPIRED }),
    );

    await useCase.execute('order-uuid-1', dto('EXPIRED'));

    expect(mockRepo.tryCancelOrExpirePending).toHaveBeenCalledWith('order-uuid-1', 'EXPIRED');
    expect(mockCatalog.incrementStock).toHaveBeenCalledTimes(1);
    expect(mockRepo.markStockRestored).toHaveBeenCalled();
  });

  it('race: PENDING leído pero ya cambió a PAID → no toca stock, retorna estado fresco', async () => {
    const stalePending = makeOrder({ status: OrderStatus.PENDING_PAYMENT });
    const freshPaid = makeOrder({ status: OrderStatus.PAID });
    mockRepo.findById
      .mockResolvedValueOnce(stalePending) // first read
      .mockResolvedValueOnce(freshPaid); // reload after race
    mockRepo.tryCancelOrExpirePending.mockResolvedValue(null); // status guard rejected the update

    const result = await useCase.execute('order-uuid-1', dto('CANCELLED'));

    expect(result.status).toBe(OrderStatus.PAID);
    expect(mockCatalog.incrementStock).not.toHaveBeenCalled();
    expect(mockRepo.markStockRestored).not.toHaveBeenCalled();
  });

  it('idempotencia: ya CANCELLED → retorna sin tocar nada', async () => {
    const alreadyCancelled = makeOrder({ status: OrderStatus.CANCELLED });
    mockRepo.findById.mockResolvedValue(alreadyCancelled);

    const result = await useCase.execute('order-uuid-1', dto('CANCELLED'));

    expect(result).toBe(alreadyCancelled);
    expect(mockRepo.tryCancelOrExpirePending).not.toHaveBeenCalled();
    expect(mockCatalog.incrementStock).not.toHaveBeenCalled();
    expect(mockRepo.markStockRestored).not.toHaveBeenCalled();
  });

  it('idempotencia: ya EXPIRED, request CANCELLED → 400 (transición prohibida)', async () => {
    mockRepo.findById.mockResolvedValue(makeOrder({ status: OrderStatus.EXPIRED }));

    await expect(useCase.execute('order-uuid-1', dto('CANCELLED'))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockCatalog.incrementStock).not.toHaveBeenCalled();
  });

  it('PAID → CANCELLED bloqueado (refund flow no implementado)', async () => {
    mockRepo.findById.mockResolvedValue(makeOrder({ status: OrderStatus.PAID }));

    await expect(useCase.execute('order-uuid-1', dto('CANCELLED'))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockCatalog.incrementStock).not.toHaveBeenCalled();
  });

  it('un incrementStock falla → no marca stockRestored (consistency)', async () => {
    const items = [makeItem('prod-A', 2), makeItem('prod-B', 1)];
    mockRepo.findById.mockResolvedValue(makeOrder({ items }));
    mockRepo.tryCancelOrExpirePending.mockResolvedValue(
      makeOrder({ items, status: OrderStatus.CANCELLED }),
    );
    mockCatalog.incrementStock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('DB down'));

    await useCase.execute('order-uuid-1', dto('CANCELLED'));

    expect(mockCatalog.incrementStock).toHaveBeenCalledTimes(2);
    expect(mockRepo.markStockRestored).not.toHaveBeenCalled();
  });

  it('sin productCatalogPort inyectado: cambia status pero no toca stock', async () => {
    const noStockUseCase = new UpdateOnlineOrderStatusUseCase(mockRepo);
    mockRepo.findById.mockResolvedValue(makeOrder());
    mockRepo.tryCancelOrExpirePending.mockResolvedValue(
      makeOrder({ status: OrderStatus.CANCELLED }),
    );

    await noStockUseCase.execute('order-uuid-1', dto('CANCELLED'));

    expect(mockCatalog.incrementStock).not.toHaveBeenCalled();
    expect(mockRepo.markStockRestored).not.toHaveBeenCalled();
  });
});
