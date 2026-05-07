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
  /** Suma total de ventas (CASH + CREDIT) del mes en curso. */
  totalSalesAmountThisMonth: number;
  salesCountThisMonth: number;
  /** Suma de pagos cobrados en el mes (representa cobros de crédito). */
  totalCollectedThisMonth: number;
  totalPendingDebt: number;
  activeClientsCount: number;
  /** Suma de ventas de contado (CASH) del mes en curso. */
  totalCashSalesThisMonth: number;
  /** Suma de ventas a crédito (CREDIT) del mes en curso. */
  totalCreditSalesThisMonth: number;
  /**
   * Ingresos totales del mes = ventas contado + cobros de crédito recibidos.
   * Invariante: todo Payment es cobro de crédito; toda Sale.CASH es cobro al contado.
   */
  totalIncomeThisMonth: number;
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
      totalCashSalesThisMonth: raw.totalCashSalesThisMonth,
      totalCreditSalesThisMonth: raw.totalCreditSalesThisMonth,
      totalIncomeThisMonth: raw.totalCashSalesThisMonth + raw.totalCollectedThisMonth,
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
