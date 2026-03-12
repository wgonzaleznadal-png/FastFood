import { prisma } from "@/lib/prisma";
import { sendMessage } from "./whatsapp.service";

/**
 * Sistema de notificaciones automáticas por WhatsApp
 * Se dispara cuando cambia el estado de un pedido
 */

// Delay de 5 minutos para simular que el pedido "salió"
const DELIVERY_DELAY_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Notifica al cliente cuando su pedido cambia de estado
 */
export async function notifyOrderStatusChange(
  orderId: string,
  newStatus: string,
  tenantId: string
): Promise<void> {
  try {
    // Buscar el pedido con sus items
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order || !order.waJid) {
      // No es un pedido de WhatsApp, no enviar notificación
      return;
    }

    const jid = order.waJid;
    let message = "";

    switch (newStatus) {
      case "SENT_TO_KITCHEN":
        message = `¡Hola ${order.customerName}! 👨‍🍳 Tu pedido #${order.orderNumber} ya está en la cocina. Lo estamos preparando con mucho cariño. 🍽️`;
        await sendMessage(tenantId, jid, message);
        break;

      case "READY":
        if (order.isDelivery) {
          message = `¡${order.customerName}! 🎉 Tu pedido #${order.orderNumber} está listo y lo estamos empaquetando para el envío. En breve sale para tu domicilio. 📦`;
        } else {
          message = `¡${order.customerName}! 🎉 Tu pedido #${order.orderNumber} está listo para retirar. Te esperamos en el local. 🏪`;
        }
        await sendMessage(tenantId, jid, message);
        break;

      case "ASSIGNED_TO_CADETE":
        // Aquí viene el "truco" 😉
        // Enviamos el mensaje inmediatamente
        message = `¡${order.customerName}! 🚴 Tu pedido #${order.orderNumber} fue asignado a nuestro repartidor.`;
        await sendMessage(tenantId, jid, message);

        // Pero el mensaje de "en camino" lo enviamos 5 minutos después
        setTimeout(async () => {
          const delayedMessage = `🚀 ¡Tu pedido ya salió! Estimamos que llegará en 10-15 minutos a ${order.deliveryAddress}. ¡Gracias por tu paciencia! 😊`;
          await sendMessage(tenantId, jid, delayedMessage);
        }, DELIVERY_DELAY_MS);
        break;

      case "DELIVERED":
        message = `¡Gracias ${order.customerName}! 🙌 Confirmamos que recibiste tu pedido #${order.orderNumber}. ¡Esperamos que lo disfrutes! 🍽️ Nos encantaría verte de nuevo pronto. 😊`;
        await sendMessage(tenantId, jid, message);
        break;

      case "CANCELLED":
        message = `Hola ${order.customerName}, lamentamos informarte que tu pedido #${order.orderNumber} fue cancelado. Si tenés alguna consulta, no dudes en escribirnos. 😔`;
        await sendMessage(tenantId, jid, message);
        break;

      default:
        // No enviar notificación para otros estados
        break;
    }
  } catch (error) {
    console.error("[WhatsApp Notifications] Error enviando notificación:", error);
    // No lanzar error para no romper el flujo principal
  }
}

/**
 * Notifica al cliente cuando se cobra su pedido (para pedidos con MP)
 */
export async function notifyPaymentReceived(
  orderId: string,
  tenantId: string,
  paymentMethod: string
): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || !order.waJid) return;

    if (paymentMethod === "MERCADOPAGO") {
      const message = `¡Hola ${order.customerName}! ✅ Confirmamos que recibimos tu pago por Mercado Pago. Tu pedido #${order.orderNumber} ya está siendo preparado. 🚀`;
      await sendMessage(tenantId, order.waJid, message);
    }
  } catch (error) {
    console.error("[WhatsApp Notifications] Error enviando notificación de pago:", error);
  }
}
