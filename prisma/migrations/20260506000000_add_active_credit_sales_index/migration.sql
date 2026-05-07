-- Composite partial index: speeds up the "active credit sales" query used by
-- the dashboard and future collections module.
-- Filters by (type, status, collectionDay) and only includes rows where
-- installmentsCount IS NOT NULL — matching the exact WHERE clause used in
-- PrismaDashboardDatasource.getRawMetrics.
CREATE INDEX IF NOT EXISTS "Sale_active_credit_idx"
  ON "Sale" ("type", "status", "collectionDay")
  WHERE "installmentsCount" IS NOT NULL;

-- Index on Payment(saleId, createdAt): accelerates the bulk-load of payments
-- by saleId used in the dashboard and will be used by GetCollectionsUseCase (E2).
CREATE INDEX IF NOT EXISTS "Payment_saleId_createdAt_idx"
  ON "Payment" ("saleId", "createdAt");
