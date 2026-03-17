import { prisma } from "@/lib/prisma";
import { createError } from "@/middleware/errorHandler";
import { logAudit } from "@/lib/auditLog";
import type { CreateKgOrderInput } from "./menu.schema";
// import { notifyOrderStatusChange } from "../whatsapp/whatsapp.notifications";

// ─── UTILIDAD PARA CALCULAR ADICIONES ───────────────────────────────────────
function formatOrderWithAdditions(order: any, oldSnapshot: any) {
  let isAddition = false;
  let addedItems: any[] = [];
  let previousItems: any[] = [];
  
  if (oldSnapshot && Array.isArray(oldSnapshot) && oldSnapshot.length > 0) {
    const lastPrintedMap = new Map(oldSnapshot.map((item: any) => [item.productId, item]));
    const currentItems = order.items || [];
    
    // Detectar items nuevos o con cantidades aumentadas
    currentItems.forEach((current: any) => {
      const previous = lastPrintedMap.get(current.productId);
      const currentQty = Number(current.quantity || 0);
      const previousQty = previous ? Number(previous.quantity || 0) : 0;
      
      if (!previous) {
        // Item completamente nuevo
        isAddition = true;
        addedItems.push(current);
      } else if (currentQty > previousQty) {
        // Item con cantidad aumentada - solo la diferencia
        isAddition = true;
        const delta = currentQty - previousQty;
        addedItems.push({ ...current, quantity: delta });
      }
    });
    
    // Items que ya estaban (con la cantidad original)
    previousItems = oldSnapshot.map((p: any) => {
      const item = currentItems.find((c: any) => c.productId === p.productId);
      return item ? { ...item, quantity: Number(p.quantity || 0) } : null;
    }).filter(Boolean);
  }
  
  return {
    ...order,
    totalAmount: order.totalPrice.toString(),
    isAddition,
    addedItems: addedItems.map((item: any) => ({
      productId: item.productId,
      productName: item.product?.name || 'Producto',
      quantity: item.unitType === 'KG' ? undefined : Number(item.quantity || 0),
      weightKg: item.unitType === 'KG' ? Number(item.quantity || 0) : undefined,
      unitType: item.unitType,
      notes: item.notes,
    })),
    previousItems: previousItems.map((item: any) => ({
      productId: item.productId,
      productName: item.product?.name || 'Producto',
      quantity: item.unitType === 'KG' ? undefined : Number(item.quantity || 0),
      weightKg: item.unitType === 'KG' ? Number(item.quantity || 0) : undefined,
      unitType: item.unitType,
    })),
    items: order.items.map((item: any) => ({
      ...item,
      quantity: item.quantity.toString(),
      weightKg: item.quantity.toString(),
      pricePerKg: item.unitPrice.toString(),
      subtotal: item.subtotal.toString(),
    })),
  };
}

// ─── ORDERS (UNIFICADO: KG + CARTA) ──────────────────────────────────────────

export async function listKgOrders(tenantId: string, userId: string, role: string, shiftId?: string) {
  let shiftFilter: object = {};
  if (role === "CASHIER") {
    let activeShift = await prisma.shift.findFirst({
      where: { tenantId, openedById: userId, status: "OPEN" },
    });
    if (!activeShift) {
      const collab = await prisma.shiftCollaborator.findFirst({
        where: { tenantId, userId, shift: { status: "OPEN" } },
        include: { shift: true },
      });
      if (collab) activeShift = collab.shift;
    }
    if (!activeShift) return [];
    shiftFilter = { shiftId: activeShift.id };
  } else if (shiftId) {
    shiftFilter = { shiftId };
  }

  // FIX: Trae TODOS los pedidos del turno, sin filtrar por unitType.
  const orders = await prisma.order.findMany({
    where: { 
      tenantId, 
      ...shiftFilter,
    },
    include: {
      items: {
        include: { 
          product: { select: { id: true, name: true, pricePerKg: true, price: true, unitType: true, destination: true } } 
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    isDelivery: order.isDelivery,
    deliveryAddress: order.deliveryAddress,
    deliveryPhone: order.deliveryPhone,
    isSentToKitchen: order.isSentToKitchen,
    status: order.status === "PENDING" ? "PENDING" : order.status === "IN_PROGRESS" ? "WEIGHED" : order.status === "READY" ? "PAID" : order.status === "DELIVERED" ? "DELIVERED" : order.status === "CANCELLED" ? "CANCELLED" : "PENDING",
    totalPrice: order.totalPrice.toString(),
    totalAmount: order.totalPrice.toString(),
    notes: order.notes,
    createdAt: order.createdAt,
    source: order.source,
    waJid: order.waJid,
    // FIX: Mapeo híbrido. Soporta campos viejos (weightKg) y nuevos (quantity)
    items: order.items.map((item: any) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity.toString(),
      weightKg: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      pricePerKg: item.unitPrice.toString(),
      subtotal: item.subtotal.toString(),
      unitType: item.unitType,
      destination: item.destination,
      notes: item.notes,
      product: item.product,
    })),
  }));
}

