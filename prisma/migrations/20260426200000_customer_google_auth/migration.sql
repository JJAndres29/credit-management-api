-- Drop legacy verification column; password and mustChangePassword stay because
-- classic auth and reset-password flows still exist alongside Google auth.
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "emailVerifiedAt";

-- Add Google OAuth identity
ALTER TABLE "Customer" ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "Customer_googleId_key" ON "Customer"("googleId");
