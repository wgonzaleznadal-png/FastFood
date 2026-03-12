import { Router, Request, Response, NextFunction } from "express";
import { loginSchema, registerTenantSchema } from "./auth.schema";
import { login, registerTenant } from "./auth.service";

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
  } catch (err) {
    next(err);
  }
});

export default router;
