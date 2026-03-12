/*
  Warnings:

  - You are about to alter the column `quantity` on the `order_items` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(8,3)`.
  - A unique constraint covering the columns `[shiftId,orderNumber]` on the table `orders` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `subtotal` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerName` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderNumber` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('UNIT', 'KG', 'PORTION');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('CASH', 'STRUCTURAL', 'SUPPLIES');

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_userId_fkey";

-- AlterTable order_items: agregar unitType y cambiar quantity a Decimal
ALTER TABLE "order_items" ADD COLUMN "unitType" "UnitType" NOT NULL DEFAULT 'UNIT';
ALTER TABLE "order_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(8,3);
ALTER TABLE "order_items" ADD COLUMN "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Calcular subtotal para items existentes
UPDATE "order_items" SET "subtotal" = CAST("quantity" AS DECIMAL) * "unitPrice";

-- AlterTable orders: agregar nuevos campos
ALTER TABLE "orders" ADD COLUMN "cadeteId" TEXT;
ALTER TABLE "orders" ADD COLUMN "cadetePaidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "customerId" TEXT;
ALTER TABLE "orders" ADD COLUMN "customerName" TEXT NOT NULL DEFAULT 'Cliente';
ALTER TABLE "orders" ADD COLUMN "deliveryAddress" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliveryLat" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "deliveryLng" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "deliveryPhone" TEXT;
ALTER TABLE "orders" ADD COLUMN "isDelivery" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "isSentToKitchen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "orderNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "orders" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'EFECTIVO';
ALTER TABLE "orders" ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "orders" ADD COLUMN "waJid" TEXT;
ALTER TABLE "orders" ALTER COLUMN "userId" DROP NOT NULL;

-- Generar orderNumber secuencial por shift para orders existentes
WITH numbered_orders AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "shiftId" ORDER BY "createdAt") as rn
  FROM "orders"
)
UPDATE "orders" o
SET "orderNumber" = no.rn::INTEGER
FROM numbered_orders no
WHERE o.id = no.id;

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shiftId" TEXT,
    "userId" TEXT,
    "type" "ExpenseType" NOT NULL,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "period" TEXT,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_shiftId_orderNumber_key" ON "orders"("shiftId", "orderNumber");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cadeteId_fkey" FOREIGN KEY ("cadeteId") REFERENCES "cadetes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
