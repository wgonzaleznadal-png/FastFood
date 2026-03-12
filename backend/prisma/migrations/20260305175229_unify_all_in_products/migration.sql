/*
  Warnings:

  - The values [KITCHEN,BAR,DELIVERY] on the enum `KitchenStation` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `categoryId` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `preparationTime` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `soldByKg` on the `products` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('COMIDA', 'BEBIDA');

-- AlterEnum
BEGIN;
CREATE TYPE "KitchenStation_new" AS ENUM ('COCINA', 'BARRA', 'DESPACHO');
ALTER TABLE "products" ALTER COLUMN "destination" TYPE "KitchenStation_new" USING ("destination"::text::"KitchenStation_new");
ALTER TABLE "order_items" ALTER COLUMN "destination" TYPE "KitchenStation_new" USING ("destination"::text::"KitchenStation_new");
ALTER TYPE "KitchenStation" RENAME TO "KitchenStation_old";
ALTER TYPE "KitchenStation_new" RENAME TO "KitchenStation";
DROP TYPE "public"."KitchenStation_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_categoryId_fkey";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "categoryId",
DROP COLUMN "preparationTime",
DROP COLUMN "soldByKg",
ADD COLUMN     "category" "ProductCategory",
ADD COLUMN     "prepTime" INTEGER;
