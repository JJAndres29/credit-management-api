/**
 * Tests — E6-T3: GetCollectionsUseCase
 *
 * Verifica:
 *  - Resultado vacío cuando no hay ventas activas.
 *  - Delegación al schedule service por cada venta.
 *  - Filtros: status, dueFrom/dueTo.
 *  - Bulk-load de pagos: una sola llamada a findBySaleIds.
 *  - Lookups de nombres de cliente: una llamada por clientId único.
 *  - Paginación en memoria.
 *  - Exclusión de ventas sin installmentsCount o frequency (fallback seguro).
 */

import { GetCollectionsUseCase } from './get-collections.use-case';
import { SaleRepository } from '../../repositories/sale.repository';
import { PaymentRepository } from '../../repositories/payment.repository';
import { ClientRepository } from '../../repositories/client.repository';
import {
  InstallmentScheduleService,
  InstallmentSchedule,
  Installment,
} from '../../services/installments';
import { PaginationDto } from '../../dtos/shared';
import { FilterInstallmentsDto } from '../../dtos/collections';
import { SaleEntity, SaleType, SaleStatus, InstallmentFrequency, SaleItemEntity } from '../../entities/sale.entity';
import { PaymentEntity } from '../../entities/payment.entity';
import { ClientEntity } from '../../entities/client.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCreditSale(overrides: Partial<{
  id: string;
  saleNumber: number;
  clientId: string;
  installmentsCount: number | null;
  frequency: InstallmentFrequency | null;
}> = {}): SaleEntity {
  // Use !== undefined so explicit null is preserved (null ?? x falls back to x)
  const installmentsCount = overrides.installmentsCount !== undefined ? overrides.installmentsCount : 6;
  const frequency = overrides.frequency !== undefined ? overrides.frequency : InstallmentFrequency.MONTHLY;
  return new SaleEntity(
    overrides.id ?? 'sale-1',
    overrides.saleNumber ?? 1001,
    overrides.clientId ?? 'client-1',
    SaleType.CREDIT,
    SaleStatus.PENDING,
    600,
    new Date(2026, 0, 1),
    [new SaleItemEntity('item-1', 'sale-1', 'prod-1', 6, null, 100, 600, null)],
    installmentsCount,
    frequency,
    100,
    15,
    null,
    null,
  );
}

function makePayment(saleId: string, amount: number): PaymentEntity {
  return new PaymentEntity(
    `pay-${Math.random().toString(36).slice(2)}`,
    'client-1',
    saleId,
    null,
    amount,
    null,
    new Date(),
  );
}

function makeClient(id = 'client-1', name = 'Juan Pérez'): ClientEntity {
  return new ClientEntity(
    id, name, '555-1234', 'juan@example.com',
    'CC', '12345678', 'Calle 1', 'Centro',
    10_000, 0, true, new Date(), new Date(),
  );
}

function makeInstallment(
  idx: number,
  status: Installment['status'],
  dueDate: Date,
  remainingAmount = 100,
  paidAmount = 0,
): Installment {
  return {
    index: idx,
    dueDate,
    expectedAmount: 100,
    paidAmount,
    remainingAmount,
    status,
    daysOverdue: status === 'OVERDUE' ? 10 : 0,
  };
}

function makeSchedule(
  saleId: string,
  clientId: string,
  installments: Installment[],
): InstallmentSchedule {
  return {
    saleId,
    saleNumber: 1001,
    clientId,
    installmentsCount: 6,
    installmentAmount: 100,
    initialPayment: 0,
    totalPaid: 0,
    installments,
  };
}

const [, defaultPagination] = PaginationDto.create({ page: '1', limit: '20' });
const [, noFilters] = FilterInstallmentsDto.create({});

// ─── Mocks ───────────────────────────────────────────────────────────────────

