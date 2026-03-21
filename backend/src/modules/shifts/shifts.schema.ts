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

/** Medios admitidos en ingresos/egresos manuales del turno (misma convención que pedidos). */
export const shiftLedgerPaymentMethodSchema = z.enum([
  "EFECTIVO",
  "MERCADO PAGO",
  "TARJETA",
  "TRANSFERENCIA",
]);

export const cashExpenseSchema = z.object({
  shiftId: z.string().min(1),
  amount: z.number().positive("El monto debe ser positivo"),
  description: z.string().min(1, "Ingresá un concepto"),
  notes: z.string().optional(),
  /** Por defecto sale del cajón; MP/tarjeta/transferencia no restan efectivo esperado. */
  paymentMethod: shiftLedgerPaymentMethodSchema.optional().default("EFECTIVO"),
});

export const manualShiftIncomeSchema = z.object({
  shiftId: z.string().min(1),
  amount: z.number().positive("El monto debe ser positivo"),
  paymentMethod: shiftLedgerPaymentMethodSchema,
  description: z.string().min(1, "Ingresá un concepto").max(300),
  notes: z.string().max(500).optional(),
  /** Obligatorio si el local tiene PIN de administrador configurado. */
  pin: z.string().regex(/^\d{4,6}$/, "PIN: 4 a 6 dígitos").optional(),
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

/** Sumar efectivo al cambio ya registrado en la apertura (turno abierto). */
export const addInitialCashSchema = z.object({
  amount: z.number().positive("El monto debe ser mayor a 0"),
  note: z.string().max(500).optional(),
});

export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
export type CashExpenseInput = z.infer<typeof cashExpenseSchema>;
export type ManualShiftIncomeInput = z.infer<typeof manualShiftIncomeSchema>;
export type AddCollaboratorInput = z.infer<typeof addCollaboratorSchema>;
export type CreateCadeteInput = z.infer<typeof createCadeteSchema>;
export type AssignCadeteInput = z.infer<typeof assignCadeteSchema>;
export type RenderOrderInput = z.infer<typeof renderOrderSchema>;
export type CloseDeliveryInput = z.infer<typeof closeDeliverySchema>;
export type AddInitialCashInput = z.infer<typeof addInitialCashSchema>;
