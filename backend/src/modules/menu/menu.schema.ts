import { z } from "zod";

export const kgProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  pricePerKg: z.number().positive(),
  categoryId: z.string().optional(),
  imageUrl: z.string().url().optional(),
  isAvailable: z.boolean().optional(),
});

export const kgItemSchema = z.object({
  productId: z.string(),
  weightKg: z.number().positive(),
  notes: z.string().optional(),
});

// Schema para items de carta en pedidos
export const cartaItemOrderSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive().int(),
  notes: z.string().optional(),
});

export const createKgOrderSchema = z.object({
  shiftId: z.string(),
  customerName: z.string().min(1),
  isDelivery: z.boolean().optional(),
  deliveryAddress: z.string().optional(),
  deliveryPhone: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(kgItemSchema).optional(), // Items de KG opcionales
  cartaItems: z.array(cartaItemOrderSchema).optional(), // Items de carta opcionales
  status: z.enum(["PENDING", "WEIGHED", "PAID", "DELIVERED", "CANCELLED"]).optional(),
  isSentToKitchen: z.boolean().optional(),
  paymentMethod: z.string().optional(),
  source: z.enum(["LOCAL", "WHATSAPP"]).optional(),
  waJid: z.string().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "WEIGHED", "PAID", "DELIVERED", "CANCELLED"]),}).passthrough();


export type KgProductInput = z.infer<typeof kgProductSchema>;
export type CreateKgOrderInput = z.infer<typeof createKgOrderSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
