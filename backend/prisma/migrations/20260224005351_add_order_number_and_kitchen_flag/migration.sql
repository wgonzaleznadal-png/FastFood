-- AlterTable: Add columns with defaults
ALTER TABLE "kg_orders" 
ADD COLUMN "isSentToKitchen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "orderNumber" INTEGER DEFAULT 0;

-- Assign sequential orderNumber per shift for existing records
WITH numbered_orders AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY "shiftId" ORDER BY "createdAt") as row_num
  FROM "kg_orders"
)
UPDATE "kg_orders"
SET "orderNumber" = numbered_orders.row_num
FROM numbered_orders
WHERE "kg_orders".id = numbered_orders.id;

-- Make orderNumber required (remove default)
ALTER TABLE "kg_orders" ALTER COLUMN "orderNumber" SET NOT NULL;
ALTER TABLE "kg_orders" ALTER COLUMN "orderNumber" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "kg_orders_shiftId_orderNumber_key" ON "kg_orders"("shiftId", "orderNumber");
