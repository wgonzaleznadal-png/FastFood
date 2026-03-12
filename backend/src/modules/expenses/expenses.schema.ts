import { z } from 'zod';

// ─── SCHEMAS PARA EXPENSE UNIFICADO ──────────────────────────────────────────

export const createExpenseSchema = z.object({
  shiftId: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),
  type: z.enum(['CASH', 'STRUCTURAL', 'SUPPLIES']),
  category: z.string().optional(),
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default('ARS'),
  period: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional(),
  isPaid: z.boolean().default(false),
  notes: z.string().optional(),
});

export const updateExpenseSchema = z.object({
  type: z.enum(['CASH', 'STRUCTURAL', 'SUPPLIES']).optional(),
  category: z.string().optional(),
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  period: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional(),
  isPaid: z.boolean().optional(),
  notes: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
