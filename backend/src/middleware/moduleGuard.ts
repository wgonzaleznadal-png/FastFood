import { Request, Response, NextFunction } from "express";
import { DEFAULT_ROLE_ACCESS } from "@/lib/modules";

// Checks if the authenticated user has access to a given module/submodule.
// Sistema simplificado: permisos basados en rol desde DEFAULT_ROLE_ACCESS
export function requireModule(moduleKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { role } = req.auth!;

    try {
      // Obtener roles permitidos para este módulo desde la configuración estática
      const allowedRoles = DEFAULT_ROLE_ACCESS[moduleKey] ?? ["OWNER"];

      // Verificar si el rol del usuario tiene acceso
      if (!allowedRoles.includes(role)) {
        res.status(403).json({ error: "Access denied for your role" });
        return;
      }

      next();
    } catch {
      res.status(500).json({ error: "Permission check failed" });
    }
  };
}
