import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError | ZodError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = (err as AppError).statusCode ?? 500;
  if (err instanceof ZodError) {
    statusCode = 400;
  }
  const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  const message = (err as AppError).isOperational
    ? (err as AppError).message
    : err instanceof ZodError
      ? err.issues?.[0]?.message ?? "Datos inválidos"
      : isDev
        ? (err?.message ?? String(err))
        : "Internal Server Error";

  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === undefined) {
    console.error("[ERROR]", err?.message ?? err);
    if (err?.stack) console.error(err.stack);
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

export function createError(message: string, statusCode: number): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
}
