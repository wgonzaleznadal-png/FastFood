import express from "express";
import cors from "cors";
import helmet from "helmet";
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
    
    // En desarrollo, permitir localhost y red local (192.168.x.x, 10.x.x.x)
    if (process.env.NODE_ENV === "development") {
      if (
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        /https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin)
      ) {
        return callback(null, true);
      }
    }
    
    // En producción, solo permitir FRONTEND_URL
    const allowedOrigin = process.env.FRONTEND_URL ?? "http://localhost:3000";
    if (!allowedOrigin || allowedOrigin === "http://localhost:3000") {
      if (process.env.NODE_ENV === "production") {
        console.error("FATAL: FRONTEND_URL must be set in production");
      }
    }
    if (origin === allowedOrigin) {
      return callback(null, true);
    }
    
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
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
  max: process.env.NODE_ENV === "development" ? 10000 : 200 // Mucho más permisivo en dev
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

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/refresh", authLimiter);
app.use("/api/auth", authRouter);
app.use("/api/shifts", shiftsRouter);
app.use("/api/finance", financeRouter);
app.use("/api/config", configRouter);
app.use("/api/menu", menuRouter);
app.use("/api/products", productsRouter);
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/customers", customersRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/expenses", expensesRouter);

app.use(errorHandler);

export default app;
