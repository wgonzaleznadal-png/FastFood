-- AlterTable
ALTER TABLE "kg_orders" ADD COLUMN     "cadeteId" TEXT,
ADD COLUMN     "cadetePaidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'EFECTIVO';

-- CreateTable
CREATE TABLE "shift_collaborators" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cadetes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cadetes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_collaborators_shiftId_userId_key" ON "shift_collaborators"("shiftId", "userId");

-- AddForeignKey
ALTER TABLE "shift_collaborators" ADD CONSTRAINT "shift_collaborators_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_collaborators" ADD CONSTRAINT "shift_collaborators_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_collaborators" ADD CONSTRAINT "shift_collaborators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadetes" ADD CONSTRAINT "cadetes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kg_orders" ADD CONSTRAINT "kg_orders_cadeteId_fkey" FOREIGN KEY ("cadeteId") REFERENCES "cadetes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
