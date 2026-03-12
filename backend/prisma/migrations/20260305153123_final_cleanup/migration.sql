/*
  Warnings:

  - You are about to drop the `cash_expenses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kg_order_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kg_orders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `module_permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `structural_expenses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_module_access` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "cash_expenses" DROP CONSTRAINT "cash_expenses_shiftId_fkey";

-- DropForeignKey
ALTER TABLE "cash_expenses" DROP CONSTRAINT "cash_expenses_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "cash_expenses" DROP CONSTRAINT "cash_expenses_userId_fkey";

-- DropForeignKey
ALTER TABLE "kg_order_items" DROP CONSTRAINT "kg_order_items_kgOrderId_fkey";

-- DropForeignKey
ALTER TABLE "kg_order_items" DROP CONSTRAINT "kg_order_items_productId_fkey";

-- DropForeignKey
ALTER TABLE "kg_orders" DROP CONSTRAINT "kg_orders_cadeteId_fkey";

-- DropForeignKey
ALTER TABLE "kg_orders" DROP CONSTRAINT "kg_orders_customerId_fkey";

-- DropForeignKey
ALTER TABLE "kg_orders" DROP CONSTRAINT "kg_orders_shiftId_fkey";

-- DropForeignKey
ALTER TABLE "kg_orders" DROP CONSTRAINT "kg_orders_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "module_permissions" DROP CONSTRAINT "module_permissions_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "structural_expenses" DROP CONSTRAINT "structural_expenses_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "user_module_access" DROP CONSTRAINT "user_module_access_modulePermissionId_fkey";

-- DropForeignKey
ALTER TABLE "user_module_access" DROP CONSTRAINT "user_module_access_userId_fkey";

-- DropTable
DROP TABLE "cash_expenses";

-- DropTable
DROP TABLE "kg_order_items";

-- DropTable
DROP TABLE "kg_orders";

-- DropTable
DROP TABLE "module_permissions";

-- DropTable
DROP TABLE "structural_expenses";

-- DropTable
DROP TABLE "user_module_access";

-- DropEnum
DROP TYPE "KgOrderStatus";
