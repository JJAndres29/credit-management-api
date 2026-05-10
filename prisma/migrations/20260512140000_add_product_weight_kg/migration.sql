-- Peso unitario (kg) para cotización de envío en checkout; null hasta que el admin lo cargue.
ALTER TABLE "Product" ADD COLUMN "weightKg" DECIMAL(10, 3);
