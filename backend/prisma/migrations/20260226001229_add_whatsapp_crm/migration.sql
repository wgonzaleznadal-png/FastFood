-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('LOCAL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "WaChatState" AS ENUM ('TALKING', 'PENDING', 'COMPLETED', 'NO_REPLY');

-- AlterTable
ALTER TABLE "kg_orders" ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "waJid" TEXT;

-- CreateTable
CREATE TABLE "wa_session_states" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jid" TEXT NOT NULL,
    "customerName" TEXT,
    "chatState" "WaChatState" NOT NULL DEFAULT 'TALKING',
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "lastMessage" TEXT,
    "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_session_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wa_session_states_tenantId_jid_key" ON "wa_session_states"("tenantId", "jid");

-- AddForeignKey
ALTER TABLE "wa_session_states" ADD CONSTRAINT "wa_session_states_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
