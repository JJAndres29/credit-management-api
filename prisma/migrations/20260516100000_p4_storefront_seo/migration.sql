-- P4: Storefront SEO — product/category slugs, meta fields, slug history for 301 redirects

ALTER TABLE "Product" ADD COLUMN "slug" TEXT;
ALTER TABLE "Product" ADD COLUMN "brand" TEXT;
ALTER TABLE "Product" ADD COLUMN "metaTitle" TEXT;
ALTER TABLE "Product" ADD COLUMN "metaDescription" TEXT;

CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

ALTER TABLE "Category" ADD COLUMN "slug" TEXT;
ALTER TABLE "Category" ADD COLUMN "description" TEXT;
ALTER TABLE "Category" ADD COLUMN "metaTitle" TEXT;
ALTER TABLE "Category" ADD COLUMN "metaDescription" TEXT;

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

CREATE TABLE "ProductSlugHistory" (
    "id" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSlugHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductSlugHistory_oldSlug_key" ON "ProductSlugHistory"("oldSlug");
CREATE INDEX "ProductSlugHistory_productId_idx" ON "ProductSlugHistory"("productId");

ALTER TABLE "ProductSlugHistory" ADD CONSTRAINT "ProductSlugHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill deterministic slugs for existing rows (id suffix avoids collisions)
UPDATE "Product"
SET "slug" = lower(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g'))
  || '-' || substr(replace("id"::text, '-', ''), 1, 8)
WHERE "slug" IS NULL;

UPDATE "Category"
SET "slug" = lower(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE "slug" IS NULL;

-- Keep default variant storefront slug aligned with product slug when variant slug was empty
UPDATE "ProductVariant" pv
SET "slug" = p."slug"
FROM "Product" p
WHERE pv."productId" = p."id"
  AND pv."isDefault" = true
  AND p."slug" IS NOT NULL
  AND (pv."slug" IS NULL OR trim(pv."slug") = '');
