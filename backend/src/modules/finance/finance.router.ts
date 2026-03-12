import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requireRole } from "@/middleware/tenantGuard";
import { requireModule } from "@/middleware/moduleGuard";
import { structuralExpenseSchema } from "./finance.schema";
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getConsolidator,
} from "./finance.service";

const router = Router();
router.use(authenticate);
router.use(requireModule("finanzas"));
router.use(requireRole("OWNER", "MANAGER"));

// ─── Consolidator ─────────────────────────────────────────────────────────────
router.get("/consolidator", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const period = req.query.period as string | undefined;
    const data = await getConsolidator(req.auth!.tenantId, { from, to, period });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ─── Structural Expenses ──────────────────────────────────────────────────────
router.get("/expenses", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = req.query.period as string | undefined;
    const isPaid = req.query.isPaid as string | undefined;
    const category = req.query.category as string | undefined;
    const expenses = await listExpenses(req.auth!.tenantId, { period, isPaid, category });
    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

router.post("/expenses", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = structuralExpenseSchema.parse(req.body);
    const expense = await createExpense(req.auth!.tenantId, input);
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
});

router.put("/expenses/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const input = structuralExpenseSchema.partial().parse(req.body);
    const expense = await updateExpense(req.auth!.tenantId, id, input);
    res.json(expense);
  } catch (err) {
    next(err);
  }
});

router.delete(
  "/expenses/:id",
  requireRole("OWNER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteExpense(req.auth!.tenantId, String(req.params.id));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
