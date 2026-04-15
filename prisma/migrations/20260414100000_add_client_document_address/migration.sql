-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CC', 'CE');

-- AlterTable
ALTER TABLE "Client"
  ADD COLUMN "documentType"   "DocumentType" NOT NULL DEFAULT 'CC',
  ADD COLUMN "documentNumber" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "address"        TEXT NOT NULL DEFAULT '',
  ADD COLUMN "neighborhood"   TEXT NOT NULL DEFAULT '';

-- Remove defaults (they were only needed for the backfill of existing rows)
ALTER TABLE "Client"
  ALTER COLUMN "documentType"   DROP DEFAULT,
  ALTER COLUMN "documentNumber" DROP DEFAULT,
  ALTER COLUMN "address"        DROP DEFAULT,
  ALTER COLUMN "neighborhood"   DROP DEFAULT;
