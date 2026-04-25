-- AlterTable: add mustChangePassword flag so the frontend can force a password change
-- after admin reset or forgot-password flow
ALTER TABLE "Customer" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
