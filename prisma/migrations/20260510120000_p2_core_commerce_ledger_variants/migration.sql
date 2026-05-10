-- P2: expand-only core commerce — variants (dual-write), tax columns, ledger, order events, invoice schema, stock movements, assets

-- Create enums (Prisma names)
CREATE TYPE "LedgerEntryKind" AS ENUM ('CREDIT_SALE_OPENED', 'PAYMENT_RECEIVED', 'PAYMENT_ADJUSTED', 'PAYMENT_REMOVED', 'CREDIT_SALE_REVERSED', 'MANUAL_ADJUSTMENT');
CREATE TYPE "StockMovementType" AS ENUM ('SALE_PHYSICAL_DECREMENT', 'SALE_PHYSICAL_RESTORE', 'SALE_ONLINE_RESERVE', 'SALE_ONLINE_RELEASE', 'ADJUSTMENT');
CREATE TYPE "AssetType" AS ENUM ('IMAGE', 'VIDEO');
CREATE TYPE "ElectronicInvoiceType" AS ENUM ('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE');
CREATE TYPE "ElectronicInvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'DELIVERED');

-- Extend OrderStatus (PostgreSQL 9.1+; IF NOT EXISTS on PG 15+)
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'SHIPPED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

-- Category / Product tax & money (expand)
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "ivaRate" DECIMAL(5,2);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'COP';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ivaRate" DECIMAL(5,2);

-- ProductVariant
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT,
    "slug" TEXT,
    "label" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "retailPrice" DECIMAL(10,2),
    "investmentCost" DECIMAL(10,2),
    "currencyCode" TEXT NOT NULL DEFAULT 'COP',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE UNIQUE INDEX "ProductVariant_slug_key" ON "ProductVariant"("slug");
CREATE INDEX "ProductVariant_productId_isDefault_idx" ON "ProductVariant"("productId", "isDefault");

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one default variant per product (mirrors Product.stock / prices)
INSERT INTO "ProductVariant" ("id", "productId", "sku", "slug", "label", "stock", "retailPrice", "investmentCost", "currencyCode", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  p."id",
  NULL,
  NULL,
  'Default',
  p."stock",
  p."retailPrice",
  p."investmentCost",
  COALESCE(p."currencyCode", 'COP'),
  true,
  p."isActive",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Product" p;

-- Sale / Payment / SaleItem (expand)
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'COP';

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'COP';

ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "variantId" TEXT;
CREATE INDEX IF NOT EXISTS "SaleItem_variantId_idx" ON "SaleItem"("variantId");
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Point existing sale lines at default variant (dual-read path ready)
UPDATE "SaleItem" si
SET "variantId" = pv."id"
FROM "ProductVariant" pv
WHERE pv."productId" = si."productId" AND pv."isDefault" = true AND si."variantId" IS NULL;

-- OnlineOrder tax breakdown + currency
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "subtotalAmount" DECIMAL(10,2);
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(10,2);
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "shippingAmount" DECIMAL(10,2);
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10,2);
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'COP';

ALTER TABLE "OnlineOrderItem" ADD COLUMN IF NOT EXISTS "variantId" TEXT;
CREATE INDEX IF NOT EXISTS "OnlineOrderItem_variantId_idx" ON "OnlineOrderItem"("variantId");
ALTER TABLE "OnlineOrderItem" ADD CONSTRAINT "OnlineOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OrderEvent
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actor" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OnlineOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LedgerEntry
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "saleId" TEXT,
    "paymentId" TEXT,
    "onlineOrderId" TEXT,
    "kind" "LedgerEntryKind" NOT NULL,
    "delta" DECIMAL(15,2) NOT NULL,
    "balanceAfter" DECIMAL(15,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'COP',
    "description" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LedgerEntry_clientId_createdAt_idx" ON "LedgerEntry"("clientId", "createdAt");
CREATE INDEX "LedgerEntry_saleId_idx" ON "LedgerEntry"("saleId");
CREATE INDEX "LedgerEntry_paymentId_idx" ON "LedgerEntry"("paymentId");
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_onlineOrderId_fkey" FOREIGN KEY ("onlineOrderId") REFERENCES "OnlineOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- StockMovement
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "movementType" "StockMovementType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "refSaleId" TEXT,
    "refOrderId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");
