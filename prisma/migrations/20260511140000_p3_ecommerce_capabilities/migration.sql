-- P3: persistent cart, coupons, shipping zones/rates, customer addresses, checkout risk fields

CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE "CouponScope" AS ENUM ('ORDER', 'CATEGORY', 'PRODUCT');

CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "sessionToken" VARCHAR(80),
    "customerId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Cart_sessionToken_key" ON "Cart"("sessionToken");
CREATE UNIQUE INDEX "Cart_customerId_key" ON "Cart"("customerId");

ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceAtAdd" DECIMAL(10,2) NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CartItem_cartId_variantId_key" ON "CartItem"("cartId", "variantId");

ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ShippingZone" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShippingZone_code_key" ON "ShippingZone"("code");

CREATE TABLE "ShippingRate" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL DEFAULT 'STANDARD',
    "baseFee" DECIMAL(10,2) NOT NULL,
    "perKg" DECIMAL(10,4),
    "freeAbove" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShippingRate_zoneId_code_key" ON "ShippingRate"("zoneId", "code");

ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "ShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" VARCHAR(80),
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL DEFAULT 'CO',
    "postalCode" TEXT,
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "scope" "CouponScope" NOT NULL DEFAULT 'ORDER',
    "categoryId" TEXT,
    "productId" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "perCustomerLimit" INTEGER,
    "minOrderAmount" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnlineOrder" ADD COLUMN "riskScore" INTEGER;
ALTER TABLE "OnlineOrder" ADD COLUMN "riskTier" VARCHAR(24);
ALTER TABLE "OnlineOrder" ADD COLUMN "couponCodeSnapshot" VARCHAR(40);
ALTER TABLE "OnlineOrder" ADD COLUMN "customerAddressId" TEXT;
ALTER TABLE "OnlineOrder" ADD COLUMN "shippingZoneCode" VARCHAR(40);

ALTER TABLE "OnlineOrder" ADD CONSTRAINT "OnlineOrder_customerAddressId_fkey" FOREIGN KEY ("customerAddressId") REFERENCES "CustomerAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "discountApplied" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");

ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OnlineOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Initial Colombia zones (admin-editable later via DB / future CRUD)
INSERT INTO "ShippingZone" ("id", "code", "name", "sortOrder", "createdAt")
VALUES
  ('sz-bogota', 'BOGOTA', 'Bogotá D.C. y Sabana cercana', 1, CURRENT_TIMESTAMP),
  ('sz-major', 'MAJOR_CITIES', 'Principales ciudades (Medellín, Cali, Barranquilla, etc.)', 2, CURRENT_TIMESTAMP),
  ('sz-national', 'NATIONAL', 'Resto del país / nacional', 3, CURRENT_TIMESTAMP);

INSERT INTO "ShippingRate" ("id", "zoneId", "code", "baseFee", "perKg", "freeAbove", "createdAt", "updatedAt")
VALUES
  ('sr-bogota', 'sz-bogota', 'STANDARD', 8000, 1200, 150000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sr-major', 'sz-major', 'STANDARD', 12000, 1800, 200000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sr-national', 'sz-national', 'STANDARD', 18000, 2500, 280000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
