import { z } from "zod";

export const openShiftSchema = z.object({
  initialCash: z.number().nonnegative(),
  notes: z.string().optional(),
});

export const closeShiftSchema = z.object({
  finalCash: z.number().nonnegative(),
  notes: z.string().optional(),
  billCounts: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
});

export const cashExpenseSchema = z.object({
  shiftId: z.string().min(1),
  amount: z.number().positive("El monto debe ser positivo"),
  description: z.string().min(1, "Ingresá un concepto"),
  notes: z.string().optional(),
});

export const addCollaboratorSchema = z.object({
  userId: z.string().min(1),
});

export const createCadeteSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  phone: z.string().optional(),
});

export const assignCadeteSchema = z.object({
  cadeteId: z.string().min(1),
});

export const renderOrderSchema = z.object({
  cadetePaidAmount: z.number().nonnegative(),
});

export const closeDeliverySchema = z.object({
  receivedAmount: z.number().nonnegative(),
  deliveryPersonUserId: z.string().min(1).optional(),
  deliveryPersonName: z.string().optional(),
}).refine(
  (data) => data.deliveryPersonUserId || (data.deliveryPersonName && data.deliveryPersonName.trim().length > 0),
  { message: "Seleccioná el encargado de delivery o ingresá el nombre", path: ["deliveryPersonUserId"] }
);

export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
export type CashExpenseInput = z.infer<typeof cashExpenseSchema>;
export type AddCollaboratorInput = z.infer<typeof addCollaboratorSchema>;
export type CreateCadeteInput = z.infer<typeof createCadeteSchema>;
export type AssignCadeteInput = z.infer<typeof assignCadeteSchema>;
export type RenderOrderInput = z.infer<typeof renderOrderSchema>;
export type CloseDeliveryInput = z.infer<typeof closeDeliverySchema>;
