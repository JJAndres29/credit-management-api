/**
 * Tests — Bloque 1b: CreateSaleUseCase
 *
 * Sin mocks de infraestructura, sin DB, sin HTTP.
 * Todos los colaboradores se reemplazan con jest.fn().
 *
 * El precio unitario ahora se define en el request (por el vendedor en el momento
 * de la venta). Ya no existe PricingService — el use case no calcula precios.
 */

import { CreateSaleUseCase } from './create-sale.use-case';
import { CreateSaleDto } from '../../dtos/sales';
import { ClientRepository } from '../../repositories';
import { ProductRepository } from '../../repositories';
import { SaleRepository } from '../../repositories';
import { EventEmitterPort, CREDIT_SALE_CREATED } from '../../events';
import { ClientEntity } from '../../entities/client.entity';
import { ProductEntity } from '../../entities/product.entity';
import { SaleEntity, SaleItemEntity, SaleType, SaleStatus } from '../../entities/sale.entity';
import { AuditAction } from '../../entities/audit-log.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient(overrides: Partial<{
  id: string;
  balance: number;
  creditLimit: number;
  isActive: boolean;
}> = {}): ClientEntity {
  return new ClientEntity(
    overrides.id ?? 'client-1',
    'Juan Pérez',
    '555-1234',
    'juan@example.com',
    'CC',
    '12345678',
    'Calle 1 # 2-3',
    'Centro',
    overrides.creditLimit ?? 10_000,
    overrides.balance ?? 0,
    overrides.isActive ?? true,
    new Date(),
    new Date(),
  );
}

function makeProduct(overrides: Partial<{
  id: string;
  stock: number;
  isActive: boolean;
}> = {}): ProductEntity {
  return new ProductEntity(
    overrides.id ?? 'prod-1',
    'Producto Test',
    overrides.stock ?? 50,
    [],
    overrides.isActive ?? true,
    new Date(),
    new Date(),
  );
}

function makeSale(type: SaleType, status: SaleStatus, total: number): SaleEntity {
  return new SaleEntity(
    'sale-1',
    1000,
    'client-1',
    type,
    status,
    total,
    new Date(),
    [
      new SaleItemEntity('item-1', 'sale-1', 'prod-1', 2, 100, 100, 200, null),
    ],
  );
}

/** items now require unitPrice */
function makeDto(
  type: SaleType,
  items = [{ productId: 'prod-1', quantity: 2, unitPrice: 100 }],
): CreateSaleDto {
  const [error, dto] = CreateSaleDto.create({ clientId: 'client-1', type, items });
  if (error) throw new Error(`makeDto failed: ${error}`);
  return dto!;
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockClientRepo = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
} as jest.Mocked<ClientRepository>;

const mockProductRepo = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  adjustStock: jest.fn(),
  delete: jest.fn(),
  addImages: jest.fn(),
  removeImage: jest.fn(),
} as jest.Mocked<ProductRepository>;

const mockSaleRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findByClientId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as jest.Mocked<SaleRepository>;

