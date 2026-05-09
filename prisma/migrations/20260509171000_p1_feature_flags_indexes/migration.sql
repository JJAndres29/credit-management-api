CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE "FeatureFlag" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "description" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

INSERT INTO "FeatureFlag" ("id", "key", "enabled", "description", "updatedAt")
VALUES
  ('5c202ac8-0e30-457c-8a3b-7a47d7563dc1', 'checkout_enabled', true, 'Habilita o apaga el checkout online completo.', CURRENT_TIMESTAMP),
  ('6a504e71-9d8f-4c3e-8c3d-f4fe26c07b62', 'mp_enabled', true, 'Habilita pagos por Mercado Pago en checkout.', CURRENT_TIMESTAMP),
  ('05fe4392-00da-4697-aae5-173d9ae2bec8', 'email_enabled', true, 'Kill switch global para envios de email.', CURRENT_TIMESTAMP),
  ('da71d32a-0c5f-43cf-aa2c-c61abb24e47e', 'whatsapp_enabled', true, 'Kill switch global para WhatsApp.', CURRENT_TIMESTAMP),
  ('0dc8a1e3-178f-4793-9477-c48dfb3d6099', 'coupon_enabled', false, 'Reserva para cupones cuando se implemente P3.', CURRENT_TIMESTAMP),
  ('572a4a83-1c8f-4441-a53d-6b967d131f0f', 'fraud_strict_mode', false, 'Modo antifraude estricto para endurecer reglas futuras.', CURRENT_TIMESTAMP),
  ('a82d63a5-5b6d-4477-9601-2e6e4acc7d5b', 'credit_module_enabled', true, 'Habilita modulo crediticio: clients, sales, payments, reports y collections.', CURRENT_TIMESTAMP),
  ('c42ddd76-7e68-4f31-9995-2c2595f28fe0', 'physical_sales_enabled', true, 'Habilita ventas fisicas/POS del modulo sales.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

CREATE INDEX "Product_isActive_categoryId_idx" ON "Product"("isActive", "categoryId");
CREATE INDEX "OnlineOrder_customerId_createdAt_idx" ON "OnlineOrder"("customerId", "createdAt");
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");
CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);