function buildMocks(
  sales: SaleEntity[] = [],
  payments: PaymentEntity[] = [],
  clients: ClientEntity[] = [],
  scheduleFactory: (sale: SaleEntity) => InstallmentSchedule = (sale) =>
    makeSchedule(sale.id, sale.clientId, []),
) {
  const mockSaleRepo: jest.Mocked<Pick<SaleRepository, 'findActiveCreditSales'>> = {
    findActiveCreditSales: jest.fn().mockResolvedValue(sales),
  };
  const mockPaymentRepo: jest.Mocked<Pick<PaymentRepository, 'findBySaleIds'>> = {
    findBySaleIds: jest.fn().mockResolvedValue(payments),
  };
  const mockClientRepo: jest.Mocked<Pick<ClientRepository, 'findById'>> = {
    findById: jest.fn().mockImplementation((id: string) => {
      const c = clients.find((cl) => cl.id === id);
      return Promise.resolve(c ?? null);
    }),
  };
  const mockScheduleService: InstallmentScheduleService = {
    compute: jest.fn().mockImplementation(scheduleFactory),
  } as unknown as InstallmentScheduleService;

  const useCase = new GetCollectionsUseCase(
    mockSaleRepo as unknown as SaleRepository,
    mockPaymentRepo as unknown as PaymentRepository,
    mockClientRepo as unknown as ClientRepository,
    mockScheduleService,
  );

  return { useCase, mockSaleRepo, mockPaymentRepo, mockClientRepo, mockScheduleService };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GetCollectionsUseCase', () => {
  describe('sin ventas activas', () => {
    it('retorna data vacía y paginación con total=0', async () => {
      const { useCase } = buildMocks([]);
      const result = await useCase.execute(defaultPagination!, noFilters!);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
    });
  });

  describe('anti-N+1 — una sola query de pagos', () => {
    it('llama findBySaleIds con todos los saleIds en una sola invocación', async () => {
      const sales = [
        makeCreditSale({ id: 'sale-1', clientId: 'client-1' }),
        makeCreditSale({ id: 'sale-2', clientId: 'client-1' }),
      ];
      const { useCase, mockPaymentRepo } = buildMocks(sales, [], [makeClient()]);

      await useCase.execute(defaultPagination!, noFilters!);

      expect(mockPaymentRepo.findBySaleIds).toHaveBeenCalledTimes(1);
      expect(mockPaymentRepo.findBySaleIds).toHaveBeenCalledWith(
        expect.arrayContaining(['sale-1', 'sale-2']),
      );
    });
  });

  describe('resolución de nombres de cliente', () => {
    it('una sola query por clientId único (no por venta)', async () => {
      // Dos ventas del mismo cliente → solo 1 lookup de clientId
      const sales = [
        makeCreditSale({ id: 'sale-1', clientId: 'client-1' }),
        makeCreditSale({ id: 'sale-2', clientId: 'client-1' }),
      ];
      const { useCase, mockClientRepo } = buildMocks(sales, [], [makeClient('client-1')]);

      await useCase.execute(defaultPagination!, noFilters!);

      expect(mockClientRepo.findById).toHaveBeenCalledTimes(1);
      expect(mockClientRepo.findById).toHaveBeenCalledWith('client-1');
    });

    it('usa el nombre del cliente en cada item del resultado', async () => {
      const sale = makeCreditSale();
      const dueDate = new Date(2026, 5, 15); // Jun 15

      const { useCase } = buildMocks(
        [sale],
        [],
        [makeClient('client-1', 'María García')],
        () => makeSchedule('sale-1', 'client-1', [makeInstallment(1, 'PENDING', dueDate)]),
      );

      const result = await useCase.execute(defaultPagination!, noFilters!);

      expect(result.data[0].clientName).toBe('María García');
    });

    it('usa fallback si el cliente no existe en el repo', async () => {
      const sale = makeCreditSale({ id: 'sale-1', clientId: 'ghost-client' });
      const dueDate = new Date(2026, 5, 15);

      const { useCase } = buildMocks(
        [sale],
        [],
        [], // no hay cliente en el repo
        () => makeSchedule('sale-1', 'ghost-client', [makeInstallment(1, 'PENDING', dueDate)]),
      );

      const result = await useCase.execute(defaultPagination!, noFilters!);

      expect(result.data[0].clientName).toContain('ghost-c'); // slice(0,8)
    });
  });

  describe('filtro por status', () => {
    it('status=OVERDUE excluye cuotas PENDING y PARTIAL', async () => {
      const sale = makeCreditSale();
      const d = new Date(2026, 5, 15);

      const [, overdueFilter] = FilterInstallmentsDto.create({ status: 'OVERDUE' });

      const { useCase } = buildMocks(
        [sale],
        [],
        [makeClient()],
        () =>
          makeSchedule('sale-1', 'client-1', [
            makeInstallment(1, 'OVERDUE', d),
            makeInstallment(2, 'PENDING', d),
            makeInstallment(3, 'PARTIAL', d),
          ]),
      );

      const result = await useCase.execute(defaultPagination!, overdueFilter!);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('OVERDUE');
    });

    it('sin filtro de status retorna todas las cuotas', async () => {
      const sale = makeCreditSale();
      const d = new Date(2026, 5, 15);

      const { useCase } = buildMocks(
        [sale],
        [],
        [makeClient()],
        () =>
          makeSchedule('sale-1', 'client-1', [
            makeInstallment(1, 'OVERDUE', d),
            makeInstallment(2, 'PENDING', d),
            makeInstallment(3, 'PAID', d),
          ]),
      );

      const result = await useCase.execute(defaultPagination!, noFilters!);

      expect(result.data).toHaveLength(3);
    });
  });

  describe('filtro por fecha (dueFrom / dueTo)', () => {
    it('dueFrom excluye cuotas anteriores a la fecha', async () => {
      const sale = makeCreditSale();
      const jan = new Date(2026, 0, 15);
      const jun = new Date(2026, 5, 15);

      const [, filter] = FilterInstallmentsDto.create({ dueFrom: '2026-05-01' });

      const { useCase } = buildMocks(
        [sale],
        [],
        [makeClient()],
        () =>
          makeSchedule('sale-1', 'client-1', [
            makeInstallment(1, 'PENDING', jan),
            makeInstallment(2, 'PENDING', jun),
          ]),
      );

      const result = await useCase.execute(defaultPagination!, filter!);

      // Solo Jun 15 está después del 2026-05-01
      expect(result.data).toHaveLength(1);
      expect(result.data[0].installmentIndex).toBe(2);
    });

    it('dueTo excluye cuotas posteriores a la fecha', async () => {
      const sale = makeCreditSale();
      const jan = new Date(2026, 0, 15);
      const jun = new Date(2026, 5, 15);

      const [, filter] = FilterInstallmentsDto.create({ dueTo: '2026-03-31' });

      const { useCase } = buildMocks(
        [sale],
        [],
        [makeClient()],
        () =>
          makeSchedule('sale-1', 'client-1', [
            makeInstallment(1, 'PENDING', jan),
            makeInstallment(2, 'PENDING', jun),
          ]),
      );

      const result = await useCase.execute(defaultPagination!, filter!);

      // Solo Jan 15 está antes de Mar 31
      expect(result.data).toHaveLength(1);
      expect(result.data[0].installmentIndex).toBe(1);
    });

    it('atajo month=YYYY-MM filtra correctamente el mes completo', async () => {
      const sale = makeCreditSale();
      const jan = new Date(2026, 0, 15); // dentro del mes
      const feb = new Date(2026, 1, 15); // fuera del mes

      const [, filter] = FilterInstallmentsDto.create({ month: '2026-01' });

      const { useCase } = buildMocks(
        [sale],
        [],
        [makeClient()],
        () =>
          makeSchedule('sale-1', 'client-1', [
            makeInstallment(1, 'PENDING', jan),
            makeInstallment(2, 'PENDING', feb),
          ]),
      );

      const result = await useCase.execute(defaultPagination!, filter!);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].dueDate).toEqual(jan);
    });
  });

  describe('filtro por clientId', () => {
    it('pasa el clientId al repo para filtrar en la query de ventas', async () => {
      const [, filter] = FilterInstallmentsDto.create({ clientId: 'client-99' });
      const { useCase, mockSaleRepo } = buildMocks([]);

      await useCase.execute(defaultPagination!, filter!);

      expect(mockSaleRepo.findActiveCreditSales).toHaveBeenCalledWith('client-99');
    });
  });

  describe('paginación en memoria', () => {
    it('respeta page y limit', async () => {
      const sale = makeCreditSale();
      const d = new Date(2026, 5, 15);
      // 5 cuotas
      const installments = [1, 2, 3, 4, 5].map((i) =>
        makeInstallment(i, 'PENDING', new Date(d.getTime() + i * 86400000)),
      );

      const { useCase } = buildMocks(
        [sale],
        [],
        [makeClient()],
        () => makeSchedule('sale-1', 'client-1', installments),
      );

      const [, pag] = PaginationDto.create({ page: '2', limit: '2' });
      const result = await useCase.execute(pag!, noFilters!);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPrevPage).toBe(true);
    });

    it('resultado se ordena por dueDate ascendente antes de paginar', async () => {
      const sale = makeCreditSale();
      const later = new Date(2026, 5, 20);
      const sooner = new Date(2026, 4, 15);

      const { useCase } = buildMocks(
        [sale],
        [],
        [makeClient()],
        () =>
          makeSchedule('sale-1', 'client-1', [
            makeInstallment(2, 'PENDING', later),
            makeInstallment(1, 'PENDING', sooner),
          ]),
      );

      const result = await useCase.execute(defaultPagination!, noFilters!);

      expect(result.data[0].dueDate).toEqual(sooner);
      expect(result.data[1].dueDate).toEqual(later);
    });
  });

  describe('ventas sin plan de cuotas', () => {
    it('excluye ventas que no tienen installmentsCount (null)', async () => {
      const sale = makeCreditSale({ installmentsCount: null });
      const { useCase, mockScheduleService } = buildMocks([sale], [], [makeClient()]);

      const result = await useCase.execute(defaultPagination!, noFilters!);

      // El schedule service NO debe ser invocado para esta venta
      expect((mockScheduleService.compute as jest.Mock)).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(0);
    });

    it('excluye ventas que no tienen frequency (null)', async () => {
      const sale = makeCreditSale({ frequency: null });
      const { useCase, mockScheduleService } = buildMocks([sale], [], [makeClient()]);

      const result = await useCase.execute(defaultPagination!, noFilters!);

      expect((mockScheduleService.compute as jest.Mock)).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(0);
    });
  });

  describe('datos del item de resultado', () => {
    it('expone todos los campos requeridos en cada CollectionInstallmentItem', async () => {
      const sale = makeCreditSale({ id: 'sale-1', saleNumber: 42, clientId: 'client-1' });
      const dueDate = new Date(2026, 5, 15);
      const inst = makeInstallment(2, 'PARTIAL', dueDate, 60, 40);

      const { useCase } = buildMocks(
        [sale],
        [],
        [makeClient('client-1', 'Ana López')],
        () => makeSchedule('sale-1', 'client-1', [inst]),
      );

      const result = await useCase.execute(defaultPagination!, noFilters!);
      const item = result.data[0];

      expect(item.saleId).toBe('sale-1');
      expect(item.saleNumber).toBe(42);
      expect(item.clientId).toBe('client-1');
      expect(item.clientName).toBe('Ana López');
      expect(item.installmentIndex).toBe(2);
      expect(item.dueDate).toEqual(dueDate);
      expect(item.expectedAmount).toBe(100);
      expect(item.paidAmount).toBe(40);
      expect(item.remainingAmount).toBe(60);
      expect(item.status).toBe('PARTIAL');
      expect(item.daysOverdue).toBe(0);
    });
  });
});
