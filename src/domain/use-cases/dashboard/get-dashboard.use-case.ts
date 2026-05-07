import { SaleEntity } from '../../entities';
import { DashboardActiveCreditSale } from '../../datasources/dashboard.datasource';
import { DashboardRepository } from '../../repositories/dashboard.repository';
import { InstallmentScheduleService } from '../../services/installments';
import { InstallmentFrequency } from '../../entities/sale.entity';

export interface UpcomingCollection {
  date: string;
  saleId: string;
  saleNumber: number;
  clientId: string;
  clientName: string;
  installmentAmount: number;
  remainingAmount: number;
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
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly installmentScheduleService: InstallmentScheduleService = new InstallmentScheduleService(),
  ) {}

  async execute(): Promise<DashboardMetrics> {
    const today = InstallmentScheduleService.todayBogota();
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 30);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const raw = await this.dashboardRepository.getRawMetrics(monthStart, monthEnd);

    const recentSales = raw.recentSales.map((s) => SaleEntity.fromObject(s));
    const upcomingCollections = this.computeUpcomingCollections(
      raw.activeCreditSales,
      today,
      cutoff,
      raw.paymentsBySaleId,
    );

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
    paymentsBySaleId: Record<string, { amount: number }[]>,
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
          inst.dueDate >= today &&
          inst.dueDate <= cutoff &&
          (inst.status === 'PENDING' || inst.status === 'PARTIAL')
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
