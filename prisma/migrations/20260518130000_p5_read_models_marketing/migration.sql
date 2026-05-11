-- P5: marketing tables + analytics materialized read models (refresh via job / admin)

-- CreateEnum
CREATE TYPE "PriceExperimentWinnerCriteria" AS ENUM ('REVENUE', 'CONVERSION_RATE');

-- CreateTable
CREATE TABLE "DiscountCampaign" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "categoryId" TEXT,
    "percentOff" DECIMAL(5,2) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceExperiment" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "cohortKey" VARCHAR(80),
    "priceA" DECIMAL(10,2) NOT NULL,
    "priceB" DECIMAL(10,2) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "winnerCriteria" "PriceExperimentWinnerCriteria" NOT NULL DEFAULT 'REVENUE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscountCampaign_categoryId_idx" ON "DiscountCampaign"("categoryId");

-- CreateIndex
CREATE INDEX "DiscountCampaign_startsAt_endsAt_idx" ON "DiscountCampaign"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "PriceExperiment_productId_idx" ON "PriceExperiment"("productId");

-- CreateIndex
CREATE INDEX "PriceExperiment_startAt_endAt_idx" ON "PriceExperiment"("startAt", "endAt");

-- AddForeignKey
ALTER TABLE "DiscountCampaign" ADD CONSTRAINT "DiscountCampaign_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceExperiment" ADD CONSTRAINT "PriceExperiment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Read models (materialized). Use cases query ONLY these for heavy analytics.
-- ---------------------------------------------------------------------------

CREATE MATERIALIZED VIEW daily_sales_summary AS
SELECT
  (date_trunc('day', u.bucket_at))::date AS day,
  u.channel,
  SUM(u.revenue)::numeric(14,2) AS revenue,
  SUM(u.tax)::numeric(14,2) AS tax,
  SUM(u.shipping)::numeric(14,2) AS shipping,
  COUNT(*)::bigint AS order_count,
  AVG(u.revenue)::numeric(14,4) AS avg_ticket
FROM (
  SELECT
    s."createdAt" AS bucket_at,
    'PHYSICAL'::text AS channel,
    s.total::numeric AS revenue,
    0::numeric AS tax,
    0::numeric AS shipping
  FROM "Sale" s
  UNION ALL
  SELECT
    o."createdAt" AS bucket_at,
    'ONLINE'::text AS channel,
    o."totalAmount"::numeric AS revenue,
    COALESCE(o."taxAmount", 0)::numeric AS tax,
    COALESCE(o."shippingAmount", 0)::numeric AS shipping
  FROM "OnlineOrder" o
  WHERE o.status = 'PAID'
) u
GROUP BY 1, 2;

CREATE UNIQUE INDEX daily_sales_summary_day_channel_uidx ON daily_sales_summary (day, channel);

CREATE MATERIALIZED VIEW product_profitability_summary AS
WITH item_lines AS (
  SELECT
    si."productId" AS product_id,
    si.quantity::bigint AS quantity,
    si.subtotal::numeric AS line_revenue,
    (COALESCE(p."investmentCost", 0)::numeric * si.quantity::numeric) AS line_cogs
  FROM "SaleItem" si
  INNER JOIN "Sale" s ON s.id = si."saleId"
  INNER JOIN "Product" p ON p.id = si."productId"
  UNION ALL
  SELECT
    oi."productId" AS product_id,
    oi.quantity::bigint AS quantity,
    (oi."unitPrice" * oi.quantity)::numeric AS line_revenue,
    (COALESCE(p."investmentCost", 0)::numeric * oi.quantity::numeric) AS line_cogs
  FROM "OnlineOrderItem" oi
  INNER JOIN "OnlineOrder" o ON o.id = oi."orderId"
  INNER JOIN "Product" p ON p.id = oi."productId"
  WHERE o.status = 'PAID'
)
SELECT
  pr.id AS product_id,
  pr.name AS product_name,
  COALESCE(SUM(il.quantity), 0)::bigint AS units_sold,
  COALESCE(SUM(il.line_revenue), 0)::numeric(14,2) AS revenue,
  COALESCE(SUM(il.line_cogs), 0)::numeric(14,2) AS cogs,
  COALESCE(SUM(il.line_revenue - il.line_cogs), 0)::numeric(14,2) AS gross_profit
FROM "Product" pr
LEFT JOIN item_lines il ON il.product_id = pr.id
GROUP BY pr.id, pr.name;

