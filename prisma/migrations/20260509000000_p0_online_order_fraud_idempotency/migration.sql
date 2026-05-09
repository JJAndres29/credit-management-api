-- P0: antifraud capture on OnlineOrder + Idempotency-Key persistence

ALTER TABLE "OnlineOrder" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "OnlineOrder" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "OnlineOrder" ADD COLUMN "deviceFingerprintHash" TEXT;

CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyRecord_key_operation_key" ON "IdempotencyRecord"("key", "operation");
