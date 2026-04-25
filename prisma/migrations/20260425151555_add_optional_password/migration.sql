-- AlterTable: allow Google-only customers without a local password
ALTER TABLE "Customer" ALTER COLUMN "password" DROP NOT NULL;
