-- Snapshot de datos de envío para transportista (obligatorios en checkout, no en registro).

ALTER TABLE "OnlineOrder" ADD COLUMN "shippingRecipientName" VARCHAR(120);
ALTER TABLE "OnlineOrder" ADD COLUMN "shippingRecipientDocumentType" VARCHAR(4);
ALTER TABLE "OnlineOrder" ADD COLUMN "shippingRecipientDocumentNumber" VARCHAR(32);
ALTER TABLE "OnlineOrder" ADD COLUMN "shippingLine1" VARCHAR(300);
ALTER TABLE "OnlineOrder" ADD COLUMN "shippingLine2" VARCHAR(200);
ALTER TABLE "OnlineOrder" ADD COLUMN "shippingCity" VARCHAR(120);
ALTER TABLE "OnlineOrder" ADD COLUMN "shippingDepartment" VARCHAR(120);
ALTER TABLE "OnlineOrder" ADD COLUMN "shippingPostalCode" VARCHAR(16);
ALTER TABLE "OnlineOrder" ADD COLUMN "shippingRecipientPhone" VARCHAR(30);
