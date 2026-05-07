/**
 * Tests — E6-T2: GetDashboardUseCase
 *
 * Verifica que upcomingCollections ahora delega en InstallmentScheduleService
 * y respeta los pagos previos (remainingAmount real, no el monto nominal).
 *
 * El DashboardRepository y el InstallmentScheduleService se inyectan como mocks
 * para poder controlar exactamente qué datos se procesan.
 */

import { GetDashboardUseCase } from './get-dashboard.use-case';
import { DashboardRepository } from '../../repositories/dashboard.repository';
import {
  InstallmentScheduleService,
  InstallmentSchedule,
  Installment,
} from '../../services/installments';
import { DashboardRawMetrics, DashboardActiveCreditSale } from '../../datasources/dashboard.datasource';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Devuelve un DashboardRawMetrics vacío / con ceros para tests de métricas. */
function makeRawMetrics(overrides: Partial<DashboardRawMetrics> = {}): DashboardRawMetrics {
  return {
    totalSalesAmountThisMonth: 0,
    salesCountThisMonth: 0,
    totalCollectedThisMonth: 0,
    totalPendingDebt: 0,
    activeClientsCount: 0,
    totalCashSalesThisMonth: 0,
    totalCreditSalesThisMonth: 0,
    salesByStatus: [],
    recentSales: [],
    activeCreditSales: [],
    paymentsBySaleId: {},
    ...overrides,
  };
}

function makeActiveSale(overrides: Partial<DashboardActiveCreditSale> = {}): DashboardActiveCreditSale {
  return {
    id: 'sale-1',
    saleNumber: 1001,
    clientId: 'client-1',
    clientName: 'Juan Pérez',
    total: 600,
    createdAt: new Date(2026, 0, 1),
    installmentsCount: 6,
    installmentAmount: 100,
    collectionDay: 15,
    collectionDay2: null,
    frequency: 'MONTHLY',
    initialPayment: null,
    ...overrides,
  };
}

/** Cuota de ejemplo dentro de la ventana de 30 días a partir de hoy. */
function makeUpcomingInstallment(
  status: 'PENDING' | 'PARTIAL',
  remainingAmount: number,
  paidAmount: number,
): Installment {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 10); // 10 días desde hoy
  dueDate.setHours(0, 0, 0, 0);

  return {
    index: 1,
    dueDate,
    expectedAmount: 100,
    paidAmount,
    remainingAmount,
    status,
    daysOverdue: 0,
  };
}

