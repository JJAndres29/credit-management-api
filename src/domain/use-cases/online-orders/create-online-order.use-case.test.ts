import { CreateOnlineOrderUseCase } from './create-online-order.use-case';
import { CustomError } from '../../errors';
import { CreateOnlineOrderDto } from '../../dtos/online-orders';
import { OnlineOrderRepository } from '../../repositories/online-order.repository';
import { ProductCatalogPort, ProductForOrder } from '../../services/product-catalog.port';
import { IPaymentGateway } from '../../services/payment-gateway.port';
import { OnlineOrderEntity, OrderStatus, OrderPaymentMethod } from '../../entities/online-order.entity';
import { PaginationDto } from '../../dtos/shared';
import { FilterOnlineOrdersDto } from '../../dtos/online-orders';
import { PaginatedResult } from '../../types/paginated.type';

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeProduct = (overrides: Partial<ProductForOrder> = {}): ProductForOrder => ({
  id: 'prod-1',
  name: 'Camisa Azul',
  retailPrice: 50,
  stock: 10,
  isActive: true,
  defaultVariantId: 'var-default-1',
  categoryId: null,
  productIvaRate: null,
  categoryIvaRate: null,
  ...overrides,
});

const makeOrder = (): OnlineOrderEntity =>
  new OnlineOrderEntity(
    'order-uuid-1',
    1001,
    null,
    'Juan Guest',
    '+57300',
    'juan@example.com',
    'Calle 1 #2-3',
    OrderStatus.PENDING_PAYMENT,
    100,
    OrderPaymentMethod.WHATSAPP_MANUAL,
    new Date(Date.now() + 24 * 60 * 60 * 1000),
    null,
    new Date(),
    [],
    null,
    null,
    null,
  );

const makeGuestDto = (overrides: Partial<Record<string, unknown>> = {}): CreateOnlineOrderDto =>
  CreateOnlineOrderDto.create({
    items: [{ productId: 'prod-1', quantity: 2 }],
    paymentMethod: OrderPaymentMethod.WHATSAPP_MANUAL,
    shippingAddress: 'Calle 1 #2-3',
    guestName: 'Juan Guest',
    guestEmail: 'juan@example.com',
    ...overrides,
  })[1]!;

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCatalog: jest.Mocked<ProductCatalogPort> = {
  getForOrder: jest.fn(),
  decrementStockAtomic: jest.fn(),
  incrementStock: jest.fn(),
};

const mockGateway: jest.Mocked<IPaymentGateway> = {
  generatePaymentLink: jest.fn(),
  verifyTransaction: jest.fn(),
  verifyWebhookSignature: jest.fn(),
  parseWebhookEvent: jest.fn(),
};

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

// ─── DTO validation tests ────────────────────────────────────────────────────

describe('CreateOnlineOrderDto.create()', () => {
  it('rechaza items vacío', () => {
    const [error] = CreateOnlineOrderDto.create({
      items: [],
      paymentMethod: OrderPaymentMethod.WHATSAPP_MANUAL,
      shippingAddress: 'Dir 1',
      guestName: 'A',
      guestEmail: 'a@b.com',
    });
    expect(error).toMatch(/items/i);
  });

  it('rechaza quantity <= 0', () => {
    const [error] = CreateOnlineOrderDto.create({
      items: [{ productId: 'p1', quantity: 0 }],
      paymentMethod: OrderPaymentMethod.WHATSAPP_MANUAL,
      shippingAddress: 'Dir 1',
      guestName: 'Ana',
      guestEmail: 'a@b.com',
    });
    expect(error).toMatch(/quantity/i);
  });

  it('rechaza paymentMethod inválido', () => {
    const [error] = CreateOnlineOrderDto.create({
      items: [{ productId: 'p1', quantity: 1 }],
      paymentMethod: 'INVALID',
      shippingAddress: 'Dir 1',
      guestName: 'Ana',
      guestEmail: 'a@b.com',
    });
    expect(error).toMatch(/paymentMethod/i);
  });

  it('rechaza guestEmail inválido cuando hay campos de invitado', () => {
    const [error] = CreateOnlineOrderDto.create({
      items: [{ productId: 'p1', quantity: 1 }],
      paymentMethod: OrderPaymentMethod.WHATSAPP_MANUAL,
      shippingAddress: 'Dir 1',
      guestName: 'Ana',
      guestEmail: 'no-es-email',
    });
    expect(error).toMatch(/guestEmail/i);
  });

  it('rechaza productos duplicados', () => {
    const [error] = CreateOnlineOrderDto.create({
      items: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p1', quantity: 2 },
      ],
      paymentMethod: OrderPaymentMethod.WHATSAPP_MANUAL,
      shippingAddress: 'Dir 1',
      guestName: 'Ana',
      guestEmail: 'ana@test.com',
    });
    expect(error).toMatch(/mismo producto/i);
  });

  it('crea DTO válido para invitado', () => {
    const [error, dto] = CreateOnlineOrderDto.create({
      items: [{ productId: 'p1', quantity: 3 }],
      paymentMethod: OrderPaymentMethod.ONLINE_GATEWAY,
      shippingAddress: '  Carrera 5 #10  ',
      guestName: '  Ana  ',
      guestEmail: '  Ana@EXAMPLE.COM  ',
    });
    expect(error).toBeUndefined();
    expect(dto!.guestEmail).toBe('ana@example.com');
    expect(dto!.guestName).toBe('Ana');
    expect(dto!.shippingAddress).toBe('Carrera 5 #10');
    expect(dto!.items[0].quantity).toBe(3);
  });
});

