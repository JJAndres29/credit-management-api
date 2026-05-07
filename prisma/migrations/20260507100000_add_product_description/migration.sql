-- Add optional description to Product for e-commerce display.
-- TEXT (unlimited length), nullable — existing products are not affected.
ALTER TABLE "Product" ADD COLUMN "description" TEXT;
