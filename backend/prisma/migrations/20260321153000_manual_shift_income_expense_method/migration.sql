-- AlterTable
ALTER TABLE "expenses" ADD COLUMN "paymentMethod" TEXT;

-- CreateTable
CREATE TABLE "shift_manual_incomes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_manual_incomes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shift_manual_incomes_tenantId_idx" ON "shift_manual_incomes"("tenantId");
CREATE INDEX "shift_manual_incomes_shiftId_idx" ON "shift_manual_incomes"("shiftId");

ALTER TABLE "shift_manual_incomes" ADD CONSTRAINT "shift_manual_incomes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shift_manual_incomes" ADD CONSTRAINT "shift_manual_incomes_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shift_manual_incomes" ADD CONSTRAINT "shift_manual_incomes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
