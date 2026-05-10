-- Política comercial simplificada:
-- • Bogotá (BOGOTA): envío siempre $0.
-- • Otras zonas: tarifa plana (sin cargo por kg) si el subtotal de mercancía es < $200.000;
--   desde $200.000 (inclusive) el envío es gratis (freeAbove).
-- Ajusta baseFee si cambia la tarifa plana nacional.

UPDATE "ShippingRate"
SET
  "baseFee" = 0,
  "perKg" = NULL,
  "freeAbove" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'sr-bogota';

UPDATE "ShippingRate"
SET
  "baseFee" = 15000,
  "perKg" = NULL,
  "freeAbove" = 200000,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'sr-major';

UPDATE "ShippingRate"
SET
  "baseFee" = 15000,
  "perKg" = NULL,
  "freeAbove" = 200000,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'sr-national';
