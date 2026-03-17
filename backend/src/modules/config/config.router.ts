import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requireRole } from "@/middleware/tenantGuard";
import { requireModule } from "@/middleware/moduleGuard";
import { MODULES } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  getTenantPermissions,
  updateModulePermission,
  setUserModuleAccess,
  getUserEffectivePermissions,
  listUsers,
  createUser,
  updateUser,
  setAdminPin,
  validateAdminPin,
  hasAdminPin,
} from "./config.service";

const router = Router();
router.use(authenticate);

// ─── Effective permissions for the current user (all roles can call this) ─────
router.get("/permissions/me", async (req: Request, res: Response) => {
  try {
    const perms = await getUserEffectivePermissions(
      req.auth!.tenantId,
      req.auth!.userId,
      req.auth!.role
    );
    res.json(perms);
  } catch (err) {
    console.error("[permissions/me]", err);
    try {
      const fallback: Record<string, boolean> = {};
      for (const m of MODULES) {
        fallback[m.key] = true;
        for (const s of m.submodules ?? []) fallback[s.key] = true;
      }
      res.json(fallback);
    } catch (fallbackErr) {
      console.error("[permissions/me] fallback failed", fallbackErr);
      res.json({ caja: true, dashboard: true, menu: true, cocina: true, finanzas: true, configuracion: true });
    }
  }
});

// ─── Admin-only routes below ──────────────────────────────────────────────────
router.use(requireModule("configuracion"));
router.use(requireRole("OWNER", "MANAGER"));

// GET /api/config/permissions — full permission matrix for the tenant
router.get("/permissions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const perms = await getTenantPermissions(req.auth!.tenantId);
    res.json(perms);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/config/permissions — update a module permission
const updatePermSchema = z.object({
  moduleKey: z.string(),
  submoduleKey: z.string().nullable().optional(),
  allowedRoles: z.array(z.enum(["OWNER", "MANAGER", "CASHIER", "COOK", "STAFF"])).optional(),
  isEnabled: z.boolean().optional(),
});

router.patch(
  "/permissions",
  requireRole("OWNER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { moduleKey, submoduleKey, allowedRoles, isEnabled } = updatePermSchema.parse(req.body);
      const perm = await updateModulePermission(
        req.auth!.tenantId,
        moduleKey,
        submoduleKey ?? null,
        { allowedRoles, isEnabled }
      );
      res.json(perm);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/config/permissions/user — set user-level override
const userAccessSchema = z.object({
  userId: z.string(),
  moduleKey: z.string(),
  submoduleKey: z.string().nullable().optional(),
  hasAccess: z.boolean(),
});

router.patch(
  "/permissions/user",
  requireRole("OWNER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, moduleKey, submoduleKey, hasAccess } = userAccessSchema.parse(req.body);
      const access = await setUserModuleAccess(
        req.auth!.tenantId,
        userId,
        moduleKey,
        submoduleKey ?? null,
        hasAccess
      );
      res.json(access);
    } catch (err) {
      next(err);
    }
  }
);

// ─── Team management ──────────────────────────────────────────────────────────
router.get("/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await listUsers(req.auth!.tenantId);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

const createUserSchema = z.object({
  name: z.string().min(2, "Nombre mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Contraseña mínimo 6 caracteres"),
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "COOK", "STAFF", "TELEFONISTA", "ENCARGADO_DELIVERY"]),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "COOK", "STAFF", "TELEFONISTA", "ENCARGADO_DELIVERY"]).optional(),
  isActive: z.boolean().optional(),
});

router.post("/users", requireRole("OWNER", "MANAGER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createUserSchema.parse(req.body);
    const user = await createUser(req.auth!.tenantId, data);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

router.patch("/users/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const data = updateUserSchema.parse(req.body);
    const user = await updateUser(req.auth!.tenantId, id, data);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ─── Admin PIN ────────────────────────────────────────────────────────────────
router.get("/admin-pin", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const has = await hasAdminPin(req.auth!.tenantId);
    res.json({ hasPin: has });
  } catch (err) { next(err); }
});

router.post("/admin-pin", requireRole("OWNER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pin } = z.object({ pin: z.string().regex(/^\d{4,6}$/, "PIN debe ser de 4-6 dígitos") }).parse(req.body);
    const result = await setAdminPin(req.auth!.tenantId, pin);
    res.json(result);
  } catch (err) { next(err); }
});

router.post("/admin-pin/validate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pin } = z.object({ pin: z.string().regex(/^\d{4,6}$/, "PIN debe ser de 4-6 dígitos") }).parse(req.body);
    const valid = await validateAdminPin(req.auth!.tenantId, pin);
    res.json({ valid });
  } catch (err) { next(err); }
});

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────
router.get("/audit-logs", requireRole("OWNER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { action, entity, limit: limitStr } = req.query;
    const limit = Math.min(Number(limitStr) || 100, 500);

    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(action ? { action: String(action) } : {}),
        ...(entity ? { entity: String(entity) } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json(logs);
  } catch (err) {
    next(err);
  }
});

export default router;
