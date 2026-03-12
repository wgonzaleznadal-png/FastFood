import { prisma } from './prisma';

/**
 * Servicio de limpieza automática de datos temporales
 * Elimina mensajes de WhatsApp con más de 24 horas
 */

const CLEANUP_INTERVAL = 1000 * 60 * 60; // 1 hora
const MESSAGE_RETENTION_HOURS = 24;

export function startCleanupService() {
  console.log('[Cleanup Service] Iniciando servicio de limpieza automática...');
  
  // Ejecutar inmediatamente al iniciar
  cleanupOldMessages();
  
  // Luego ejecutar cada hora
  setInterval(cleanupOldMessages, CLEANUP_INTERVAL);
}

async function cleanupOldMessages() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - MESSAGE_RETENTION_HOURS);
    
    const result = await prisma.waMessage.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });
    
    if (result.count > 0) {
      console.log(`[Cleanup Service] ✅ Eliminados ${result.count} mensajes de WhatsApp con más de ${MESSAGE_RETENTION_HOURS}hs`);
    }
  } catch (error) {
    console.error('[Cleanup Service] ❌ Error al limpiar mensajes:', error);
  }
}