export async function createKgOrder(tenantId: string, userId: string, role: string, input: CreateKgOrderInput) {
  if (input.isDelivery && (!input.deliveryAddress || !input.deliveryPhone)) {
    throw createError("Dirección y teléfono son obligatorios para delivery", 400);
  }

  const shift = await prisma.shift.findFirst({
    where: { id: input.shiftId, tenantId, status: "OPEN" },
  });
  if (!shift) throw createError("Turno no encontrado o cerrado", 404);
  if (role === "CASHIER" && shift.openedById !== userId) {
    const collab = await prisma.shiftCollaborator.findFirst({
      where: { shiftId: input.shiftId, userId },
    });
    if (!collab) {
      throw createError("Solo podés crear pedidos en tu propio turno", 403);
    }
  }

  let totalPrice = 0;
  
  // Procesar items de KG
  const itemsData: any[] = []; // FIX: Tipado explícito para evitar error TS7034
  if (input.items && input.items.length > 0) {
    const productIds = input.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      const price = Number(product.pricePerKg || product.price);
      const subtotal = Math.round(price * item.weightKg * 100) / 100;
      totalPrice += subtotal;
      itemsData.push({
        product: { connect: { id: item.productId } },
        unitType: product.unitType as any,
        quantity: item.weightKg,
        unitPrice: price,
        subtotal,
        destination: product.destination,
        notes: item.notes,
      });
    }
  }

  // Procesar items de CARTA
  const cartaItemsData: any[] = []; // FIX: Tipado explícito
  if (input.cartaItems && input.cartaItems.length > 0) {
    const cartaProductIds = input.cartaItems.map((i) => i.productId);
    const cartaProducts = await prisma.product.findMany({
      where: { id: { in: cartaProductIds }, tenantId },
    });
    const cartaProductMap = new Map(cartaProducts.map((p) => [p.id, p]));

    for (const item of input.cartaItems) {
      const product = cartaProductMap.get(item.productId);
      if (!product) continue;
      const price = Number(product.price || product.pricePerKg);
      const subtotal = Math.round(price * item.quantity * 100) / 100;
      totalPrice += subtotal;
      cartaItemsData.push({
        product: { connect: { id: item.productId } },
        unitType: product.unitType as any,
        quantity: item.quantity,
        unitPrice: price,
        subtotal,
        destination: product.destination,
        notes: item.notes,
      });
    }
  }

  const lastOrder = await prisma.order.findFirst({
    where: { shiftId: input.shiftId },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  const nextOrderNumber = (lastOrder?.orderNumber ?? 0) + 1;

  const allItemsData = [...itemsData, ...cartaItemsData];

  const newOrder = await prisma.order.create({
    data: {
      tenantId,
      shiftId: input.shiftId,
      userId,
      orderNumber: nextOrderNumber,
      customerName: input.customerName,
      isDelivery: input.isDelivery ?? false,
      deliveryAddress: input.deliveryAddress,
      deliveryPhone: input.deliveryPhone,
      status: input.status === "PENDING" ? "PENDING" : input.status === "WEIGHED" ? "IN_PROGRESS" : input.status === "PAID" ? "READY" : input.status === "DELIVERED" ? "DELIVERED" : input.status === "CANCELLED" ? "CANCELLED" : "PENDING",
      isSentToKitchen: input.isSentToKitchen ?? false,
      paymentMethod: input.paymentMethod ?? "EFECTIVO",
      source: input.source ?? "LOCAL",
      waJid: input.waJid,
      totalPrice,
      notes: input.notes,
      items: { create: allItemsData },
    },
    include: {
      items: {
        include: {
          product: { 
            select: { id: true, name: true, pricePerKg: true, price: true, unitType: true, destination: true, section: true } 
          },
        },
      },
    },
  });

  return {
    ...newOrder,
    totalAmount: newOrder.totalPrice.toString(),
    items: newOrder.items.map((item: any) => ({
      ...item,
      quantity: item.quantity.toString(),
      weightKg: item.quantity.toString(),
      pricePerKg: item.unitPrice.toString(),
      subtotal: item.subtotal.toString(),
    })),
  };
}

export async function updateKgOrderStatus(tenantId: string, id: string, status: any, data?: any) {
  const existingOrder = await prisma.order.findFirst({ where: { id, tenantId }, select: { isPaid: true } });
  if (!existingOrder) throw createError("Pedido no encontrado", 404);
  if (existingOrder.isPaid) {
    throw createError("No se puede modificar un pedido que ya fue pagado", 400);
  }
  
  const updatedOrder = await prisma.$transaction(async (tx) => {
    if (data && (data.items || data.cartaItems)) {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      
      let newTotal = 0;
      const itemsToCreate: any[] = [];

      const processItem = async (item: any) => {
        const p = await tx.product.findFirst({ where: { id: item.productId, tenantId } });
        if (!p) return;
        
        const isKg = p.unitType === "KG";
        const qty = Number(item.weightKg ?? item.quantity ?? 1);
        const price = Number(isKg ? p.pricePerKg : p.price);
        
        const sub = Math.round(price * qty * 100) / 100;
        newTotal += sub;
        
        itemsToCreate.push({
          product: { connect: { id: item.productId } },
          unitType: p.unitType as any,
          quantity: qty,
          unitPrice: price,
          destination: p.destination,
          subtotal: sub,
          notes: item.notes,
        });
      };

      if (data.items) {
        for (const item of data.items) await processItem(item);
      }
      if (data.cartaItems) {
        for (const item of data.cartaItems) await processItem(item);
      }

      // Si se marca isSentToKitchen, guardar snapshot y marcar como DELIVERED
      const shouldMarkDelivered = data.isSentToKitchen === true;
      const itemsSnapshot = shouldMarkDelivered ? itemsToCreate.map(item => ({
        productId: item.product.connect.id,
        quantity: item.quantity,
        unitType: item.unitType,
        notes: item.notes
      })) : undefined;
      
      const updateData: any = {
        status: shouldMarkDelivered ? "DELIVERED" : (status === "PENDING" ? "PENDING" : status === "WEIGHED" ? "IN_PROGRESS" : status === "PAID" ? "READY" : status === "DELIVERED" ? "DELIVERED" : status === "CANCELLED" ? "CANCELLED" : "PENDING"),
        customerName: data.customerName,
        isDelivery: data.isDelivery,
        deliveryAddress: data.deliveryAddress,
        deliveryPhone: data.deliveryPhone,
        totalPrice: newTotal,
        lastPrintedItems: itemsSnapshot,
        items: { create: itemsToCreate },
      };
      
      if (data.isSentToKitchen !== undefined) {
        updateData.isSentToKitchen = data.isSentToKitchen;
      }
      
      if (data.paymentMethod !== undefined) {
        updateData.paymentMethod = data.paymentMethod;
      }
      
      const verifyOwnership = await tx.order.findFirst({ where: { id, tenantId } });
      if (!verifyOwnership) throw createError("Pedido no encontrado", 404);
      
      return await tx.order.update({
        where: { id },
        data: updateData,
        include: {
          items: {
            include: { product: { select: { id: true, name: true, pricePerKg: true, price: true, unitType: true } } },
          },
        },
      });
    }

    const verifyOwnership = await tx.order.findFirst({ where: { id, tenantId } });
    if (!verifyOwnership) throw createError("Pedido no encontrado", 404);

    return await tx.order.update({
      where: { id },
      data: { 
        status: status === "PENDING" ? "PENDING" : status === "WEIGHED" ? "IN_PROGRESS" : status === "PAID" ? "READY" : status === "DELIVERED" ? "DELIVERED" : status === "CANCELLED" ? "CANCELLED" : "PENDING",
        paymentMethod: data?.paymentMethod ?? undefined
      },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, pricePerKg: true, price: true, unitType: true } } },
        },
      },
    });
  });

  // notifyOrderStatusChange(id, status, tenantId).catch((err: any) => {
  //   console.error("[Menu Service] Error enviando notificación WhatsApp:", err);
  // });

  return {
    ...updatedOrder,
    totalAmount: updatedOrder.totalPrice.toString(),
    isSentToKitchen: updatedOrder.isSentToKitchen,
    items: updatedOrder.items.map((item: any) => ({
      ...item,
      quantity: item.quantity.toString(),
      weightKg: item.quantity.toString(),
      pricePerKg: item.unitPrice.toString(),
      subtotal: item.subtotal.toString(),
    })),
  };
}

