import { SaleEntity } from '../../entities';
import { DashboardActiveCreditSale } from '../../datasources/dashboard.datasource';
import { DashboardRepository } from '../../repositories/dashboard.repository';
import { InstallmentScheduleService } from '../../services/installments';
import { InstallmentFrequency } from '../../entities/sale.entity';
import { CustomError } from '../../errors';
import type { DashboardMetrics, UpcomingCollection } from './get-dashboard.use-case';

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export class GetMonthlySummaryUseCase {
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly installmentScheduleService: InstallmentScheduleService = new InstallmentScheduleService(),
  ) {}

  /**
   * Returns dashboard metrics for any given month.
   * @param month YYYY-MM string (e.g. "2026-05"). Defaults to the current month
   *              (America/Bogota timezone) when not provided.
   */
  async execute(month?: string): Promise<DashboardMetrics> {
    const resolvedMonth = month ?? this.currentMonthBogota();

    if (!MONTH_REGEX.test(resolvedMonth)) {
      throw CustomError.badRequest('month debe tener formato YYYY-MM (ej. 2026-05)');
    }

    const [y, m] = resolvedMonth.split('-').map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);

    const today = InstallmentScheduleService.todayBogota();
    const raw = await this.dashboardRepository.getRawMetrics(monthStart, monthEnd);

    const recentSales = raw.recentSales.map((s) => SaleEntity.fromObject(s));

    const upcomingCollections = this.computeCollectionsForMonth(
      raw.activeCreditSales,
      monthStart,
      monthEnd,
      raw.paymentsBySaleId,
      today,
    );

    return {
      totalSalesAmountThisMonth: raw.totalSalesAmountThisMonth,
      salesCountThisMonth: raw.salesCountThisMonth,
      totalCollectedThisMonth: raw.totalCollectedThisMonth,
      totalPendingDebt: raw.totalPendingDebt,
      activeClientsCount: raw.activeClientsCount,
      totalCashSalesThisMonth: raw.totalCashSalesThisMonth,
      totalCreditSalesThisMonth: raw.totalCreditSalesThisMonth,
      totalIncomeThisMonth: raw.totalCashSalesThisMonth + raw.totalCollectedThisMonth,
      salesByStatus: raw.salesByStatus,
      recentSales,
      upcomingCollections,
    };
  }

  /** Returns current month in YYYY-MM using America/Bogota locale. */
  private currentMonthBogota(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());

    const year = parts.find((p) => p.type === 'year')!.value;
    const mon = parts.find((p) => p.type === 'month')!.value;
    return `${year}-${mon}`;
  }

  /**
   * Collects installments whose dueDate falls within [monthStart, monthEnd].
   * Includes PENDING, PARTIAL and OVERDUE statuses so the caller can see both
   * future obligations and overdue debts for the queried month.
   */
  private computeCollectionsForMonth(
    sales: DashboardActiveCreditSale[],
    monthStart: Date,
    monthEnd: Date,
    paymentsBySaleId: Record<string, { amount: number }[]>,
    today: Date,
  ): UpcomingCollection[] {
    const result: UpcomingCollection[] = [];

    for (const sale of sales) {
      const saleInput = {
        ...sale,
        frequency: (sale.frequency as InstallmentFrequency | null) ?? null,
        initialPayment: sale.initialPayment ?? null,
      };

      const payments = paymentsBySaleId[sale.id] ?? [];
      const schedule = this.installmentScheduleService.compute(saleInput, payments, today);

      for (const inst of schedule.installments) {
        if (
          inst.dueDate >= monthStart &&
          inst.dueDate <= monthEnd &&
          inst.status !== 'PAID'
        ) {
          result.push({
            date: inst.dueDate.toISOString(),
            saleId: sale.id,
            saleNumber: sale.saleNumber,
            clientId: sale.clientId,
            clientName: sale.clientName,
            installmentAmount: inst.expectedAmount,
            remainingAmount: inst.remainingAmount,
          });
        }
      }
    }

    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
}
