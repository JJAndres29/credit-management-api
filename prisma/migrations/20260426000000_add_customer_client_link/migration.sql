-- AlterTable: add optional clientId FK to Customer (one-to-one with Client)
ALTER TABLE "Customer" ADD COLUMN "clientId" TEXT UNIQUE;

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
