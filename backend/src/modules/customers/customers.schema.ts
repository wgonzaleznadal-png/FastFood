import { z } from 'zod';

// ─── SCHEMAS DE VALIDACIÓN ───────────────────────────────────────────────────

export const createCustomerSchema = z.object({
  phone: z.string().min(8, 'Teléfono debe tener al menos 8 dígitos'),
  name: z.string().optional(),
  email: z.string().email('Email inválido').optional(),
  notes: z.string().optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Email inválido').optional(),
  notes: z.string().optional(),
});

export const createAddressSchema = z.object({
  customerId: z.string().cuid(),
  street: z.string().min(5, 'Dirección debe tener al menos 5 caracteres'),
  reference: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = z.object({
  street: z.string().min(5).optional(),
  reference: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().optional(),
});

export const createTagSchema = z.object({
  customerId: z.string().cuid(),
  tag: z.string().min(1),
  value: z.string().optional(),
});

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
