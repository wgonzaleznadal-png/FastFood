import { Request, Response, NextFunction } from "express";

export function validateParam(name: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[name] as string | undefined;
    if (!value || !/^c[a-z0-9]{24,}$/.test(value)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    next();
  };
}