export async function sendToKitchen(tenantId: string, id: string, data?: any) {
  const existingOrder = await prisma.order.findFirst({ 
    where: { id, tenantId }, 
    select: { 
      isPaid: true, 
      lastPrintedItems: true,
      items: { include: { product: true } } 
    } 
  });
  if (!existingOrder) throw createError("Pedido no encontrado", 404);
  if (existingOrder.isPaid) {
    throw createError("No se puede modificar un pedido que ya fue pagado", 400);
  }
  
  // Guardar el snapshot VIEJO antes de cualquier modificación
  const oldSnapshot = existingOrder?.lastPrintedItems || [];
  
  if (!data) {
    // Solo marcar como enviado a cocina sin modificar items
    const currentItems = existingOrder?.items.map(item => ({
      productId: item.productId,
      quantity: Number(item.quantity),
      unitType: item.unitType,
      notes: item.notes
    }));
    
    const updated = await prisma.order.update({
      where: { id },
      data: { 
        isSentToKitchen: true,
        status: "DELIVERED",
        lastPrintedItems: currentItems || []
      },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, pricePerKg: true, price: true, unitType: true } } },
        },
      },
    });
    
    return formatOrderWithAdditions(updated, oldSnapshot);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId: id } });

    let calculatedTotal = 0;
    const itemsToCreate: any[] = []; // FIX: Tipado explícito

    const processItem = async (item: any) => {
      const p = await tx.product.findFirst({ where: { id: item.productId, tenantId } });
      if (!p) return;
      
      const isKg = p.unitType === "KG";
      const qty = Number(item.weightKg ?? item.quantity ?? 1);
      const price = Number(isKg ? p.pricePerKg : p.price);
      
      const subtotal = Math.round(price * qty * 100) / 100;
      calculatedTotal += subtotal;

      itemsToCreate.push({
        product: { connect: { id: item.productId } },
        unitType: p.unitType as any,
        quantity: qty,
        unitPrice: price,
        destination: p.destination,
        subtotal: subtotal,
      });
    };

    if (data.items) {
      for (const item of data.items) await processItem(item);
    }
    if (data.cartaItems) {
      for (const item of data.cartaItems) await processItem(item);
    }

    // Guardar snapshot de items nuevos en lastPrintedItems
    const itemsSnapshot = itemsToCreate.map(item => ({
      productId: item.product.connect.id,
      quantity: item.quantity,
      unitType: item.unitType,
      notes: item.notes
    }));
    
    const verifyOwnership = await tx.order.findFirst({ where: { id, tenantId } });
    if (!verifyOwnership) throw createError("Pedido no encontrado", 404);

    return await tx.order.update({
      where: { id },
      data: {
        customerName: data.customerName,
        isDelivery: data.isDelivery,
        deliveryAddress: data.deliveryAddress,
        deliveryPhone: data.deliveryPhone,
        totalPrice: calculatedTotal,
        isSentToKitchen: true,
        status: "DELIVERED",
        lastPrintedItems: itemsSnapshot,
        notes: data.notes,
        items: {
          create: itemsToCreate,
        },
      },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, pricePerKg: true, price: true, unitType: true } } },
        },
      },
    });
  });

  // Calcular isAddition y addedItems/previousItems usando el snapshot VIEJO
  return formatOrderWithAdditions(updated, oldSnapshot);
}

