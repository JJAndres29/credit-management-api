/**
 * Tests — Bloque 1c: CreatePaymentUseCase
 *
 * Sin mocks de infraestructura, sin DB, sin HTTP.
 * Todos los colaboradores se reemplazan con jest.fn().
 */

import { CreatePaymentUseCase } from './create-payment.use-case';
import { CreatePaymentDto } from '../../dtos/payments';
import { ClientRepository } from '../../repositories';
import { PaymentRepository } from '../../repositories';
import { SaleRepository } from '../../repositories';
import { EventEmitterPort, PAYMENT_REGISTERED } from '../../events';
import { ClientEntity } from '../../entities/client.entity';
import { PaymentEntity } from '../../entities/payment.entity';
import { SaleEntity, SaleItemEntity, SaleType, SaleStatus } from '../../entities/sale.entity';
import { AuditAction } from '../../entities/audit-log.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient(overrides: Partial<{
  id: string;
  balance: number;
  isActive: boolean;
}> = {}): ClientEntity {
  return new ClientEntity(
    overrides.id ?? 'client-1',
    'Ana Gómez',
    '555-9999',
    'ana@example.com',
    'CC',
    '12345678',
    'Calle 1 # 2-3',
    'Centro',
    5_000,
    overrides.balance ?? 300,
    overrides.isActive ?? true,
    new Date(),
    new Date(),
  );
}

function makeSale(overrides: Partial<{
  id: string;
  clientId: string;
  status: SaleStatus;
  total: number;
}> = {}): SaleEntity {
  return new SaleEntity(
    overrides.id ?? 'sale-1',
    1000,
    overrides.clientId ?? 'client-1',
    SaleType.CREDIT,
    overrides.status ?? SaleStatus.PENDING,
    overrides.total ?? 300,
    new Date(),
    [
      new SaleItemEntity('item-1', overrides.id ?? 'sale-1', 'prod-1', 1, 300, 300, 300, 'CREDIT_SURCHARGE_0PCT'),
    ],
  );
}

function makePayment(overrides: Partial<{
  id: string;
  clientId: string;
  saleId: string | null;
  amount: number;
}> = {}): PaymentEntity {
  return new PaymentEntity(
    overrides.id ?? 'pay-1',
    overrides.clientId ?? 'client-1',
    overrides.saleId ?? 'sale-1',
    null,
    overrides.amount ?? 100,
    null,
    new Date(),
  );
}

function makeDto(overrides: Partial<{
  clientId: string;
  amount: number;
  saleId: string | null;
  note: string | null;
}> = {}): CreatePaymentDto {
  const [error, dto] = CreatePaymentDto.create({
    clientId: overrides.clientId ?? 'client-1',
    amount: overrides.amount ?? 100,
    saleId: overrides.saleId ?? null,
    note: overrides.note ?? null,
  });
  if (error) throw new Error(`makeDto failed: ${error}`);
  return dto!;
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockClientRepo = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findByDocument: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
} as jest.Mocked<ClientRepository>;

const mockPaymentRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findByClientId: jest.fn(),
  findBySaleId: jest.fn(),
  findBySaleIds: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as jest.Mocked<PaymentRepository>;

const mockSaleRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findByClientId: jest.fn(),
  findActiveCreditSales: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as jest.Mocked<SaleRepository>;

