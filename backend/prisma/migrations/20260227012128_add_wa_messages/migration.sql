-- CreateTable
CREATE TABLE "wa_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jid" TEXT NOT NULL,
    "fromMe" BOOLEAN NOT NULL,
    "text" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wa_messages_tenantId_jid_timestamp_idx" ON "wa_messages"("tenantId", "jid", "timestamp");

-- AddForeignKey
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_tenantId_jid_fkey" FOREIGN KEY ("tenantId", "jid") REFERENCES "wa_session_states"("tenantId", "jid") ON DELETE CASCADE ON UPDATE CASCADE;
