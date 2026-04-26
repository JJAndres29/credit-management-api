-- AlterTable
ALTER TABLE "OnlineOrder" ADD COLUMN "paymentGatewayReference" TEXT;
ALTER TABLE "OnlineOrder" ADD COLUMN "paymentUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OnlineOrder_paymentGatewayReference_key" ON "OnlineOrder"("paymentGatewayReference");

-- CreateTable
CREATE TABLE "ProcessedWebhook" (
    "id"          TEXT NOT NULL,
    "provider"    TEXT NOT NULL,
    "eventId"     TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedWebhook_provider_eventId_key" ON "ProcessedWebhook"("provider", "eventId");
