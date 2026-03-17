import { prisma } from './prisma';

/**
 * Servicio de limpieza automática de datos temporales
 * Elimina mensajes de WhatsApp con más de 24 horas
 */

const CLEANUP_INTERVAL = 1000 * 60 * 60; // 1 hora
const MESSAGE_RETENTION_HOURS = 24;

export function startCleanupService() {
  console.log('[Cleanup Service] Iniciando servicio de limpieza automática...');
  
  // Retrasar la primera ejecución para evitar crash al arranque (bus error con Prisma)
  setTimeout(() => {
    cleanupOldMessages().catch((e) => console.error('[Cleanup] Error:', e));
  }, 5000);
  
  // Luego ejecutar cada hora
  setInterval(() => cleanupOldMessages().catch((e) => console.error('[Cleanup] Error:', e)), CLEANUP_INTERVAL);
}

async function cleanupOldMessages(): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - MESSAGE_RETENTION_HOURS);

    // Cross-tenant cleanup is intentional: WhatsApp message retention policy
    // applies globally. All messages older than 24h are removed regardless of tenant.
    const result = await prisma.waMessage.deleteMany({
      where: { timestamp: { lt: cutoffDate } },
    });

    if (result.count > 0) {
      console.log(`[Cleanup Service] ✅ Eliminados ${result.count} mensajes de WhatsApp`);
    }
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === "P2021") return; // Tabla no existe
    console.error("[Cleanup Service] ❌ Error:", error);
  }
}