const mockEventEmitter: jest.Mocked<EventEmitterPort> = {
  on: jest.fn(),
  emit: jest.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CreateSaleUseCase', () => {
  let useCase: CreateSaleUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateSaleUseCase(
      mockSaleRepo,
      mockClientRepo,
      mockProductRepo,
      mockEventEmitter,
    );
  });

  // ─── Errores de validación ─────────────────────────────────────────────────

  describe('cuando el cliente no existe', () => {
    it('lanza CustomError 404', async () => {
      mockClientRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute(makeDto(SaleType.CASH), 'user-1', '127.0.0.1')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('client-1'),
      });
    });

    it('no intenta buscar productos si el cliente no existe', async () => {
      mockClientRepo.findById.mockResolvedValue(null);

      await useCase.execute(makeDto(SaleType.CASH), 'user-1', '127.0.0.1').catch(() => {});

      expect(mockProductRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe('cuando el producto no existe', () => {
    it('lanza CustomError 404 con el ID del producto', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockProductRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute(makeDto(SaleType.CASH), 'user-1', '127.0.0.1')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('prod-1'),
      });
    });
  });

  describe('cuando el producto está inactivo', () => {
    it('lanza CustomError 400', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockProductRepo.findById.mockResolvedValue(makeProduct({ isActive: false }));

      await expect(useCase.execute(makeDto(SaleType.CASH), 'user-1', '127.0.0.1')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('no está disponible'),
      });
    });
  });

  describe('cuando el stock es insuficiente', () => {
    it('lanza CustomError 400 mencionando disponible y solicitado', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      // stock: 1, pero el DTO pide quantity: 2
      mockProductRepo.findById.mockResolvedValue(makeProduct({ stock: 1 }));

      await expect(useCase.execute(makeDto(SaleType.CASH), 'user-1', '127.0.0.1')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Stock insuficiente'),
      });
    });

    it('lanza 400 cuando stock es exactamente 0', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockProductRepo.findById.mockResolvedValue(makeProduct({ stock: 0 }));

      await expect(useCase.execute(makeDto(SaleType.CASH), 'user-1', '127.0.0.1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('cuando el crédito es insuficiente (CREDIT)', () => {
    it('lanza CustomError 400 con el crédito disponible y requerido', async () => {
      // creditLimit: 100, balance: 80 → disponible: 20, pero total será 200 (2 × $100)
      mockClientRepo.findById.mockResolvedValue(makeClient({ creditLimit: 100, balance: 80 }));
      mockProductRepo.findById.mockResolvedValue(makeProduct({ stock: 50 }));

      // total = 100 * 2 = 200, disponible = 20 → debe fallar
      await expect(
        useCase.execute(makeDto(SaleType.CREDIT, [{ productId: 'prod-1', quantity: 2, unitPrice: 100 }]), 'user-1', '127.0.0.1'),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Crédito insuficiente'),
      });
    });

    it('acepta la venta cuando el crédito disponible es exactamente igual al total', async () => {
      const total = 200; // 2 × $100
      mockClientRepo.findById.mockResolvedValue(makeClient({ creditLimit: 200, balance: 0 }));
      mockProductRepo.findById.mockResolvedValue(makeProduct({ stock: 50 }));
      mockSaleRepo.create.mockResolvedValue(makeSale(SaleType.CREDIT, SaleStatus.PENDING, total));

      await expect(
        useCase.execute(makeDto(SaleType.CREDIT, [{ productId: 'prod-1', quantity: 2, unitPrice: 100 }]), 'user-1', '127.0.0.1'),
      ).resolves.toBeDefined();
    });
  });

  // ─── Venta CASH ───────────────────────────────────────────────────────────

  describe('venta CASH', () => {
    beforeEach(() => {
      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 500 }));
      mockProductRepo.findById.mockResolvedValue(makeProduct({ stock: 50 }));
      mockSaleRepo.create.mockResolvedValue(makeSale(SaleType.CASH, SaleStatus.PAID, 200));
    });

    it('llama a saleRepository.create sin auditLog (balance no cambia en CASH)', async () => {
      await useCase.execute(makeDto(SaleType.CASH), 'user-1', '127.0.0.1');

      expect(mockSaleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ auditLog: undefined }),
      );
    });

    it('NO emite evento CREDIT_SALE_CREATED', async () => {
      await useCase.execute(makeDto(SaleType.CASH), 'user-1', '127.0.0.1');

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('retorna la entidad de venta devuelta por el repositorio', async () => {
      const { sale } = await useCase.execute(makeDto(SaleType.CASH), 'user-1', '127.0.0.1');

      expect(sale.type).toBe(SaleType.CASH);
      expect(sale.status).toBe(SaleStatus.PAID);
    });

    it('pasa el tipo CASH al repositorio', async () => {
      await useCase.execute(makeDto(SaleType.CASH), 'user-1', '127.0.0.1');

      expect(mockSaleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: SaleType.CASH }),
      );
    });

    it('calcula el total correcto (unitPrice × quantity)', async () => {
      await useCase.execute(makeDto(SaleType.CASH), 'user-1', '127.0.0.1');

      // quantity=2, unitPrice=100 → total=200
      expect(mockSaleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ total: 200 }),
      );
    });

    it('usa el unitPrice del DTO directamente en los ítems', async () => {
      await useCase.execute(
        makeDto(SaleType.CASH, [{ productId: 'prod-1', quantity: 2, unitPrice: 150 }]),
        'user-1', '127.0.0.1',
      );

      expect(mockSaleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ unitPrice: 150, subtotal: 300 }),
          ]),
        }),
      );
    });
  });

  // ─── Venta CREDIT ─────────────────────────────────────────────────────────

  describe('venta CREDIT', () => {
    const client = makeClient({ balance: 0, creditLimit: 10_000 });

    beforeEach(() => {
      mockClientRepo.findById.mockResolvedValue(client);
      mockProductRepo.findById.mockResolvedValue(makeProduct({ stock: 50 }));
      mockSaleRepo.create.mockResolvedValue(makeSale(SaleType.CREDIT, SaleStatus.PENDING, 200));
    });

    it('emite CREDIT_SALE_CREATED con los datos correctos', async () => {
      await useCase.execute(makeDto(SaleType.CREDIT), 'user-1', '127.0.0.1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        CREDIT_SALE_CREATED,
        expect.objectContaining({
          clientId: 'client-1',
          total: 200, // 100 × 2
        }),
      );
    });

    it('emite newBalance = balance anterior + total', async () => {
      await useCase.execute(makeDto(SaleType.CREDIT), 'user-1', '127.0.0.1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        CREDIT_SALE_CREATED,
        expect.objectContaining({ newBalance: 0 + 200 }),
      );
    });

    it('pasa auditLog con action CREDIT_SALE, before y after correctos', async () => {
      await useCase.execute(makeDto(SaleType.CREDIT), 'user-1', '127.0.0.1');

      expect(mockSaleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auditLog: expect.objectContaining({
            action: AuditAction.CREDIT_SALE,
            before: 0,
            after: 200,
            userId: 'user-1',
            ip: '127.0.0.1',
          }),
        }),
      );
    });

    it('el ítem tiene appliedRule null (precio manual sin regla automática)', async () => {
      await useCase.execute(makeDto(SaleType.CREDIT), 'user-1', '127.0.0.1');

      expect(mockSaleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ appliedRule: null }),
          ]),
        }),
      );
    });

    it('retorna la entidad de venta con status PENDING', async () => {
      const { sale } = await useCase.execute(makeDto(SaleType.CREDIT), 'user-1', '127.0.0.1');

      expect(sale.status).toBe(SaleStatus.PENDING);
    });
  });

  // ─── collectionDay ────────────────────────────────────────────────────────

  describe('collectionDay / collectionDay2', () => {
    beforeEach(() => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockProductRepo.findById.mockResolvedValue(makeProduct({ stock: 50 }));
      mockSaleRepo.create.mockResolvedValue(makeSale(SaleType.CREDIT, SaleStatus.PENDING, 200));
    });

    it('pasa collectionDay al repositorio cuando se define en plan MONTHLY', async () => {
      const [, dto] = CreateSaleDto.create({
        clientId: 'client-1',
        type: SaleType.CREDIT,
        items: [{ productId: 'prod-1', quantity: 2, unitPrice: 100 }],
        installmentsCount: 3,
        frequency: 'MONTHLY',
        collectionDay: 30,
      });

      await useCase.execute(dto!, 'user-1', '127.0.0.1');

      expect(mockSaleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ collectionDay: 30, collectionDay2: undefined }),
      );
    });

    it('pasa ambos días al repositorio cuando se define en plan BIWEEKLY', async () => {
      const [, dto] = CreateSaleDto.create({
        clientId: 'client-1',
        type: SaleType.CREDIT,
        items: [{ productId: 'prod-1', quantity: 2, unitPrice: 100 }],
        installmentsCount: 6,
        frequency: 'BIWEEKLY',
        collectionDay: 15,
        collectionDay2: 30,
      });

      await useCase.execute(dto!, 'user-1', '127.0.0.1');

      expect(mockSaleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ collectionDay: 15, collectionDay2: 30 }),
      );
    });
  });

  // ─── Sin event emitter ────────────────────────────────────────────────────

  describe('cuando no se inyecta eventEmitter', () => {
    it('CREDIT: no lanza error aunque no haya event emitter', async () => {
      const useCaseNoEmitter = new CreateSaleUseCase(
        mockSaleRepo,
        mockClientRepo,
        mockProductRepo,
        // eventEmitter omitido
      );

      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockProductRepo.findById.mockResolvedValue(makeProduct());
      mockSaleRepo.create.mockResolvedValue(makeSale(SaleType.CREDIT, SaleStatus.PENDING, 200));

      await expect(
        useCaseNoEmitter.execute(makeDto(SaleType.CREDIT), 'user-1', '127.0.0.1'),
      ).resolves.toBeDefined();
    });
  });
});
