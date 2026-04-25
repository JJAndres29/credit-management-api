-- Drop password management columns
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "password";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "mustChangePassword";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "emailVerifiedAt";

-- Add Google OAuth identity
ALTER TABLE "Customer" ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "Customer_googleId_key" ON "Customer"("googleId");
