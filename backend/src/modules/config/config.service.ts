import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createError } from "@/middleware/errorHandler";
import { logAudit } from "@/lib/auditLog";
import { MODULES, DEFAULT_ROLE_ACCESS } from "@/lib/modules";

// ─── SISTEMA DE PERMISOS SIMPLIFICADO (SIN TABLAS LEGACY) ────────────────────
// Ahora los permisos se calculan en memoria basados en roles y configuración estática

// ─── Seed default permissions (NO-OP - ya no usamos tablas) ──────────────────
export async function seedDefaultPermissions(tenantId: string) {
  // No-op: Los permisos ahora se calculan en memoria desde DEFAULT_ROLE_ACCESS
  return;
}

// ─── Get all permissions for a tenant ────────────────────────────────────────
export async function getTenantPermissions(tenantId: string) {
  // Retornar estructura de módulos con permisos por defecto basados en roles
  return MODULES.map((m) => {
    const allowedRoles = DEFAULT_ROLE_ACCESS[m.key] ?? ["OWNER"];
    return {
      ...m,
      permission: {
        moduleKey: m.key,
        submoduleKey: null,
        allowedRoles,
        isEnabled: true,
      },
      submodules: (m.submodules ?? []).map((s) => {
        const subAllowedRoles = DEFAULT_ROLE_ACCESS[s.key] ?? ["OWNER"];
        return {
          ...s,
          permission: {
            moduleKey: m.key,
            submoduleKey: s.key,
            allowedRoles: subAllowedRoles,
            isEnabled: true,
          },
        };
      }),
    };
  });
}

// ─── Update module permission (NO-OP - configuración estática) ────────────────
export async function updateModulePermission(
  tenantId: string,
  moduleKey: string,
  submoduleKey: string | null,
  data: { allowedRoles?: string[]; isEnabled?: boolean }
) {
  // No-op: Los permisos son estáticos y se configuran en modules.ts
  // Para cambiar permisos, editar DEFAULT_ROLE_ACCESS en /lib/modules.ts
  throw createError("Los permisos se configuran en el código (modules.ts)", 501);
}

// ─── Set user-level override (NO-OP - sin sistema de overrides) ──────────────
export async function setUserModuleAccess(
  tenantId: string,
  userId: string,
  moduleKey: string,
  submoduleKey: string | null,
  hasAccess: boolean
) {
  // No-op: Sin sistema de overrides por usuario
  throw createError("Los permisos se asignan por rol, no por usuario individual", 501);
}

// ─── Get effective permissions for a user (calculado en memoria) ──────────────
export async function getUserEffectivePermissions(tenantId: string, userId: string, role: string) {
  // Verificar que el usuario existe y pertenece al tenant
  const user = await prisma.user.findFirst({ 
    where: { id: userId, tenantId },
    select: { id: true, role: true }
  });
  
  if (!user) {
    return {};
  }

  const result: Record<string, boolean> = {};

  // Calcular permisos basados en el rol del usuario
  for (const module of MODULES) {
    const allowedRoles = DEFAULT_ROLE_ACCESS[module.key] ?? ["OWNER"];
    const hasAccess = allowedRoles.includes(role);
    result[module.key] = hasAccess;

    // Procesar submódulos
    if (module.submodules) {
      for (const submodule of module.submodules) {
        const subAllowedRoles = DEFAULT_ROLE_ACCESS[submodule.key] ?? ["OWNER"];
        const hasSubAccess = subAllowedRoles.includes(role);
        result[submodule.key] = hasSubAccess;
      }
    }
  }

  return result;
}

// ─── Admin PIN ────────────────────────────────────────────────────────────────
export async function setAdminPin(tenantId: string, pin: string) {
  if (!pin || pin.length < 4 || pin.length > 6) {
    throw createError("El PIN debe tener entre 4 y 6 dígitos", 400);
  }
  if (!/^\d+$/.test(pin)) {
    throw createError("El PIN solo puede contener números", 400);
  }
  const hashed = await bcrypt.hash(pin, 10);
  await prisma.tenant.update({ where: { id: tenantId }, data: { adminPin: hashed } });
  logAudit({ tenantId, action: "ADMIN_PIN_CHANGED", entity: "tenant", entityId: tenantId });
  return { success: true };
}

export async function validateAdminPin(tenantId: string, pin: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { adminPin: true } });
  if (!tenant?.adminPin) return false;
  return bcrypt.compare(pin, tenant.adminPin);
}

export async function hasAdminPin(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { adminPin: true } });
  return !!tenant?.adminPin;
}

// ─── Team management ──────────────────────────────────────────────────────────
export async function createUser(
  tenantId: string,
  data: { name: string; email: string; password: string; role: string }
) {
  const emailLower = data.email.toLowerCase().trim();
  const existing = await prisma.user.findFirst({
    where: { tenantId, email: emailLower },
  });
  if (existing) throw createError("Ya existe un usuario con ese email", 409);

  const passwordHash = await bcrypt.hash(data.password, 12);

  const newUser = await prisma.user.create({
    data: {
      tenantId,
      name: data.name.trim(),
      email: emailLower,
      passwordHash,
      role: data.role as "OWNER" | "MANAGER" | "CASHIER" | "COOK" | "STAFF" | "TELEFONISTA" | "ENCARGADO_DELIVERY",
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  logAudit({ tenantId, action: "USER_CREATED", entity: "user", entityId: newUser.id });
  return newUser;
}

export async function listUsers(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function updateUser(
  tenantId: string,
  userId: string,
  data: { name?: string; role?: string; isActive?: boolean }
) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) throw createError("Usuario no encontrado", 404);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.role ? { role: data.role as never } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  logAudit({ tenantId, action: "USER_UPDATED", entity: "user", entityId: userId });
  return updated;
}
