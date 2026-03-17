-- Row-Level Security for all tenant-scoped tables
-- Defense-in-depth: even if application code misses tenantId, DB blocks cross-tenant access

-- Enable RLS on all tenant-scoped tables
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cadetes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shift_collaborators" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wa_session_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wa_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tables" ENABLE ROW LEVEL SECURITY;

-- Create policies for tenant isolation
-- Using current_setting with missing_ok=true so it returns NULL if not set
-- The superuser/owner bypasses RLS by default, so app queries need FORCE

CREATE POLICY tenant_isolation_users ON "users"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_products ON "products"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_categories ON "categories"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_orders ON "orders"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_shifts ON "shifts"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_expenses ON "expenses"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_cadetes ON "cadetes"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_shift_collaborators ON "shift_collaborators"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_customers ON "customers"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_wa_session_states ON "wa_session_states"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_wa_messages ON "wa_messages"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_tables ON "tables"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Tenants table: only allow access to own tenant
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tenants ON "tenants"
  USING ("id" = current_setting('app.current_tenant_id', true));

-- Note: RLS is NOT forced for the DB owner role. To fully enforce RLS,
-- create a separate application role and use FORCE ROW LEVEL SECURITY.
-- For now, RLS serves as defense-in-depth alongside application-level checks.

-- Audit Log table (no RLS needed - managed by application)
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- RefreshToken table
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),

  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add missing indexes on tenantId for performance
CREATE INDEX IF NOT EXISTS "users_tenantId_idx" ON "users"("tenantId");
CREATE INDEX IF NOT EXISTS "products_tenantId_idx" ON "products"("tenantId");
CREATE INDEX IF NOT EXISTS "categories_tenantId_idx" ON "categories"("tenantId");
CREATE INDEX IF NOT EXISTS "orders_tenantId_idx" ON "orders"("tenantId");
CREATE INDEX IF NOT EXISTS "shifts_tenantId_idx" ON "shifts"("tenantId");
CREATE INDEX IF NOT EXISTS "expenses_tenantId_idx" ON "expenses"("tenantId");
CREATE INDEX IF NOT EXISTS "cadetes_tenantId_idx" ON "cadetes"("tenantId");
CREATE INDEX IF NOT EXISTS "shift_collaborators_tenantId_idx" ON "shift_collaborators"("tenantId");
CREATE INDEX IF NOT EXISTS "customers_tenantId_idx" ON "customers"("tenantId");
CREATE INDEX IF NOT EXISTS "wa_session_states_tenantId_idx" ON "wa_session_states"("tenantId");
CREATE INDEX IF NOT EXISTS "tables_tenantId_idx" ON "tables"("tenantId");

CREATE INDEX IF NOT EXISTS "refresh_tokens_tenantId_idx" ON "refresh_tokens"("tenantId");
