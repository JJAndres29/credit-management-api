-- VariantAttributeValue junction table: links each ProductVariant to its defining AttributeValues.
CREATE TABLE "VariantAttributeValue" (
    "id"        TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "valueId"   TEXT NOT NULL,

    CONSTRAINT "VariantAttributeValue_pkey" PRIMARY KEY ("id")
);

-- Each variant–value pair is unique (no duplicate attribute assignments per variant).
CREATE UNIQUE INDEX "VariantAttributeValue_variantId_valueId_key"
    ON "VariantAttributeValue"("variantId", "valueId");

-- Fast lookups: "which variants use this attribute value?"
CREATE INDEX "VariantAttributeValue_valueId_idx"
    ON "VariantAttributeValue"("valueId");

-- Foreign keys with cascade delete.
ALTER TABLE "VariantAttributeValue"
    ADD CONSTRAINT "VariantAttributeValue_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VariantAttributeValue"
    ADD CONSTRAINT "VariantAttributeValue_valueId_fkey"
    FOREIGN KEY ("valueId") REFERENCES "AttributeValue"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Add attributeHash to ProductVariant for unique-combination enforcement.
-- NULL for default variants (PostgreSQL treats NULLs as distinct in unique indexes).
ALTER TABLE "ProductVariant" ADD COLUMN "attributeHash" TEXT;

-- Unique constraint: no two variants of the same product may share the same attribute combination.
CREATE UNIQUE INDEX "ProductVariant_productId_attributeHash_key"
    ON "ProductVariant"("productId", "attributeHash");

-- Backfill Phase 1: create one default ProductVariant for every Product that has none.
INSERT INTO "ProductVariant" ("id", "productId", "label", "stock", "retailPrice", "investmentCost",
                              "currencyCode", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    p."id",
    'Default',
    p."stock",
    p."retailPrice",
    p."investmentCost",
    p."currencyCode",
    true,
    p."isActive",
    NOW(),
    NOW()
FROM "Product" p
WHERE NOT EXISTS (
    SELECT 1 FROM "ProductVariant" pv WHERE pv."productId" = p."id"
);

-- Backfill Phase 1b: for SaleItems that have variantId NULL, point them to the default variant.
UPDATE "SaleItem" si
SET "variantId" = pv."id"
FROM "ProductVariant" pv
WHERE si."variantId" IS NULL
  AND pv."productId" = si."productId"
  AND pv."isDefault" = true;
