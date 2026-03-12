import { Router } from 'express';
import { authenticate } from '../../middleware/tenantGuard';
import { expensesService } from './expenses.service';
import { createExpenseSchema, updateExpenseSchema } from './expenses.schema';

const router = Router();

// ─── EXPENSES ROUTES (UNIFICADO) ─────────────────────────────────────────────

/**
 * GET /api/expenses
 * Listar egresos con filtros opcionales
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { shiftId, type, isPaid, startDate, endDate } = req.query;

    const filters: any = {};
    if (shiftId) filters.shiftId = String(shiftId);
    if (type) filters.type = String(type);
    if (isPaid !== undefined) filters.isPaid = isPaid === 'true';
    if (startDate) filters.startDate = String(startDate);
    if (endDate) filters.endDate = String(endDate);

    const expenses = await expensesService.listExpenses(tenantId, filters);
    res.json(expenses);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/expenses/:id
 * Obtener egreso por ID
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const expenseId = String(req.params.id);

    const expense = await expensesService.getExpenseById(tenantId, expenseId);
    res.json(expense);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/expenses
 * Crear nuevo egreso
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const validatedData = createExpenseSchema.parse(req.body);

    const expense = await expensesService.createExpense(tenantId, validatedData);
    res.status(201).json(expense);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/expenses/:id
 * Actualizar egreso
 */
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const expenseId = String(req.params.id);
    const validatedData = updateExpenseSchema.parse(req.body);

    const expense = await expensesService.updateExpense(tenantId, expenseId, validatedData);
    res.json(expense);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/expenses/:id
 * Eliminar egreso
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const expenseId = String(req.params.id);

    const result = await expensesService.deleteExpense(tenantId, expenseId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/expenses/shift/:shiftId
 * Obtener egresos de un turno
 */
router.get('/shift/:shiftId', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const shiftId = String(req.params.shiftId);

    const expenses = await expensesService.getExpensesByShift(tenantId, shiftId);
    res.json(expenses);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/expenses/type/:type
 * Obtener egresos por tipo
 */
router.get('/type/:type', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const type = String(req.params.type) as 'CASH' | 'STRUCTURAL' | 'SUPPLIES';

    const expenses = await expensesService.getExpensesByType(tenantId, type);
    res.json(expenses);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/expenses/total/:type
 * Obtener total de egresos por tipo
 */
router.get('/total/:type', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const type = String(req.params.type) as 'CASH' | 'STRUCTURAL' | 'SUPPLIES';
    const { startDate, endDate } = req.query;

    const total = await expensesService.getTotalByType(
      tenantId,
      type,
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined
    );
    res.json({ total });
  } catch (error) {
    next(error);
  }
});

export default router;
