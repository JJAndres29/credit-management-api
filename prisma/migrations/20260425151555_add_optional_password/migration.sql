-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password" TEXT;
