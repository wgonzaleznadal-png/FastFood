-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "deliverySettlementAmount" DECIMAL(10,2),
ADD COLUMN     "deliverySettlementAt" TIMESTAMP(3),
ADD COLUMN     "deliverySettlementBy" TEXT;
