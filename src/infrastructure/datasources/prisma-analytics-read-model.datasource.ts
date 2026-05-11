import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import type {
  AnalyticsReadModelPort,
  CustomerCohortRow,
  CustomerValueRow,
  DailySalesSummaryRow,
  DeadStockRow,
  InventoryTurnoverRow,
  ProductProfitabilityRow,
} from '../../domain/services/analytics-read-model.port';

const MV_NAMES = [
  'daily_sales_summary',
  'product_profitability_summary',
  'inventory_turnover_summary',
  'customer_cohort_summary',
  'customer_value_summary',
  'dead_stock_candidates',
] as const;

export class PrismaAnalyticsReadModelDatasource implements AnalyticsReadModelPort {
  async refreshAllMaterializedViews(): Promise<void> {
    for (const name of MV_NAMES) {
      await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${name}`);
    }
  }

  async getDailySalesSummary(params: { fromDay: Date; toDay: Date }): Promise<DailySalesSummaryRow[]> {
    return prisma.$queryRaw<DailySalesSummaryRow[]>`
      SELECT
        day,
        channel,
        revenue,
        tax,
        shipping,
        order_count AS "orderCount",
        avg_ticket AS "avgTicket"
      FROM daily_sales_summary
      WHERE day >= ${params.fromDay}::date AND day <= ${params.toDay}::date
      ORDER BY day DESC, channel ASC
    `;
  }

  async getProductProfitability(params: { limit: number; offset: number }): Promise<ProductProfitabilityRow[]> {
    return prisma.$queryRaw<ProductProfitabilityRow[]>`
      SELECT
        product_id AS "productId",
        product_name AS "productName",
        units_sold AS "unitsSold",
        revenue,
        cogs,
        gross_profit AS "grossProfit"
      FROM product_profitability_summary
      ORDER BY gross_profit DESC
      LIMIT ${params.limit} OFFSET ${params.offset}
    `;
  }

  async getDeadStockCandidates(params: { limit: number }): Promise<DeadStockRow[]> {
    return prisma.$queryRaw<DeadStockRow[]>`
      SELECT
        product_id AS "productId",
        product_name AS "productName",
        stock,
        last_sale_at AS "lastSaleAt",
        product_updated_at AS "productUpdatedAt"
      FROM dead_stock_candidates
      ORDER BY stock DESC
      LIMIT ${params.limit}
    `;
  }

  async getInventoryTurnover(params: { limit: number; offset: number }): Promise<InventoryTurnoverRow[]> {
    return prisma.$queryRaw<InventoryTurnoverRow[]>`
      SELECT
        product_id AS "productId",
        product_name AS "productName",
        current_stock AS "currentStock",
        units_sold_90d AS "unitsSold90d",
        turnover_ratio_90d AS "turnoverRatio90d"
      FROM inventory_turnover_summary
      ORDER BY turnover_ratio_90d DESC NULLS LAST
      LIMIT ${params.limit} OFFSET ${params.offset}
    `;
  }

  async getCustomerCohorts(): Promise<CustomerCohortRow[]> {
    return prisma.$queryRaw<CustomerCohortRow[]>`
      SELECT
        cohort_month AS "cohortMonth",
        customers_in_cohort AS "customersInCohort",
        retained_30d_purchasers AS "retained30dPurchasers"
      FROM customer_cohort_summary
      ORDER BY cohort_month DESC
    `;
  }

  async getCustomerLifetimeValues(params: { limit: number; offset: number }): Promise<CustomerValueRow[]> {
    return prisma.$queryRaw<CustomerValueRow[]>`
      SELECT
        customer_id AS "customerId",
        customer_name AS "customerName",
        paid_order_count AS "paidOrderCount",
        lifetime_revenue AS "lifetimeRevenue"
      FROM customer_value_summary
      ORDER BY lifetime_revenue::numeric DESC
      LIMIT ${params.limit} OFFSET ${params.offset}
    `;
  }

  async getOnlineRevenueForDay(day: Date): Promise<string | null> {
    const rows = await prisma.$queryRaw<{ revenue: Prisma.Decimal }[]>`
      SELECT revenue
      FROM daily_sales_summary
      WHERE channel = 'ONLINE' AND day = ${day}::date
      LIMIT 1
    `;
    const r = rows[0]?.revenue;
    return r === undefined ? null : String(r);
  }

  async getAverageTicket(params: { fromDay: Date; toDay: Date; channel?: string }): Promise<string | null> {
    const channel = params.channel ?? null;
    const rows = await prisma.$queryRaw<{ avg: Prisma.Decimal | null }[]>`
      SELECT AVG(dss.avg_ticket)::decimal(14,4) AS avg
      FROM daily_sales_summary dss
      WHERE dss.day >= ${params.fromDay}::date
        AND dss.day <= ${params.toDay}::date
        AND (${channel}::text IS NULL OR dss.channel = ${channel}::text)
    `;
    const v = rows[0]?.avg;
    return v === undefined || v === null ? null : String(v);
  }
}
