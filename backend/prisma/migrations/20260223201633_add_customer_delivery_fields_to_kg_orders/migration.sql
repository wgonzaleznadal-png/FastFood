-- AlterEnum
ALTER TYPE "KgOrderStatus" ADD VALUE 'DELIVERED';

-- AlterTable: Add columns with defaults first
ALTER TABLE "kg_orders" 
ADD COLUMN "customerName" TEXT DEFAULT 'Cliente',
ADD COLUMN "deliveryAddress" TEXT,
ADD COLUMN "deliveryPhone" TEXT,
ADD COLUMN "isDelivery" BOOLEAN NOT NULL DEFAULT false;

-- Update existing rows to have proper customer names
UPDATE "kg_orders" SET "customerName" = 'Cliente' WHERE "customerName" IS NULL;

-- Make customerName required (remove default)
ALTER TABLE "kg_orders" ALTER COLUMN "customerName" SET NOT NULL;
ALTER TABLE "kg_orders" ALTER COLUMN "customerName" DROP DEFAULT;
