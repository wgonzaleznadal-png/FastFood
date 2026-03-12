import { z } from "zod";

export const structuralExpenseSchema = z.object({
  category: z.enum(["RENT", "SALARY", "TAX", "UTILITY", "SUPPLIER", "MAINTENANCE", "OTHER"]),
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("ARS"),
  period: z.string().min(1),
  dueDate: z.string().datetime().optional(),
  isPaid: z.boolean().optional(),
  notes: z.string().optional(),
});

export type StructuralExpenseInput = z.infer<typeof structuralExpenseSchema>;
