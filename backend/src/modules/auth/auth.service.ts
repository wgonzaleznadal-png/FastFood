import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { LoginInput, RegisterTenantInput } from "./auth.schema";
import { createError } from "@/middleware/errorHandler";
import { seedDefaultPermissions } from "@/modules/config/config.service";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

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

  return { token, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug }, user: { id: owner.id, name: owner.name, email: owner.email, role: owner.role } };
}

export async function login(input: LoginInput) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } });
  if (!tenant || !tenant.isActive) throw createError("Local no encontrado o inactivo", 404);

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: "OWNER", isActive: true },
  });
  if (!user) throw createError("Credenciales inválidas", 401);

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw createError("Credenciales inválidas", 401);

  const token = signToken(user.id, tenant.id, user.role);

  return { token, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug }, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

function signToken(userId: string, tenantId: string, role: string): string {
  return jwt.sign({ userId, tenantId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}