function makeSchedule(
  installments: Installment[],
  overrides: Partial<InstallmentSchedule> = {},
): InstallmentSchedule {
  return {
    saleId: 'sale-1',
    saleNumber: 1001,
    clientId: 'client-1',
    installmentsCount: 6,
    installmentAmount: 100,
    initialPayment: 0,
    totalPaid: 0,
    installments,
    ...overrides,
  };
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

function makeMockRepo(rawMetrics: DashboardRawMetrics): jest.Mocked<DashboardRepository> {
  return { getRawMetrics: jest.fn().mockResolvedValue(rawMetrics) };
}

function makeMockScheduleService(
  returnValue: InstallmentSchedule,
): InstallmentScheduleService {
  return { compute: jest.fn().mockReturnValue(returnValue) } as unknown as InstallmentScheduleService;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GetDashboardUseCase', () => {
  describe('upcomingCollections', () => {
    it('retorna array vacío cuando no hay ventas activas', async () => {
      const repo = makeMockRepo(makeRawMetrics());
      const useCase = new GetDashboardUseCase(repo);

      const result = await useCase.execute();

      expect(result.upcomingCollections).toEqual([]);
    });

    it('incluye la cuota PENDING con su remainingAmount cuando no hay pagos', async () => {
      const sale = makeActiveSale();
      const pendingInst = makeUpcomingInstallment('PENDING', 100, 0);
      const mockService = makeMockScheduleService(makeSchedule([pendingInst]));
      const repo = makeMockRepo(makeRawMetrics({ activeCreditSales: [sale] }));

      const useCase = new GetDashboardUseCase(repo, mockService);
      const result = await useCase.execute();

      expect(result.upcomingCollections).toHaveLength(1);
      expect(result.upcomingCollections[0].remainingAmount).toBe(100);
      expect(result.upcomingCollections[0].installmentAmount).toBe(100);
    });

    it('PARTIAL: remainingAmount refleja el saldo real (no el nominal)', async () => {
      // Cliente pagó 40 de 100 → remaining = 60
      const sale = makeActiveSale();
      const partialInst = makeUpcomingInstallment('PARTIAL', 60, 40);
      const mockService = makeMockScheduleService(makeSchedule([partialInst]));
      const repo = makeMockRepo(makeRawMetrics({ activeCreditSales: [sale] }));

      const useCase = new GetDashboardUseCase(repo, mockService);
      const result = await useCase.execute();

      expect(result.upcomingCollections[0].remainingAmount).toBe(60);
      expect(result.upcomingCollections[0].installmentAmount).toBe(100);
    });

    it('excluye cuotas con estado PAID', async () => {
      const sale = makeActiveSale();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 5);
      dueDate.setHours(0, 0, 0, 0);

      const paidInst: Installment = {
        index: 1,
        dueDate,
        expectedAmount: 100,
        paidAmount: 100,
        remainingAmount: 0,
        status: 'PAID',
        daysOverdue: 0,
      };
      const mockService = makeMockScheduleService(makeSchedule([paidInst]));
      const repo = makeMockRepo(makeRawMetrics({ activeCreditSales: [sale] }));

      const useCase = new GetDashboardUseCase(repo, mockService);
      const result = await useCase.execute();

      expect(result.upcomingCollections).toHaveLength(0);
    });

    it('excluye cuotas con estado OVERDUE (vencidas fuera de ventana futura)', async () => {
      const sale = makeActiveSale();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5); // 5 días atrás
      pastDate.setHours(0, 0, 0, 0);

      const overdueInst: Installment = {
        index: 1,
        dueDate: pastDate,
        expectedAmount: 100,
        paidAmount: 0,
        remainingAmount: 100,
        status: 'OVERDUE',
        daysOverdue: 5,
      };
      const mockService = makeMockScheduleService(makeSchedule([overdueInst]));
      const repo = makeMockRepo(makeRawMetrics({ activeCreditSales: [sale] }));

      const useCase = new GetDashboardUseCase(repo, mockService);
      const result = await useCase.execute();

      // OVERDUE está en el pasado → dueDate < today → no entra en la ventana futura
      expect(result.upcomingCollections).toHaveLength(0);
    });

    it('excluye cuotas cuya dueDate supera el cutoff de 30 días', async () => {
      const sale = makeActiveSale();
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 45); // 45 días → fuera de ventana
      farFuture.setHours(0, 0, 0, 0);

      const farInst: Installment = {
        index: 3,
        dueDate: farFuture,
        expectedAmount: 100,
        paidAmount: 0,
        remainingAmount: 100,
        status: 'PENDING',
        daysOverdue: 0,
      };
      const mockService = makeMockScheduleService(makeSchedule([farInst]));
      const repo = makeMockRepo(makeRawMetrics({ activeCreditSales: [sale] }));

      const useCase = new GetDashboardUseCase(repo, mockService);
      const result = await useCase.execute();

      expect(result.upcomingCollections).toHaveLength(0);
    });

    it('pasa paymentsBySaleId al schedule service', async () => {
      const sale = makeActiveSale();
      const payments = [{ amount: 100 }, { amount: 50 }];
      const mockService = makeMockScheduleService(makeSchedule([]));
      const repo = makeMockRepo(
        makeRawMetrics({
          activeCreditSales: [sale],
          paymentsBySaleId: { 'sale-1': payments },
        }),
      );

      const useCase = new GetDashboardUseCase(repo, mockService);
      await useCase.execute();

      expect((mockService.compute as jest.Mock)).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sale-1' }),
        payments,
        expect.any(Date),
      );
    });

    it('sale sin pagos recibe array vacío en el schedule service', async () => {
      const sale = makeActiveSale({ id: 'sale-2' });
      const mockService = makeMockScheduleService(makeSchedule([]));
      const repo = makeMockRepo(
        makeRawMetrics({
          activeCreditSales: [sale],
          paymentsBySaleId: {},
        }),
      );

      const useCase = new GetDashboardUseCase(repo, mockService);
      await useCase.execute();

      expect((mockService.compute as jest.Mock)).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sale-2' }),
        [],
        expect.any(Date),
      );
    });

    it('upcomingCollections se ordena por fecha ascendente', async () => {
      const sale1 = makeActiveSale({ id: 'sale-1', clientName: 'Ana' });
      const sale2 = makeActiveSale({ id: 'sale-2', clientName: 'Luis' });

      const soon = new Date();
      soon.setDate(soon.getDate() + 5);
      soon.setHours(0, 0, 0, 0);

      const later = new Date();
      later.setDate(later.getDate() + 20);
      later.setHours(0, 0, 0, 0);

      const instSoon: Installment = {
        index: 1,
        dueDate: soon,
        expectedAmount: 100,
        paidAmount: 0,
        remainingAmount: 100,
        status: 'PENDING',
        daysOverdue: 0,
      };
      const instLater: Installment = {
        index: 1,
        dueDate: later,
        expectedAmount: 100,
        paidAmount: 0,
        remainingAmount: 100,
        status: 'PENDING',
        daysOverdue: 0,
      };

      // sale-2 tiene fecha más próxima, sale-1 más lejana
      const mockService = {
        compute: jest
          .fn()
          .mockReturnValueOnce(makeSchedule([instLater], { saleId: 'sale-1' }))
          .mockReturnValueOnce(makeSchedule([instSoon], { saleId: 'sale-2' })),
      } as unknown as InstallmentScheduleService;

      const repo = makeMockRepo(makeRawMetrics({ activeCreditSales: [sale1, sale2] }));
      const useCase = new GetDashboardUseCase(repo, mockService);
      const result = await useCase.execute();

      expect(result.upcomingCollections).toHaveLength(2);
      expect(result.upcomingCollections[0].saleId).toBe('sale-2'); // fecha más próxima
      expect(result.upcomingCollections[1].saleId).toBe('sale-1');
    });
  });

  describe('métricas del dashboard', () => {
    it('propaga correctamente los valores del raw metrics', async () => {
      const raw = makeRawMetrics({
        totalSalesAmountThisMonth: 5000,
        salesCountThisMonth: 10,
        totalCollectedThisMonth: 2000,
        totalPendingDebt: 8000,
        activeClientsCount: 25,
        totalCashSalesThisMonth: 1500,
        totalCreditSalesThisMonth: 3500,
      });
      const repo = makeMockRepo(raw);
      const useCase = new GetDashboardUseCase(repo);
      const result = await useCase.execute();

      expect(result.totalSalesAmountThisMonth).toBe(5000);
      expect(result.salesCountThisMonth).toBe(10);
      expect(result.totalCollectedThisMonth).toBe(2000);
      expect(result.totalPendingDebt).toBe(8000);
      expect(result.activeClientsCount).toBe(25);
      expect(result.totalCashSalesThisMonth).toBe(1500);
      expect(result.totalCreditSalesThisMonth).toBe(3500);
    });

    it('totalIncomeThisMonth = totalCashSalesThisMonth + totalCollectedThisMonth', async () => {
      const raw = makeRawMetrics({
        totalCashSalesThisMonth: 1500,
        totalCollectedThisMonth: 2000,
      });
      const repo = makeMockRepo(raw);
      const useCase = new GetDashboardUseCase(repo);
      const result = await useCase.execute();

      expect(result.totalIncomeThisMonth).toBe(3500);
    });
  });
});
