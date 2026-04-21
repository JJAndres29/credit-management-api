export interface DashboardSalesByStatus {
  status: string;
  count: number;
  amount: number;
}

/** Credit sale data needed to compute upcoming collection dates. */
export interface DashboardActiveCreditSale {
  id: string;
  saleNumber: number;
  clientId: string;
  clientName: string;
  total: number;
  createdAt: Date;
  installmentsCount: number;
  installmentAmount: number | null;
  collectionDay: number;
  collectionDay2: number | null;
}

export interface DashboardRawMetrics {
  totalSalesAmountThisMonth: number;
  salesCountThisMonth: number;
  totalCollectedThisMonth: number;
  totalPendingDebt: number;
  activeClientsCount: number;
  salesByStatus: DashboardSalesByStatus[];
  recentSales: Record<string, unknown>[];
  activeCreditSales: DashboardActiveCreditSale[];
}

export interface DashboardDatasource {
  getRawMetrics(monthStart: Date, monthEnd: Date): Promise<DashboardRawMetrics>;
}