CREATE UNIQUE INDEX product_profitability_summary_product_uidx ON product_profitability_summary (product_id);

CREATE MATERIALIZED VIEW inventory_turnover_summary AS
WITH item_units AS (
  SELECT si."productId" AS product_id, SUM(si.quantity)::bigint AS units
  FROM "SaleItem" si
  INNER JOIN "Sale" s ON s.id = si."saleId"
  WHERE s."createdAt" >= (NOW() - INTERVAL '90 days')
  GROUP BY si."productId"
  UNION ALL
  SELECT oi."productId" AS product_id, SUM(oi.quantity)::bigint AS units
  FROM "OnlineOrderItem" oi
  INNER JOIN "OnlineOrder" o ON o.id = oi."orderId"
  WHERE o.status = 'PAID' AND o."createdAt" >= (NOW() - INTERVAL '90 days')
  GROUP BY oi."productId"
),
merged AS (
  SELECT product_id, SUM(units)::bigint AS units_sold_90d
  FROM item_units
  GROUP BY product_id
)
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.stock::bigint AS current_stock,
  COALESCE(m.units_sold_90d, 0)::bigint AS units_sold_90d,
  CASE
    WHEN p.stock > 0 THEN ROUND(COALESCE(m.units_sold_90d, 0)::numeric / NULLIF(p.stock::numeric, 0), 4)
    ELSE NULL
  END AS turnover_ratio_90d
FROM "Product" p
LEFT JOIN merged m ON m.product_id = p.id;

CREATE UNIQUE INDEX inventory_turnover_summary_product_uidx ON inventory_turnover_summary (product_id);

CREATE MATERIALIZED VIEW customer_cohort_summary AS
WITH first_paid AS (
  SELECT o."customerId" AS cid, MIN(o."createdAt") AS first_at
  FROM "OnlineOrder" o
  WHERE o.status = 'PAID' AND o."customerId" IS NOT NULL
  GROUP BY o."customerId"
)
SELECT
  (date_trunc('month', fp.first_at))::date AS cohort_month,
  COUNT(*)::bigint AS customers_in_cohort,
  COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1
      FROM "OnlineOrder" o2
      WHERE o2."customerId" = fp.cid
        AND o2.status = 'PAID'
        AND o2."createdAt" >= fp.first_at + INTERVAL '30 days'
    )
  )::bigint AS retained_30d_purchasers
FROM first_paid fp
GROUP BY 1;

CREATE UNIQUE INDEX customer_cohort_summary_month_uidx ON customer_cohort_summary (cohort_month);

CREATE MATERIALIZED VIEW customer_value_summary AS
SELECT
  c.id AS customer_id,
  c.name AS customer_name,
  COUNT(o.id)::bigint AS paid_order_count,
  COALESCE(SUM(o."totalAmount"), 0)::numeric(14,2) AS lifetime_revenue
FROM "Customer" c
INNER JOIN "OnlineOrder" o ON o."customerId" = c.id AND o.status = 'PAID'
GROUP BY c.id, c.name;

CREATE UNIQUE INDEX customer_value_summary_customer_uidx ON customer_value_summary (customer_id);

CREATE MATERIALIZED VIEW dead_stock_candidates AS
WITH all_sales AS (
  SELECT si."productId" AS pid, s."createdAt" AS sold_at
  FROM "SaleItem" si
  INNER JOIN "Sale" s ON s.id = si."saleId"
  UNION ALL
  SELECT oi."productId" AS pid, o."createdAt" AS sold_at
  FROM "OnlineOrderItem" oi
  INNER JOIN "OnlineOrder" o ON o.id = oi."orderId"
  WHERE o.status = 'PAID'
),
last_by_product AS (
  SELECT pid, MAX(sold_at) AS last_sale_at
  FROM all_sales
  GROUP BY pid
)
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.stock::bigint AS stock,
  lb.last_sale_at,
  p."updatedAt" AS product_updated_at
FROM "Product" p
LEFT JOIN last_by_product lb ON lb.pid = p.id
WHERE p."isActive" = true
  AND p.stock > 0
  AND (
    lb.last_sale_at IS NULL
    OR lb.last_sale_at < (NOW() - INTERVAL '90 days')
  );

CREATE UNIQUE INDEX dead_stock_candidates_product_uidx ON dead_stock_candidates (product_id);
