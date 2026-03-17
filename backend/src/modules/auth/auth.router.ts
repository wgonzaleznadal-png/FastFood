import { Router, Request, Response, NextFunction } from "express";
import { loginSchema, registerTenantSchema } from "./auth.schema";
import { login, registerTenant, refreshAccessToken, revokeRefreshToken } from "./auth.service";

const router = Router();

router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = registerTenantSchema.parse(req.body);
    const result = await registerTenant(input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await login(input);
    res.json(result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; name?: string };
    if (e?.statusCode && e.statusCode !== 500) {
      next(err);
      return;
    }
    if (e?.name === "ZodError") {
      next(err);
      return;
    }
    console.error("[auth/login]", err);
    res.status(503).json({ error: "Error de conexión. Verificá que PostgreSQL esté corriendo." });
  }
});

router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: "Refresh token requerido" });
      return;
    }
    const result = await refreshAccessToken(refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/logout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
