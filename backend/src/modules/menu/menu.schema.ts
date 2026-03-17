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
  status: z.enum(["PENDING", "WEIGHED", "PAID", "DELIVERED", "CANCELLED"]),
  customerName: z.string().max(100).optional(),
  isDelivery: z.boolean().optional(),
  deliveryAddress: z.string().max(500).optional(),
  deliveryPhone: z.string().max(30).optional(),
  isSentToKitchen: z.boolean().optional(),
  paymentMethod: z.string().optional(),
  items: z.array(kgItemSchema).optional(),
  cartaItems: z.array(cartaItemOrderSchema).optional(),
});

export const sendToKitchenSchema = z.object({
  customerName: z.string().max(100).optional(),
  isDelivery: z.boolean().optional(),
  deliveryAddress: z.string().max(500).optional(),
  deliveryPhone: z.string().max(30).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(kgItemSchema).optional(),
  cartaItems: z.array(cartaItemOrderSchema).optional(),
});

export const cancelOrderSchema = z.object({
  cancellationNote: z.string().min(1).max(500),
  pin: z.string().optional(),
});

export type KgProductInput = z.infer<typeof kgProductSchema>;
export type CreateKgOrderInput = z.infer<typeof createKgOrderSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
