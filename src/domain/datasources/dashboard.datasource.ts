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
  /** Periodicidad del plan de cuotas — necesaria para generar fechas correctamente. */
  frequency: string | null;
  /** Cuota inicial abonada al crear la venta — se descuenta del numerador FIFO. */
  initialPayment: number | null;
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
  /** Pagos agrupados por saleId para las ventas activas a crédito. */
  paymentsBySaleId: Record<string, { amount: number }[]>;
}

export interface DashboardDatasource {
  getRawMetrics(monthStart: Date, monthEnd: Date): Promise<DashboardRawMetrics>;
}
