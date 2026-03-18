import { Router, Request, Response, NextFunction } from "express";
import { loginSchema, registerTenantSchema } from "./auth.schema";
import { login, registerTenant, refreshAccessToken, revokeRefreshToken } from "./auth.service";

const router = Router();
// Cross-origin (frontend en www.fastfood.com.ar, backend en Railway): sameSite "none" para que el navegador envíe cookies
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};
const TOKEN_COOKIE_OPTS = { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 };

function setAuthCookies(res: Response, token: string, refreshToken: string) {
  res.cookie("gastrodash_token", token, TOKEN_COOKIE_OPTS);
  res.cookie("gastrodash_refresh", refreshToken, COOKIE_OPTS);
}

function clearAuthCookies(res: Response) {
  const clearOpts = { path: "/", secure: process.env.NODE_ENV === "production", sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax" };
  res.clearCookie("gastrodash_token", clearOpts);
  res.clearCookie("gastrodash_refresh", clearOpts);
}

router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = registerTenantSchema.parse(req.body);
    const result = await registerTenant(input);
    setAuthCookies(res, result.token, result.refreshToken);
    res.status(201).json({ tenant: result.tenant, user: result.user });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await login(input);
    setAuthCookies(res, result.token, result.refreshToken);
    res.json({ tenant: result.tenant, user: result.user });
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
    const refreshToken = req.cookies?.gastrodash_refresh ?? req.body?.refreshToken;
    if (!refreshToken) {
      res.status(400).json({ error: "Refresh token requerido" });
      return;
    }
    const result = await refreshAccessToken(refreshToken);
    setAuthCookies(res, result.token, result.refreshToken);
    res.json({ tenant: result.tenant, user: result.user });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.gastrodash_refresh ?? req.body?.refreshToken;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    clearAuthCookies(res);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
