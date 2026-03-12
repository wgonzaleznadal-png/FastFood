import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requireRole } from "@/middleware/tenantGuard";
import { requireModule } from "@/middleware/moduleGuard";
import { createKgOrderSchema } from "./menu.schema";
import {
  listKgOrders,
  createKgOrder,
  updateKgOrderStatus,
  sendToKitchen,
  cancelKgOrder,
} from "./menu.service";

const router = Router();
router.use(authenticate);
router.use(requireModule("menu"));

// ─── ORDERS (KG + CARTA UNIFICADOS) ──────────────────────────────────────────

router.get("/kg-orders", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, userId, role } = req.auth!;
    const shiftId = req.query.shiftId as string | undefined;
    res.json(await listKgOrders(tenantId, userId, role, shiftId));
  } catch (err) { next(err); }
});

router.post("/kg-orders", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, userId, role } = req.auth!;
    const input = createKgOrderSchema.parse(req.body);
    res.status(201).json(await createKgOrder(tenantId, userId, role, input));
  } catch (err) { next(err); }
});

router.patch("/kg-orders/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // IMPORTANTE: req.body lleva la Paella y la dirección
    res.json(await updateKgOrderStatus(req.auth!.tenantId, String(req.params.id), req.body.status, req.body));
  } catch (err) { next(err); }
});

router.patch("/kg-orders/:id/send-to-kitchen", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ahora le pasamos req.body para que el service tenga la data nueva
    res.json(await sendToKitchen(req.auth!.tenantId, String(req.params.id), req.body));
  } catch (err) { next(err); }
});

router.delete("/kg-orders/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, userId, role } = req.auth!;
    const { cancellationNote, pin } = req.body;
    await cancelKgOrder(tenantId, userId, role, String(req.params.id), cancellationNote, pin);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── COCINA ENDPOINTS ────────────────────────────────────────────────────────
router.get("/cocina/orders", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { station } = req.query;
    const orders = await listKgOrders(req.auth!.tenantId, req.auth!.userId, req.auth!.role);
    const filtered = station ? orders.filter((o: any) => 
      o.items.some((i: any) => i.destination === station)
    ) : orders;
    res.json(filtered);
  } catch (err) { next(err); }
});

router.get("/cocina/stats", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await listKgOrders(req.auth!.tenantId, req.auth!.userId, req.auth!.role);
    const stats = {
      pending: orders.filter((o: any) => o.status === "PENDING").length,
      inProgress: orders.filter((o: any) => o.status === "IN_PROGRESS").length,
      ready: orders.filter((o: any) => o.status === "READY").length,
      total: orders.length,
    };
    res.json(stats);
  } catch (err) { next(err); }
});

router.get("/cocina/product-kilos", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await listKgOrders(req.auth!.tenantId, req.auth!.userId, req.auth!.role);
    const productTotals: Record<string, { name: string; totalKg: number }> = {};
    
    orders.forEach((order: any) => {
      order.items?.forEach((item: any) => {
        if (item.product && item.unitType === "KG") {
          const productName = item.product.name;
          if (!productTotals[productName]) {
            productTotals[productName] = { name: productName, totalKg: 0 };
          }
          productTotals[productName].totalKg += Number(item.quantity || item.weightKg || 0);
        }
      });
    });
    
    res.json(Object.values(productTotals).sort((a, b) => b.totalKg - a.totalKg));
  } catch (err) { next(err); }
});

export default router;
