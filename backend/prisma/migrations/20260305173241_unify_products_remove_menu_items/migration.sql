/*
  Warnings:

  - You are about to drop the column `menuItemId` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the `menu_items` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ProductSection" AS ENUM ('KILO', 'CARTA');

-- DropForeignKey
ALTER TABLE "menu_items" DROP CONSTRAINT "menu_items_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_menuItemId_fkey";

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "menuItemId";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "destination" "KitchenStation",
ADD COLUMN     "preparationTime" INTEGER,
ADD COLUMN     "section" "ProductSection" NOT NULL DEFAULT 'KILO',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unitType" "UnitType" NOT NULL DEFAULT 'UNIT';

-- DropTable
DROP TABLE "menu_items";

-- DropEnum
DROP TYPE "MenuItemType";