const mockEventEmitter: jest.Mocked<EventEmitterPort> = {
  on: jest.fn(),
  emit: jest.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CreatePaymentUseCase', () => {
  let useCase: CreatePaymentUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreatePaymentUseCase(
      mockPaymentRepo,
      mockClientRepo,
      mockSaleRepo,
      mockEventEmitter,
    );
  });

  // ─── Errores: cliente ──────────────────────────────────────────────────────

  describe('cuando el cliente no existe', () => {
    it('lanza CustomError 404', async () => {
      mockClientRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute(makeDto(), 'user-1', '127.0.0.1')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('client-1'),
      });
    });
  });

  describe('cuando el cliente está inactivo', () => {
    it('lanza CustomError 400', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient({ isActive: false }));

      await expect(useCase.execute(makeDto(), 'user-1', '127.0.0.1')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('no está activo'),
      });
    });
  });

  // ─── Errores: monto > balance ──────────────────────────────────────────────

  describe('cuando el monto supera el balance del cliente', () => {
    it('lanza CustomError 400 con monto y balance en el mensaje', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 50 }));
      // dto.amount = 100, balance = 50 → inválido

      await expect(useCase.execute(makeDto({ amount: 100 }), 'user-1', '127.0.0.1')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('balance actual'),
      });
    });

    it('acepta el pago cuando el monto es exactamente igual al balance', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 100 }));
      mockPaymentRepo.create.mockResolvedValue(makePayment({ amount: 100 }));

      await expect(
        useCase.execute(makeDto({ amount: 100, saleId: null }), 'user-1', '127.0.0.1'),
      ).resolves.toBeDefined();
    });
  });

  // ─── Errores: venta ajena ──────────────────────────────────────────────────

  describe('cuando la venta pertenece a otro cliente', () => {
    it('lanza CustomError 403', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient({ id: 'client-1' }));
      // La venta tiene clientId diferente
      mockSaleRepo.findById.mockResolvedValue(makeSale({ clientId: 'client-OTRO' }));

      await expect(
        useCase.execute(makeDto({ saleId: 'sale-1' }), 'user-1', '127.0.0.1'),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('no pertenece al cliente'),
      });
    });
  });

  describe('cuando la venta no existe', () => {
    it('lanza CustomError 404', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockSaleRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute(makeDto({ saleId: 'sale-inexistente' }), 'user-1', '127.0.0.1'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('cuando la venta ya está pagada (PAID)', () => {
    it('lanza CustomError 400', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockSaleRepo.findById.mockResolvedValue(makeSale({ status: SaleStatus.PAID }));

      await expect(
        useCase.execute(makeDto({ saleId: 'sale-1' }), 'user-1', '127.0.0.1'),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('completamente pagada'),
      });
    });
  });

  describe('cuando el monto supera lo pendiente de la venta', () => {
    it('lanza CustomError 400 con el pendiente en el mensaje', async () => {
      // Venta: total 300. Ya pagados: 250. Pendiente: 50.
      // Intentamos pagar 100 → debe rechazar
      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 300 }));
      mockSaleRepo.findById.mockResolvedValue(makeSale({ total: 300 }));
      mockPaymentRepo.findBySaleId.mockResolvedValue([
        makePayment({ amount: 250 }),
      ]);

      await expect(
        useCase.execute(makeDto({ amount: 100, saleId: 'sale-1' }), 'user-1', '127.0.0.1'),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('pendiente'),
      });
    });
  });

  // ─── Lógica de pago ────────────────────────────────────────────────────────

  describe('pago que liquida la venta (total = saldo pendiente)', () => {
    it('pasa saleTotal al repositorio para que calcule status PAID', async () => {
      // Venta: total 300, nada pagado aún, pagamos 300
      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 300 }));
      mockSaleRepo.findById.mockResolvedValue(makeSale({ total: 300 }));
      mockPaymentRepo.findBySaleId.mockResolvedValue([]); // sin pagos previos
      mockPaymentRepo.create.mockResolvedValue(makePayment({ amount: 300 }));

      await useCase.execute(makeDto({ amount: 300, saleId: 'sale-1' }), 'user-1', '127.0.0.1');

      expect(mockPaymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ saleTotal: 300 }),
      );
    });
  });

  describe('pago parcial', () => {
    it('pasa saleTotal al repositorio para que calcule status PARTIAL', async () => {
      // Venta: total 300, pagamos 100 (parcial)
      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 300 }));
      mockSaleRepo.findById.mockResolvedValue(makeSale({ total: 300 }));
      mockPaymentRepo.findBySaleId.mockResolvedValue([]); // sin pagos previos
      mockPaymentRepo.create.mockResolvedValue(makePayment({ amount: 100 }));

      await useCase.execute(makeDto({ amount: 100, saleId: 'sale-1' }), 'user-1', '127.0.0.1');

      expect(mockPaymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ saleTotal: 300 }),
      );
    });
  });

  describe('abono general (sin saleId)', () => {
    it('pasa saleId null y saleTotal undefined al repositorio', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 300 }));
      mockPaymentRepo.create.mockResolvedValue(makePayment({ saleId: null }));

      await useCase.execute(makeDto({ amount: 100, saleId: null }), 'user-1', '127.0.0.1');

      expect(mockPaymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          saleId: null,
          saleTotal: undefined,
        }),
      );
    });

    it('no consulta saleRepository cuando saleId es null', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 300 }));
      mockPaymentRepo.create.mockResolvedValue(makePayment({ saleId: null }));

      await useCase.execute(makeDto({ amount: 100, saleId: null }), 'user-1', '127.0.0.1');

      expect(mockSaleRepo.findById).not.toHaveBeenCalled();
    });
  });

  // ─── AuditLog ─────────────────────────────────────────────────────────────

  describe('auditLog', () => {
    it('registra before = balance antes del pago', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 300 }));
      mockPaymentRepo.create.mockResolvedValue(makePayment({ amount: 100 }));

      await useCase.execute(makeDto({ amount: 100, saleId: null }), 'user-1', '127.0.0.1');

      expect(mockPaymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auditLog: expect.objectContaining({
            action: AuditAction.PAYMENT,
            before: 300,
            after: 200,
          }),
        }),
      );
    });

    it('registra userId e ip del usuario autenticado', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 300 }));
      mockPaymentRepo.create.mockResolvedValue(makePayment({ amount: 100 }));

      await useCase.execute(makeDto({ amount: 100, saleId: null }), 'user-audit', '10.0.0.1');

      expect(mockPaymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auditLog: expect.objectContaining({
            userId: 'user-audit',
            ip: '10.0.0.1',
          }),
        }),
      );
    });

    it('after = before - amount', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 500 }));
      mockPaymentRepo.create.mockResolvedValue(makePayment({ amount: 150 }));

      await useCase.execute(makeDto({ amount: 150, saleId: null }), 'user-1', '127.0.0.1');

      expect(mockPaymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auditLog: expect.objectContaining({
            before: 500,
            after: 350,
          }),
        }),
      );
    });
  });

  // ─── Evento PAYMENT_REGISTERED ────────────────────────────────────────────

  describe('evento PAYMENT_REGISTERED', () => {
    it('emite el evento después de persistir el pago', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 300 }));
      mockPaymentRepo.create.mockResolvedValue(makePayment({ id: 'pay-99', amount: 100 }));

      await useCase.execute(makeDto({ amount: 100, saleId: null }), 'user-1', '127.0.0.1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        PAYMENT_REGISTERED,
        expect.objectContaining({
          paymentId: 'pay-99',
          clientId: 'client-1',
          amount: 100,
          newBalance: 200,
        }),
      );
    });

    it('emite el evento incluso en pagos sin saleId', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 300 }));
      mockPaymentRepo.create.mockResolvedValue(makePayment({ saleId: null }));

      await useCase.execute(makeDto({ amount: 100, saleId: null }), 'user-1', '127.0.0.1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(PAYMENT_REGISTERED, expect.anything());
    });

    it('el evento incluye note cuando está presente', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 300 }));
      mockPaymentRepo.create.mockResolvedValue(makePayment({ amount: 100 }));

      await useCase.execute(makeDto({ amount: 100, saleId: null, note: 'Pago cuota enero' }), 'user-1', '127.0.0.1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        PAYMENT_REGISTERED,
        expect.objectContaining({ note: 'Pago cuota enero' }),
      );
    });
  });

  // ─── Sin event emitter ────────────────────────────────────────────────────

  describe('cuando no se inyecta eventEmitter', () => {
    it('no lanza error aunque no haya event emitter', async () => {
      const useCaseNoEmitter = new CreatePaymentUseCase(
        mockPaymentRepo,
        mockClientRepo,
        mockSaleRepo,
        // eventEmitter omitido
      );

      mockClientRepo.findById.mockResolvedValue(makeClient({ balance: 300 }));
      mockPaymentRepo.create.mockResolvedValue(makePayment({ amount: 100 }));

      await expect(
        useCaseNoEmitter.execute(makeDto({ amount: 100, saleId: null }), 'user-1', '127.0.0.1'),
      ).resolves.toBeDefined();
    });
  });
});
