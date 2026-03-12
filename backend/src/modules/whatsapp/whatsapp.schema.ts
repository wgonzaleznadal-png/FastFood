import { z } from "zod";

export const sendMessageSchema = z.object({
  jid: z.string().min(1),
  text: z.string().min(1),
});

export const updateSessionSchema = z.object({
  jid: z.string().min(1),
  isPaused: z.boolean().optional(),
  chatState: z.enum(["TALKING", "PENDING", "COMPLETED", "NO_REPLY"]).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
