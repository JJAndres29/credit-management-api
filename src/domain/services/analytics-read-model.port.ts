/**
 * P5 — Read-only access to Postgres materialized views refreshed by cron/admin.
 * Heavy reporting must use this port, not operational tables.
 */

export type DailySalesSummaryRow = {
  day: Date;
  channel: string;
  revenue: string;
  tax: string;
  shipping: string;
  orderCount: bigint;
  avgTicket: string;
};

export type ProductProfitabilityRow = {
  productId: string;
  productName: string;
  unitsSold: bigint;
  revenue: string;
  cogs: string;
  grossProfit: string;
};

export type DeadStockRow = {
  productId: string;
  productName: string;
  stock: bigint;
  lastSaleAt: Date | null;
  productUpdatedAt: Date;
};

export type InventoryTurnoverRow = {
  productId: string;
  productName: string;
  currentStock: bigint;
  unitsSold90d: bigint;
  turnoverRatio90d: string | null;
};

export type CustomerCohortRow = {
  cohortMonth: Date;
  customersInCohort: bigint;
  retained30dPurchasers: bigint;
};

export type CustomerValueRow = {
  customerId: string;
  customerName: string;
  paidOrderCount: bigint;
  lifetimeRevenue: string;
};

export interface AnalyticsReadModelPort {
  /** Non-transactional; each view refreshes independently (CONCURRENTLY). */
  refreshAllMaterializedViews(): Promise<void>;

  getDailySalesSummary(params: { fromDay: Date; toDay: Date }): Promise<DailySalesSummaryRow[]>;

  getProductProfitability(params: { limit: number; offset: number }): Promise<ProductProfitabilityRow[]>;

  getDeadStockCandidates(params: { limit: number }): Promise<DeadStockRow[]>;

  getInventoryTurnover(params: { limit: number; offset: number }): Promise<InventoryTurnoverRow[]>;

  getCustomerCohorts(): Promise<CustomerCohortRow[]>;

  getCustomerLifetimeValues(params: { limit: number; offset: number }): Promise<CustomerValueRow[]>;

  /** ONLINE channel revenue for a calendar day in America/Bogota is approximated via UTC date match on `day`. */
  getOnlineRevenueForDay(day: Date): Promise<string | null>;

  getAverageTicket(params: { fromDay: Date; toDay: Date; channel?: string }): Promise<string | null>;
}
