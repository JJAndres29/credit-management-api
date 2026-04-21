import { SaleEntity } from '../../entities';
import { DashboardActiveCreditSale } from '../../datasources/dashboard.datasource';
import { DashboardRepository } from '../../repositories/dashboard.repository';

export interface UpcomingCollection {
  date: string;
  saleId: string;
  saleNumber: number;
  clientId: string;
  clientName: string;
  installmentAmount: number;
}

export interface DashboardMetrics {
  totalSalesAmountThisMonth: number;
  salesCountThisMonth: number;
  totalCollectedThisMonth: number;
  totalPendingDebt: number;
  activeClientsCount: number;
  salesByStatus: { status: string; count: number; amount: number }[];
  recentSales: SaleEntity[];
  upcomingCollections: UpcomingCollection[];
}

export class GetDashboardUseCase {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async execute(): Promise<DashboardMetrics> {
    // Compute current date in Colombia timezone to avoid UTC midnight issues
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const year = Number(parts.find((p) => p.type === 'year')!.value);
    const month = Number(parts.find((p) => p.type === 'month')!.value);
    const day = Number(parts.find((p) => p.type === 'day')!.value);

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    const today = new Date(year, month - 1, day);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 30);

    const raw = await this.dashboardRepository.getRawMetrics(monthStart, monthEnd);

    const recentSales = raw.recentSales.map((s) => SaleEntity.fromObject(s));
    const upcomingCollections = this.computeUpcomingCollections(raw.activeCreditSales, today, cutoff);

    return {
      totalSalesAmountThisMonth: raw.totalSalesAmountThisMonth,
      salesCountThisMonth: raw.salesCountThisMonth,
      totalCollectedThisMonth: raw.totalCollectedThisMonth,
      totalPendingDebt: raw.totalPendingDebt,
      activeClientsCount: raw.activeClientsCount,
      salesByStatus: raw.salesByStatus,
      recentSales,
      upcomingCollections,
    };
  }

  private computeUpcomingCollections(
    sales: DashboardActiveCreditSale[],
    today: Date,
    cutoff: Date,
  ): UpcomingCollection[] {
    const result: UpcomingCollection[] = [];

    for (const sale of sales) {
      const days = sale.collectionDay2
        ? [sale.collectionDay, sale.collectionDay2]
        : [sale.collectionDay];

      const after = new Date(sale.createdAt);
      after.setHours(0, 0, 0, 0);

      const dates = this.buildDatesFromDays(days, after, sale.installmentsCount);

      for (const date of dates) {
        if (date >= today && date <= cutoff) {
          result.push({
            date: date.toISOString(),
            saleId: sale.id,
            saleNumber: sale.saleNumber,
            clientId: sale.clientId,
            clientName: sale.clientName,
            installmentAmount:
              sale.installmentAmount ?? Math.ceil(sale.total / sale.installmentsCount),
          });
        }
      }
    }

    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /** Replicates the frontend buildDatesFromDays algorithm. */
  private buildDatesFromDays(days: number[], after: Date, count: number): Date[] {
    const sorted = [...days].sort((a, b) => a - b);
    const result: Date[] = [];
    let year = after.getFullYear();
    let month = after.getMonth();

    while (result.length < count) {
      for (const day of sorted) {
        const candidate = new Date(year, month, day);
        if (candidate > after) {
          result.push(candidate);
          if (result.length >= count) break;
        }
      }
      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
    }

    return result;
  }
}
