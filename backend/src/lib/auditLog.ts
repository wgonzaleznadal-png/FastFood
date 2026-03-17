import { prisma } from "./prisma";
import type { Request } from "express";

interface AuditParams {
  tenantId?: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metadata: (params.metadata as any) ?? undefined,
        ip: params.req?.ip ?? params.req?.socket?.remoteAddress,
        userAgent: params.req?.headers["user-agent"],
      },
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write audit log:", err);
  }
}
