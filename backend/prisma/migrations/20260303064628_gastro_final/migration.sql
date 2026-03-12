-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "subtotal" DROP DEFAULT;

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "customerName" DROP DEFAULT,
ALTER COLUMN "orderNumber" DROP DEFAULT;
