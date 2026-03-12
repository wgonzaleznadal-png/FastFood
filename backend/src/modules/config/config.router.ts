import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requireRole } from "@/middleware/tenantGuard";
import { requireModule } from "@/middleware/moduleGuard";
import { z } from "zod";
import {
  getTenantPermissions,
  updateModulePermission,
  setUserModuleAccess,
  getUserEffectivePermissions,
  listUsers,
  updateUser,
} from "./config.service";

const router = Router();
router.use(authenticate);

// ─── Effective permissions for the current user (all roles can call this) ─────
router.get("/permissions/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const perms = await getUserEffectivePermissions(
      req.auth!.tenantId,
      req.auth!.userId,
      req.auth!.role
    );
    res.json(perms);
  } catch (err) {
    next(err);
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

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "COOK", "STAFF"]).optional(),
  isActive: z.boolean().optional(),
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

export default router;