CREATE INDEX "StockMovement_variantId_createdAt_idx" ON "StockMovement"("variantId", "createdAt");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ProductAsset
CREATE TABLE "ProductAsset" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "type" "AssetType" NOT NULL DEFAULT 'IMAGE',
    "position" INTEGER NOT NULL DEFAULT 0,
    "altText" TEXT,
    "urlOriginal" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAsset_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ProductAsset" ADD CONSTRAINT "ProductAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAsset" ADD CONSTRAINT "ProductAsset_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DIAN / invoice schema (integration deferred to P6)
CREATE TABLE "DianResolution" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "rangeFrom" INTEGER NOT NULL,
    "rangeTo" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "resolutionNumber" TEXT NOT NULL,
    "technicalKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentConsecutive" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DianResolution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ElectronicInvoice" (
    "id" TEXT NOT NULL,
    "saleId" TEXT,
    "onlineOrderId" TEXT,
    "resolutionId" TEXT,
    "prefix" TEXT,
    "consecutive" INTEGER,
    "cufe" TEXT,
    "issueDate" TIMESTAMP(3),
    "type" "ElectronicInvoiceType" NOT NULL DEFAULT 'INVOICE',
    "customerNit" TEXT,
    "customerDocumentType" TEXT,
    "customerLegalName" TEXT,
    "customerEmail" TEXT,
    "customerAddress" TEXT,
    "subtotal" DECIMAL(15,2),
    "totalIva" DECIMAL(15,2),
    "totalRetention" DECIMAL(15,2),
    "total" DECIMAL(15,2),
    "status" "ElectronicInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "providerResponse" JSONB,
    "providerTrackId" TEXT,
    "pdfUrl" TEXT,
    "xmlUrl" TEXT,
    "sentToCustomerAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectronicInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ElectronicInvoice_saleId_key" ON "ElectronicInvoice"("saleId");
CREATE UNIQUE INDEX "ElectronicInvoice_onlineOrderId_key" ON "ElectronicInvoice"("onlineOrderId");
CREATE UNIQUE INDEX "ElectronicInvoice_cufe_key" ON "ElectronicInvoice"("cufe");
ALTER TABLE "ElectronicInvoice" ADD CONSTRAINT "ElectronicInvoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ElectronicInvoice" ADD CONSTRAINT "ElectronicInvoice_onlineOrderId_fkey" FOREIGN KEY ("onlineOrderId") REFERENCES "OnlineOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ElectronicInvoice" ADD CONSTRAINT "ElectronicInvoice_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "DianResolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ElectronicInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "ivaRate" DECIMAL(5,2),
    "ivaAmount" DECIMAL(15,2),
    "subtotal" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "ElectronicInvoiceItem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ElectronicInvoiceItem" ADD CONSTRAINT "ElectronicInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ElectronicInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InvoiceAuditLog" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "fromStatus" "ElectronicInvoiceStatus",
    "toStatus" "ElectronicInvoiceStatus" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceAuditLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "InvoiceAuditLog" ADD CONSTRAINT "InvoiceAuditLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ElectronicInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CustomerFiscalData" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "clientId" TEXT,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "dvCode" TEXT,
    "regimeType" TEXT,
    "taxAddress" TEXT,
    "taxCity" TEXT,
    "taxDepartment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerFiscalData_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomerFiscalData_customerId_key" ON "CustomerFiscalData"("customerId");
CREATE UNIQUE INDEX "CustomerFiscalData_clientId_key" ON "CustomerFiscalData"("clientId");
ALTER TABLE "CustomerFiscalData" ADD CONSTRAINT "CustomerFiscalData_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerFiscalData" ADD CONSTRAINT "CustomerFiscalData_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
