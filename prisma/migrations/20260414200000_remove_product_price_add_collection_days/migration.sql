-- Migration: remove Product.price, add Sale.collectionDay / collectionDay2
--
-- Product.price removal:
--   The product catalog no longer holds a fixed price. Prices are now set
--   explicitly at sale-item level when a sale is created.
--
-- Sale.collectionDay / collectionDay2:
--   Optional billing-day metadata for installment plans.
--   MONTHLY plans use collectionDay only (e.g., 30 → collect on the 30th each month).
--   BIWEEKLY plans use both fields (e.g., collectionDay=15, collectionDay2=30).

-- Remove price column from Product
ALTER TABLE "Product" DROP COLUMN IF EXISTS "price";

-- Add collection day columns to Sale
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "collectionDay"  INTEGER;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "collectionDay2" INTEGER;
