import { z } from "zod";

export const loginSchema = z.object({
  tenantSlug: z.string().min(1),
  password: z.string().min(6),
});

export const registerTenantSchema = z.object({
  tenantName: z.string().min(2),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers and hyphens"),
  ownerName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterTenantInput = z.infer<typeof registerTenantSchema>;
