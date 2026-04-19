-- AlterTable: agrega initialPayment a Sale para descontar la cuota inicial
-- del cálculo de cuotas pagadas sin mezclarla con los pagos regulares.
ALTER TABLE "Sale" ADD COLUMN "initialPayment" DECIMAL(10,2);
