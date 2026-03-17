import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { sanitizeName } from "@/lib/sanitize";
import { authenticate, requireRole } from "@/middleware/tenantGuard";
import { requireModule } from "@/middleware/moduleGuard";
import { prisma } from "@/lib/prisma";
import { createError } from "@/middleware/errorHandler";

const createProductSchema = z.object({
  name: z.string().min(1).max(100).transform(sanitizeName),
  description: z.string().max(500).optional().nullable(),
  price: z.number().nonnegative(),
  pricePerKg: z.number().nonnegative().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  isAvailable: z.boolean().optional(),
  isAvailableForBot: z.boolean().optional(),
  unitType: z.enum(["UNIT", "KG", "PORTION"]).optional(),
  section: z.enum(["KILO", "CARTA"]).optional(),
  category: z.enum(["COMIDA", "BEBIDA"]).optional().nullable(),
  destination: z.enum(["COCINA", "BARRA", "DESPACHO"]).optional().nullable(),
  prepTime: z.number().int().nonnegative().optional().nullable(),
  sortOrder: z.number().int().nonnegative().optional(),
});

const updateProductSchema = createProductSchema.partial();

const router = Router();

router.use(authenticate);
router.use(requireModule("menu"));

// ─── GET PRODUCTS (UNIFICADO) ────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { section, category, destination } = req.query;
    const tenantId = req.auth!.tenantId;

    const products = await prisma.product.findMany({
      where: {
        tenantId,
        ...(section ? { section: section as any } : {}),
        ...(category ? { category: category as any } : {}),
        ...(destination ? { destination: destination as any } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// ─── CREATE PRODUCT ──────────────────────────────────────────────────────────
router.post("/", requireRole("OWNER", "MANAGER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.auth!.tenantId;
    const validated = createProductSchema.parse(req.body);
    
    const product = await prisma.product.create({
      data: {
        tenantId,
        ...validated,
        isAvailable: validated.isAvailable ?? true,
        isAvailableForBot: validated.isAvailableForBot ?? true,
        unitType: validated.unitType || "UNIT",
        section: validated.section || "KILO",
        sortOrder: validated.sortOrder ?? 0,
      },
    });
    
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// ─── UPDATE PRODUCT ──────────────────────────────────────────────────────────
router.put("/:id", requireRole("OWNER", "MANAGER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.auth!.tenantId;
    
    const product = await prisma.product.findFirst({
      where: { id: String(req.params.id), tenantId }, // SIEMPRE filtrar por tenantId
    });
    
    if (!product) throw createError("Producto no encontrado", 404);

    const validated = updateProductSchema.parse(req.body);

    const updated = await prisma.product.update({
      where: { id: String(req.params.id) },
      data: validated,
    });
    
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE PRODUCT ──────────────────────────────────────────────────────────
router.delete("/:id", requireRole("OWNER", "MANAGER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.auth!.tenantId;
    
    const product = await prisma.product.findFirst({
      where: { id: String(req.params.id), tenantId }, // SIEMPRE filtrar por tenantId
    });
    
    if (!product) throw createError("Producto no encontrado", 404);

    await prisma.product.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── TOGGLE AVAILABILITY ─────────────────────────────────────────────────────
router.patch("/:id/toggle", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.auth!.tenantId;
    
    const product = await prisma.product.findFirst({
      where: { id: String(req.params.id), tenantId }, // SIEMPRE filtrar por tenantId
    });
    
    if (!product) throw createError("Producto no encontrado", 404);

    const updated = await prisma.product.update({
      where: { id: String(req.params.id) },
      data: { isAvailable: !product.isAvailable },
    });
    
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
