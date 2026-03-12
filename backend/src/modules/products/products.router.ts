import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "@/middleware/tenantGuard";
import { requireModule } from "@/middleware/moduleGuard";
import { prisma } from "@/lib/prisma";
import { createError } from "@/middleware/errorHandler";

const router = Router();

router.use(authenticate);
router.use(requireModule("menu"));

// ─── GET PRODUCTS (UNIFICADO) ────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { section, category } = req.query;
    const tenantId = req.auth!.tenantId;
    
    const products = await prisma.product.findMany({
      where: {
        tenantId, // SIEMPRE filtrar por tenantId
        ...(section ? { section: section as any } : {}),
        ...(category ? { category: category as any } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// ─── CREATE PRODUCT ──────────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.auth!.tenantId;
    
    const product = await prisma.product.create({
      data: {
        tenantId, // SIEMPRE incluir tenantId
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        pricePerKg: req.body.pricePerKg,
        imageUrl: req.body.imageUrl,
        isAvailable: req.body.isAvailable ?? true,
        isAvailableForBot: req.body.isAvailableForBot ?? true,
        unitType: req.body.unitType || "UNIT",
        section: req.body.section || "KILO",
        category: req.body.category,
        destination: req.body.destination,
        prepTime: req.body.prepTime,
        sortOrder: req.body.sortOrder ?? 0,
      },
    });
    
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// ─── UPDATE PRODUCT ──────────────────────────────────────────────────────────
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.auth!.tenantId;
    
    const product = await prisma.product.findFirst({
      where: { id: String(req.params.id), tenantId }, // SIEMPRE filtrar por tenantId
    });
    
    if (!product) throw createError("Producto no encontrado", 404);

    const updated = await prisma.product.update({
      where: { id: String(req.params.id) },
      data: {
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        pricePerKg: req.body.pricePerKg,
        imageUrl: req.body.imageUrl,
        isAvailable: req.body.isAvailable,
        category: req.body.category,
        destination: req.body.destination,
        prepTime: req.body.prepTime,
        sortOrder: req.body.sortOrder,
      },
    });
    
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE PRODUCT ──────────────────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
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