export async function cancelKgOrder(tenantId: string, userId: string, role: string, id: string, cancellationNote?: string, pin?: string) {
  const order = await prisma.order.findFirst({
    where: { id, tenantId },
    include: { shift: true },
  });
  if (!order) throw createError("Pedido no encontrado", 404);

  // Validar que no esté ya entregado
  if (order.status === "DELIVERED" && order.isPaid) {
    throw createError("No se puede cancelar un pedido ya entregado y pagado", 400);
  }
  
  // Validar permisos
  if (role === "CASHIER" && order.shift.openedById !== userId) {
    throw createError("No tenés permiso para cancelar este pedido", 403);
  }

  // Requerir nota de cancelación
  if (!cancellationNote || cancellationNote.trim().length === 0) {
    throw createError("Debe proporcionar una nota explicando el motivo de la cancelación", 400);
  }

  if (order.isPaid && pin) {
    const { validateAdminPin } = await import("@/modules/config/config.service");
    const valid = await validateAdminPin(tenantId, pin);
    if (!valid) throw createError("PIN de administrador incorrecto", 401);
  } else if (order.isPaid && !pin) {
    throw createError("Se requiere PIN de administrador para cancelar un pedido cobrado", 400);
  }

  await prisma.order.update({
    where: { id },
    data: { 
      status: "CANCELLED",
      notes: cancellationNote,
    },
  });
  logAudit({ tenantId, userId, action: "ORDER_CANCELLED", entity: "order", entityId: id, metadata: { cancellationNote } });
}