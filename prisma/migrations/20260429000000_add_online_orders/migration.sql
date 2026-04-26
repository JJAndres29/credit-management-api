-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderPaymentMethod" AS ENUM ('ONLINE_GATEWAY', 'WHATSAPP_MANUAL');

-- CreateTable
CREATE TABLE "OnlineOrder" (
    "id"              TEXT NOT NULL,
    "orderNumber"     SERIAL NOT NULL,
    "customerId"      TEXT,
    "guestName"       TEXT,
    "guestPhone"      TEXT,
    "guestEmail"      TEXT,
    "shippingAddress" TEXT NOT NULL,
    "status"          "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "totalAmount"     DECIMAL(10,2) NOT NULL,
    "paymentMethod"   "OrderPaymentMethod" NOT NULL,
    "expiresAt"       TIMESTAMP(3),
    "paidAt"          TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineOrderItem" (
    "id"                  TEXT NOT NULL,
    "orderId"             TEXT NOT NULL,
    "productId"           TEXT NOT NULL,
    "quantity"            INTEGER NOT NULL,
    "unitPrice"           DECIMAL(10,2) NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,

    CONSTRAINT "OnlineOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnlineOrder_orderNumber_key" ON "OnlineOrder"("orderNumber");

-- AddForeignKey
ALTER TABLE "OnlineOrder" ADD CONSTRAINT "OnlineOrder_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineOrderItem" ADD CONSTRAINT "OnlineOrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "OnlineOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineOrderItem" ADD CONSTRAINT "OnlineOrderItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
