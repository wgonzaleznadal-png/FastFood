import { z } from 'zod';
import { sanitizeName } from '../../lib/sanitize';

// ─── SCHEMAS PARA ORDER UNIFICADO ────────────────────────────────────────────

export const createOrderItemSchema = z.object({
  productId: z.string().cuid(),
  unitType: z.enum(['UNIT', 'KG', 'PORTION']).default('UNIT'),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  subtotal: z.number().positive(),
  notes: z.string().optional(),
});

export const createOrderSchema = z.object({
  shiftId: z.string().cuid(),
  userId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
  cadeteId: z.string().cuid().optional(),
  tableId: z.string().cuid().optional(),
  orderNumber: z.number().int().positive(),
  customerName: z.string().min(1),
  isDelivery: z.boolean().default(false),
  deliveryAddress: z.string().optional(),
  deliveryPhone: z.string().optional(),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
  paymentMethod: z.string().default('EFECTIVO'),
  cadetePaidAmount: z.number().default(0),
  isSentToKitchen: z.boolean().default(false),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED']).default('PENDING'),
  source: z.enum(['LOCAL', 'WHATSAPP']).default('LOCAL'),
  waJid: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(createOrderItemSchema).min(1),
});

export const updateOrderSchema = z.object({
  customerName: z.string().min(1).optional(),
  isDelivery: z.boolean().optional(),
  deliveryAddress: z.string().optional(),
  deliveryPhone: z.string().optional(),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
  paymentMethod: z.string().optional(),
  cadetePaidAmount: z.number().optional(),
  isSentToKitchen: z.boolean().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
  items: z.array(createOrderItemSchema).optional(),
});

export const assignCadeteSchema = z.object({
  cadeteId: z.string().cuid(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED']),
});

export const updateCoordsSchema = z.object({
  deliveryLat: z.number().min(-90).max(90),
  deliveryLng: z.number().min(-180).max(180),
});

export const createOrderInputSchema = z.object({
  shiftId: z.string().min(1),
  customerName: z.string().min(1).max(100).transform(sanitizeName),
  isDelivery: z.boolean().default(false),
  deliveryAddress: z.string().max(500).optional(),
  deliveryPhone: z.string().max(30).optional(),
  source: z.enum(["LOCAL", "WHATSAPP"]).default("LOCAL"),
  customerId: z.string().min(1).optional(),
  waJid: z.string().optional(),
  notes: z.string().max(1000).optional(),
  paymentMethod: z.string().optional(),
  isSentToKitchen: z.boolean().optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().positive().optional(),
    weightKg: z.number().positive().optional(),
    notes: z.string().max(500).optional(),
  })).min(1),
  cartaItems: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
    notes: z.string().max(500).optional(),
  })).optional(),
});

export const updateOrderInputSchema = z.object({
  customerName: z.string().min(1).max(100).optional().transform((v) => v ? sanitizeName(v) : v),
  isDelivery: z.boolean().optional(),
  deliveryAddress: z.string().max(500).optional(),
  deliveryPhone: z.string().max(30).optional(),
  notes: z.string().max(1000).optional(),
  isSentToKitchen: z.boolean().optional(),
  paymentMethod: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().positive().optional(),
    weightKg: z.number().positive().optional(),
    notes: z.string().max(500).optional(),
  })).optional(),
  cartaItems: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
    notes: z.string().max(500).optional(),
  })).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type CreateOrderItemInput = z.infer<typeof createOrderItemSchema>;