// ─── Use case tests ──────────────────────────────────────────────────────────

describe('CreateOnlineOrderUseCase', () => {
  let useCase: CreateOnlineOrderUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateOnlineOrderUseCase(mockRepo, mockCatalog);
  });

  describe('retailPrice null → 400', () => {
    it('lanza badRequest si el producto no tiene retailPrice configurado', async () => {
      mockCatalog.getForOrder.mockResolvedValue(makeProduct({ retailPrice: null }));

      await expect(useCase.execute(makeGuestDto(), null)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('precio de venta en línea'),
      });
      expect(mockCatalog.decrementStockAtomic).not.toHaveBeenCalled();
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('producto no encontrado → 404', () => {
    it('lanza notFound si getForOrder retorna null', async () => {
      mockCatalog.getForOrder.mockResolvedValue(null);

      await expect(useCase.execute(makeGuestDto(), null)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('producto inactivo → 400', () => {
    it('lanza badRequest si el producto no está activo', async () => {
      mockCatalog.getForOrder.mockResolvedValue(makeProduct({ isActive: false }));

      await expect(useCase.execute(makeGuestDto(), null)).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('stock insuficiente → 409 (transacción atómica en repositorio)', () => {
    it('propaga conflict del create sin decrementStockAtomic en el use case', async () => {
      const dto = CreateOnlineOrderDto.create({
        items: [
          { productId: 'prod-1', quantity: 2 },
          { productId: 'prod-2', quantity: 3 },
        ],
        paymentMethod: OrderPaymentMethod.WHATSAPP_MANUAL,
        shippingAddress: 'Calle 1',
        guestName: 'Juan',
        guestEmail: 'juan@test.com',
      })[1]!;

      mockCatalog.getForOrder.mockImplementation(async (id) =>
        makeProduct({ id, name: `Product ${id}`, retailPrice: 10 }),
      );
      mockRepo.create.mockRejectedValue(
        CustomError.conflict('Stock insuficiente para el producto "Product prod-2"'),
      );

      await expect(useCase.execute(dto, null)).rejects.toMatchObject({ statusCode: 409 });

      expect(mockCatalog.decrementStockAtomic).not.toHaveBeenCalled();
      expect(mockCatalog.incrementStock).not.toHaveBeenCalled();
      expect(mockRepo.create).toHaveBeenCalled();
    });
  });

  describe('éxito como invitado', () => {
    beforeEach(() => {
      mockCatalog.getForOrder.mockResolvedValue(makeProduct({ retailPrice: 50 }));
      mockRepo.create.mockResolvedValue(makeOrder());
    });

    it('retorna { order, paymentUrl: null }', async () => {
      const result = await useCase.execute(makeGuestDto(), null);
      expect(result.paymentUrl).toBeNull();
      expect(result.order).toBeInstanceOf(OnlineOrderEntity);
    });

    it('total = sum(retailPrice × qty) calculado server-side', async () => {
      await useCase.execute(makeGuestDto(), null);

      const createArg = mockRepo.create.mock.calls[0][0];
      // items: 1 item, quantity=2, retailPrice=50 → total=100
      expect(createArg.totalAmount).toBe(100);
    });

    it('guarda productNameSnapshot del catálogo', async () => {
      await useCase.execute(makeGuestDto(), null);

      const createArg = mockRepo.create.mock.calls[0][0];
      expect(createArg.items[0].productNameSnapshot).toBe('Camisa Azul');
    });

    it('expiresAt = now+24h para WHATSAPP_MANUAL', async () => {
      const before = Date.now();
      await useCase.execute(makeGuestDto(), null);
      const after = Date.now();

      const createArg = mockRepo.create.mock.calls[0][0];
      const expiryMs = createArg.expiresAt.getTime();
      const twentyFourH = 24 * 60 * 60 * 1000;
      expect(expiryMs).toBeGreaterThanOrEqual(before + twentyFourH - 100);
      expect(expiryMs).toBeLessThanOrEqual(after + twentyFourH + 100);
    });

    it('expiresAt = now+30min para ONLINE_GATEWAY', async () => {
      const dto = CreateOnlineOrderDto.create({
        items: [{ productId: 'prod-1', quantity: 2 }],
        paymentMethod: OrderPaymentMethod.ONLINE_GATEWAY,
        shippingAddress: 'Calle 1',
        guestName: 'Ana',
        guestEmail: 'ana@test.com',
      })[1]!;

      mockGateway.generatePaymentLink.mockResolvedValue({ url: 'https://mp.com/pay', gatewayReference: 'pref-1' });
      mockRepo.updatePaymentLink.mockResolvedValue(makeOrder());
      const useCaseWithGateway = new CreateOnlineOrderUseCase(mockRepo, mockCatalog, mockGateway);

      const before = Date.now();
      await useCaseWithGateway.execute(dto, null);
      const after = Date.now();

      const createArg = mockRepo.create.mock.calls[0][0];
      const thirtyMin = 30 * 60 * 1000;
      expect(createArg.expiresAt.getTime()).toBeGreaterThanOrEqual(before + thirtyMin - 100);
      expect(createArg.expiresAt.getTime()).toBeLessThanOrEqual(after + thirtyMin + 100);
    });

    it('pasa guestEmail en createData', async () => {
      await useCase.execute(makeGuestDto(), null);
      const createArg = mockRepo.create.mock.calls[0][0];
      expect(createArg.guestEmail).toBe('juan@example.com');
      expect(createArg.customerId).toBeNull();
    });
  });

  describe('éxito como customer autenticado', () => {
    let useCaseWithGateway: CreateOnlineOrderUseCase;

    beforeEach(() => {
      mockCatalog.getForOrder.mockResolvedValue(makeProduct({ retailPrice: 30 }));
      mockRepo.create.mockResolvedValue(makeOrder());
      mockGateway.generatePaymentLink.mockResolvedValue({ url: 'https://mp.com/pay', gatewayReference: 'pref-1' });
      mockRepo.updatePaymentLink.mockResolvedValue(makeOrder());
      useCaseWithGateway = new CreateOnlineOrderUseCase(mockRepo, mockCatalog, mockGateway);
    });

    it('pasa customerId al repositorio y no guestEmail', async () => {
      const dto = CreateOnlineOrderDto.create({
        items: [{ productId: 'prod-1', quantity: 1 }],
        paymentMethod: OrderPaymentMethod.ONLINE_GATEWAY,
        shippingAddress: 'Av. 10',
      })[1]!;

      await useCaseWithGateway.execute(dto, 'customer-uuid-123');

      const createArg = mockRepo.create.mock.calls[0][0];
      expect(createArg.customerId).toBe('customer-uuid-123');
      expect(createArg.guestEmail).toBeNull();
    });
  });

  describe('fallo al persistir orden', () => {
    it('si create falla, el use case no llama incrementStock (rollback lo hace la transacción Prisma)', async () => {
      mockCatalog.getForOrder.mockResolvedValue(makeProduct({ retailPrice: 20 }));
      mockRepo.create.mockRejectedValue(new Error('DB error'));

      await expect(useCase.execute(makeGuestDto(), null)).rejects.toThrow('DB error');
      expect(mockCatalog.incrementStock).not.toHaveBeenCalled();
    });
  });
});
