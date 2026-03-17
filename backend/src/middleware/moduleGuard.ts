import { Request, Response, NextFunction } from "express";
import { DEFAULT_ROLE_ACCESS } from "@/lib/modules";
import { logAudit } from "@/lib/auditLog";

// Checks if the authenticated user has access to a given module/submodule.
// Sistema simplificado: permisos basados en rol desde DEFAULT_ROLE_ACCESS
export function requireModule(moduleKey: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.auth) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const role = String(req.auth.role ?? "");
      const allowedRoles = DEFAULT_ROLE_ACCESS[moduleKey] ?? ["OWNER"];

      if (!allowedRoles.includes(role)) {
        logAudit({ tenantId: req.auth?.tenantId, userId: req.auth?.userId, action: "ACCESS_DENIED", entity: "module", metadata: { module: moduleKey, path: req.path } });
        res.status(403).json({ error: "Access denied for your role" });
        return;
      }
      next();
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[moduleGuard]", moduleKey, err);
      }
      res.status(403).json({ error: "Permission check failed" });
    }
  };
}
