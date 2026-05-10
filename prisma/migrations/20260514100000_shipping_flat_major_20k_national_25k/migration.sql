-- Tarifa plana por zona + envío gratis desde umbral de mercancía:
-- • Bogotá: envío siempre $0 (baseFee 0).
-- • MAJOR_CITIES / NATIONAL: tarifa fija si subtotal mercancía < $200.000; desde $200.000 inclusive el envío es $0.
--
-- El backend usa `computeShippingFeeCop(..., merchandiseSubtotalCop)` con la suma de líneas
-- (precio × cantidad, bruto catálogo), antes del cupón — ver CreateOnlineOrderUseCase.

UPDATE "ShippingRate"
SET
  "baseFee" = 0,
  "perKg" = NULL,
  "freeAbove" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'sr-bogota';

UPDATE "ShippingRate"
SET
  "baseFee" = 20000,
  "perKg" = NULL,
  "freeAbove" = 200000,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'sr-major';

UPDATE "ShippingRate"
SET
  "baseFee" = 25000,
  "perKg" = NULL,
  "freeAbove" = 200000,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'sr-national';
