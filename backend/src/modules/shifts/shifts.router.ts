import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requireRole } from "@/middleware/tenantGuard";
import { requireModule } from "@/middleware/moduleGuard";
import {
  openShiftSchema, closeShiftSchema, cashExpenseSchema,
  addCollaboratorSchema, createCadeteSchema, assignCadeteSchema, renderOrderSchema, closeDeliverySchema,
} from "./shifts.schema";
import {
  openShift,
  closeShift,
  getMyActiveShift,
  getShiftSummary,
  getShiftDetailedSummary,
  listShifts,
  createCashExpense,
  listCashExpenses,
  deleteCashExpense,
  addCollaborator,
  removeCollaborator,
  listCollaborators,
  createCadete,
  listCadetes,
  deleteCadete,
  assignCadete,
  renderCadeteOrder,
  getCadeteSummary,
  getDeliveryOrders,
  updateOrderCoords,
  closeDeliverySettlement,
} from "./shifts.service";

const router = Router();
router.use(authenticate);
router.use(requireModule("caja"));

// ═══════════════════════════════════════════════════════════════════════════
// STATIC ROUTES (must come before /:id to avoid Express matching them as params)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/shifts/me — get my active open shift
router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shift = await getMyActiveShift(req.auth!.tenantId, req.auth!.userId);
    res.json(shift ?? null);
  } catch (err) { next(err); }
});

// GET /api/shifts — list all shifts (OWNER/MANAGER only)
router.get(
  "/",
  requireRole("OWNER", "MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as string | undefined;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const shifts = await listShifts(req.auth!.tenantId, { status, from, to });
      res.json(shifts);
    } catch (err) { next(err); }
  }
);

// POST /api/shifts/open — open a new shift
router.post("/open", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = openShiftSchema.parse(req.body);
    const shift = await openShift(req.auth!.tenantId, req.auth!.userId, input);
    res.status(201).json(shift);
  } catch (err) { next(err); }
});

// ─── CASH EXPENSES (static prefix: /expenses) ──────────────────────────────

// POST /api/shifts/expenses — create a cash expense
router.post("/expenses", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = cashExpenseSchema.parse(req.body);
    const expense = await createCashExpense(req.auth!.tenantId, req.auth!.userId, input);
    res.status(201).json(expense);
  } catch (err) { next(err); }
});

// DELETE /api/shifts/expenses/:id — delete a cash expense
router.delete("/expenses/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteCashExpense(
      req.auth!.tenantId, req.auth!.userId, String(req.params.id), req.auth!.role
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── CADETES (static prefix: /cadetes) ──────────────────────────────────────

// GET /api/shifts/cadetes/list — list cadetes
router.get("/cadetes/list", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listCadetes(req.auth!.tenantId));
  } catch (err) { next(err); }
});

// POST /api/shifts/cadetes — create cadete
router.post("/cadetes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createCadeteSchema.parse(req.body);
    res.status(201).json(await createCadete(req.auth!.tenantId, input));
  } catch (err) { next(err); }
});

// DELETE /api/shifts/cadetes/:id — soft delete cadete
router.delete("/cadetes/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteCadete(req.auth!.tenantId, String(req.params.id));
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── DELIVERY ORDER OPS (static prefix: /orders) ───────────────────────────

// PATCH /api/shifts/orders/:id/assign-cadete
router.patch("/orders/:id/assign-cadete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cadeteId } = assignCadeteSchema.parse(req.body);
    res.json(await assignCadete(req.auth!.tenantId, String(req.params.id), cadeteId));
  } catch (err) { next(err); }
});

// PATCH /api/shifts/orders/:id/render
router.patch("/orders/:id/render", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cadetePaidAmount } = renderOrderSchema.parse(req.body);
    res.json(await renderCadeteOrder(req.auth!.tenantId, String(req.params.id), cadetePaidAmount));
  } catch (err) { next(err); }
});

// PATCH /api/shifts/orders/:id/coords
router.patch("/orders/:id/coords", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng } = req.body;
    res.json(await updateOrderCoords(req.auth!.tenantId, String(req.params.id), lat, lng));
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// PARAMETERIZED ROUTES (/:id prefix — MUST come after all static routes)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/shifts/:id — get shift summary
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shift = await getShiftSummary(
      req.auth!.tenantId, String(req.params.id), req.auth!.userId, req.auth!.role
    );
    res.json(shift);
  } catch (err) { next(err); }
});

// GET /api/shifts/:id/summary
router.get("/:id/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await getShiftDetailedSummary(
      req.auth!.tenantId, String(req.params.id), req.auth!.userId, req.auth!.role
    );
    res.json(summary);
  } catch (err) { next(err); }
});

// POST /api/shifts/:id/close
router.post("/:id/close", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = closeShiftSchema.parse(req.body);
    const shift = await closeShift(
      req.auth!.tenantId, req.auth!.userId, String(req.params.id), input, req.auth!.role
    );
    res.json(shift);
  } catch (err) { next(err); }
});

// GET /api/shifts/:id/expenses
router.get("/:id/expenses", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expenses = await listCashExpenses(req.auth!.tenantId, String(req.params.id));
    res.json(expenses);
  } catch (err) { next(err); }
});

// GET /api/shifts/:id/collaborators
router.get("/:id/collaborators", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collabs = await listCollaborators(req.auth!.tenantId, String(req.params.id));
    res.json(collabs);
  } catch (err) { next(err); }
});

// POST /api/shifts/:id/collaborators
router.post("/:id/collaborators", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = addCollaboratorSchema.parse(req.body);
    const collab = await addCollaborator(
      req.auth!.tenantId, req.auth!.userId, String(req.params.id), input
    );
    res.status(201).json(collab);
  } catch (err) { next(err); }
});

// DELETE /api/shifts/:id/collaborators/:userId
router.delete("/:id/collaborators/:userId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await removeCollaborator(
      req.auth!.tenantId, req.auth!.userId, String(req.params.id), String(req.params.userId)
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /api/shifts/:id/delivery
router.get("/:id/delivery", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getDeliveryOrders(req.auth!.tenantId, String(req.params.id)));
  } catch (err) { next(err); }
});

// GET /api/shifts/:id/cadete/:cadeteId/summary
router.get("/:id/cadete/:cadeteId/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getCadeteSummary(
      req.auth!.tenantId, String(req.params.id), String(req.params.cadeteId)
    ));
  } catch (err) { next(err); }
});

// POST /api/shifts/:id/close-delivery
router.post("/:id/close-delivery", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = closeDeliverySchema.parse(req.body);
    res.json(await closeDeliverySettlement(req.auth!.tenantId, String(req.params.id), input));
  } catch (err) { next(err); }
});

export default router;
