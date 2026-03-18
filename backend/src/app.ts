import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { errorHandler } from "@/middleware/errorHandler";
import authRouter from "@/modules/auth/auth.router";
import shiftsRouter from "@/modules/shifts/shifts.router";
import financeRouter from "@/modules/finance/finance.router";
import configRouter from "@/modules/config/config.router";
import menuRouter from "@/modules/menu/menu.router";
import productsRouter from "@/modules/products/products.router";
import whatsappRouter from "@/modules/whatsapp/whatsapp.router";
import customersRouter from "@/modules/customers/customers.router";
import ordersRouter from "@/modules/orders/orders.router";
import expensesRouter from "@/modules/expenses/expenses.router";

const app = express();

app.use(helmet());

// CORS: En desarrollo, aceptar cualquier origen de la red local
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      return callback(new Error("Origin header required"));
    }
    
    const allowedOriginsDev = ["http://localhost:3000", "http://127.0.0.1:3000"];
    if (process.env.NODE_ENV === "development") {
      if (allowedOriginsDev.includes(origin)) return callback(null, true);
      if (process.env.ALLOWED_ORIGINS_DEV) {
        const extra = process.env.ALLOWED_ORIGINS_DEV.split(",").map((o) => o.trim());
        if (extra.includes(origin)) return callback(null, true);
      }
    }
    
    // En producción: FRONTEND_URL (puede ser lista separada por comas)
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
    if (!frontendUrl || frontendUrl === "http://localhost:3000") {
      if (process.env.NODE_ENV === "production") {
        console.error("FATAL: FRONTEND_URL must be set in production");
      }
    }
    const allowed = frontendUrl.split(",").map((u) => u.trim()).filter(Boolean);
    if (allowed.includes(origin)) return callback(null, true);

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "50kb" }));

// Log API requests in development
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const status = res.statusCode;
      if (status >= 500) {
        console.error(`[${status}] ${req.method} ${req.path}`);
      }
    });
    next();
  });
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos. Intente en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const limiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: process.env.NODE_ENV === "development" ? 500 : 200
});
app.use(limiter);

app.get("/health", (_req, res) => res.json({ status: "ok", service: "gastrodash-api" }));

app.get("/health/db", async (_req, res) => {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    console.error("[health/db]", err);
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);
app.use("/api/v1/auth/refresh", authLimiter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/shifts", shiftsRouter);
app.use("/api/v1/finance", financeRouter);
app.use("/api/v1/config", configRouter);
app.use("/api/v1/menu", menuRouter);
app.use("/api/v1/products", productsRouter);
app.use("/api/v1/whatsapp", whatsappRouter);
app.use("/api/v1/customers", customersRouter);
app.use("/api/v1/orders", ordersRouter);
app.use("/api/v1/expenses", expensesRouter);

app.use(errorHandler);

export default app;
