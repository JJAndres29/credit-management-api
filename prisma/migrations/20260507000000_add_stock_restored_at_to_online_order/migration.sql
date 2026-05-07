-- Add stockRestoredAt to track when stock was returned to inventory after a
-- cancellation or expiry. NULL = stock not restored yet.
-- Set whenever:
--   • Webhook DECLINED restores stock (process-payment-webhook.use-case.ts)
--   • Admin manually cancels/expires a PENDING_PAYMENT order
--   • The expiry job marks an order as EXPIRED
--   • The remediation script restores stock for legacy orders
ALTER TABLE "OnlineOrder"
  ADD COLUMN "stockRestoredAt" TIMESTAMP(3);

-- Partial index to accelerate the expiry job and the remediation script:
-- finds orders that still hold reserved stock (PENDING_PAYMENT past expiry,
-- or already CANCELLED/EXPIRED but never restored).
CREATE INDEX IF NOT EXISTS "OnlineOrder_pending_expired_idx"
  ON "OnlineOrder" ("status", "expiresAt")
  WHERE "stockRestoredAt" IS NULL;
