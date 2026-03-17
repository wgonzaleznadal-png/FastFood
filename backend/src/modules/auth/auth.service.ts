import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { LoginInput, RegisterTenantInput } from "./auth.schema";
import { createError } from "@/middleware/errorHandler";
import { seedDefaultPermissions } from "@/modules/config/config.service";
import { logAudit } from "@/lib/auditLog";

const _jwtSecret = process.env.JWT_SECRET;
if (!_jwtSecret || _jwtSecret.length < 32) {
  throw new Error("FATAL: JWT_SECRET must be at least 32 characters long");
}
const JWT_SECRET: string = _jwtSecret;

export async function registerTenant(input: RegisterTenantInput) {
  const existing = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } });
  if (existing) throw createError("Tenant slug already taken", 409);

  const passwordHash = await bcrypt.hash(input.password, 12);

  const tenant = await prisma.tenant.create({
    data: {
      name: input.tenantName,
      slug: input.tenantSlug,
      users: {
        create: {
          name: input.ownerName,
          email: input.email,
          passwordHash,
          role: "OWNER",
        },
      },
    },
    include: { users: true },
  });

  const owner = tenant.users[0];

  // Seed default module permissions for the new tenant
  await seedDefaultPermissions(tenant.id);

  const token = signToken(owner.id, tenant.id, owner.role);
  const refreshToken = await generateRefreshToken(owner.id, tenant.id);

  logAudit({ tenantId: tenant.id, userId: owner.id, action: "TENANT_REGISTERED", entity: "tenant", entityId: tenant.id });
  return { token, refreshToken, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug }, user: { id: owner.id, name: owner.name, email: owner.email, role: owner.role } };
}

export async function login(input: LoginInput) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } });
  if (!tenant || !tenant.isActive) throw createError("Credenciales inválidas", 401);

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: input.email.toLowerCase(), isActive: true },
  });
  const DUMMY_HASH = "$2a$12$x/TnlCxbqOGeMOEJVFG0z.WB.gDBGf.7QLSbrkLhLkZYmHkjlYwSa";
  const valid = await bcrypt.compare(input.password, user?.passwordHash || DUMMY_HASH);
  if (!user || !valid) {
    logAudit({ tenantId: tenant.id, action: "LOGIN_FAILED", entity: "user", metadata: { email: input.email } });
    throw createError("Credenciales inválidas", 401);
  }

  const token = signToken(user.id, tenant.id, user.role);
  const refreshToken = await generateRefreshToken(user.id, tenant.id);

  logAudit({ tenantId: tenant.id, userId: user.id, action: "LOGIN_SUCCESS", entity: "user", entityId: user.id });
  return { token, refreshToken, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug }, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

function signToken(userId: string, tenantId: string, role: string): string {
  return jwt.sign({ userId, tenantId, role }, JWT_SECRET, { expiresIn: "15m", algorithm: "HS256" } as jwt.SignOptions);
}

async function generateRefreshToken(userId: string, tenantId: string): Promise<string> {
  const raw = crypto.randomBytes(64).toString("hex");
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { token: hashed, userId, tenantId, expiresAt },
  });

  return raw;
}

export async function refreshAccessToken(rawRefreshToken: string) {
  const hashed = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");

  const stored = await prisma.refreshToken.findUnique({ where: { token: hashed } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw createError("Refresh token inválido o expirado", 401);
  }

  const user = await prisma.user.findFirst({
    where: { id: stored.userId, tenantId: stored.tenantId, isActive: true },
  });
  if (!user) throw createError("Usuario no encontrado", 401);

  const tenant = await prisma.tenant.findUnique({ where: { id: stored.tenantId } });
  if (!tenant || !tenant.isActive) throw createError("Tenant inactivo", 401);

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  const newRefreshToken = await generateRefreshToken(user.id, tenant.id);

  const token = signToken(user.id, tenant.id, user.role);
  logAudit({ tenantId: stored.tenantId, userId: stored.userId, action: "TOKEN_REFRESHED", entity: "user", entityId: stored.userId });
  return { token, refreshToken: newRefreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role }, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } };
}

export async function revokeRefreshToken(rawRefreshToken: string) {
  const hashed = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
  await prisma.refreshToken.updateMany({
    where: { token: hashed, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  logAudit({ action: "TOKEN_REVOKED", entity: "user" });
}
