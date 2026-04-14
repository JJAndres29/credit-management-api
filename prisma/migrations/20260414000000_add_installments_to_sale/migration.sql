-- CreateEnum
CREATE TYPE "InstallmentFrequency" AS ENUM ('MONTHLY', 'BIWEEKLY');

-- AlterTable: agrega soporte de cuotas a ventas a crédito
-- Los tres campos son opcionales (nullable) para mantener compatibilidad con ventas existentes.
-- installmentsCount: número de cuotas pactadas (mínimo 2 si se usa)
-- frequency:         periodicidad de pago (MONTHLY o BIWEEKLY)
-- installmentAmount: monto por cuota = total / installmentsCount (redondeado a 2 decimales)
ALTER TABLE "Sale"
  ADD COLUMN "installmentsCount" INTEGER,
  ADD COLUMN "frequency"         "InstallmentFrequency",
  ADD COLUMN "installmentAmount" DECIMAL(10,2);
