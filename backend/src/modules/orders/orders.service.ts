import { prisma } from '../../lib/prisma';
import { createError } from '../../middleware/errorHandler';
import type { Prisma } from '@prisma/client';

// ─── UTILIDAD HÍBRIDA ────────────────────────────────────────────────────────
// ─── UTILIDAD HÍBRIDA ────────────────────────────────────────────────────────
function formatHybridOrder(order: any) {
  if (!order) return order;
  
  // Detectar adiciones comparando items actuales con lastPrintedItems
  let isAddition = false;
  let addedItems: any[] = [];
  let previousItems: any[] = [];
  
  if (order.lastPrintedItems && Array.isArray(order.lastPrintedItems)) {
    const lastPrinted = order.lastPrintedItems as any[];
    const currentItems = order.items || [];
    
    // Comparar items actuales con los últimos impresos
    currentItems.forEach((current: any) => {
      const previous = lastPrinted.find((p: any) => p.productId === current.productId);
      
      // FIX: Usamos Number() para asegurar que la matemática no falle
      const currentQty = Number(current.quantity || 0);
      const previousQty = previous ? Number(previous.quantity || 0) : 0;
      
      if (!previous) {
        // Item completamente nuevo
        isAddition = true;
        addedItems.push(current);
      } else if (currentQty > previousQty) {
        // Item con cantidad aumentada
        isAddition = true;
        const delta = currentQty - previousQty;
        addedItems.push({ ...current, quantity: delta });
      }
    });
    
    // Items que ya estaban (Mantenemos la cantidad que se imprimió antes)
    previousItems = lastPrinted.map((p: any) => {
      const item = currentItems.find((c: any) => c.productId === p.productId);
      return item ? { ...item, quantity: Number(p.quantity || 0) } : null;
    }).filter(Boolean);
  }
  
  return {
    ...order,
    // Aseguramos que siempre sean números reales
    totalPrice: Number(order.totalPrice || 0),
    totalAmount: Number(order.totalPrice || 0),
    // FIX CRÍTICO: Incluir paymentMethod e isPaid para que aparezca en re-impresiones
    paymentMethod: order.paymentMethod,
    isPaid: order.isPaid,
    // Datos para tickets híbridos
    isAddition,
    addedItems: isAddition ? addedItems.map((item: any) => ({
      ...item,
      quantity: item.unitType === 'KG' ? 1 : Number(item.quantity || 0),
      weightKg: item.unitType === 'KG' ? Number(item.quantity || 0) : 0,
      productName: item.product?.name || 'Producto',
    })) : undefined,
    previousItems: isAddition ? previousItems.map((item: any) => ({
      ...item,
      quantity: item.unitType === 'KG' ? 1 : Number(item.quantity || 0),
      weightKg: item.unitType === 'KG' ? Number(item.quantity || 0) : 0,
      productName: item.product?.name || 'Producto',
    })) : undefined,
    items: order.items?.map((item: any) => {
      const isKg = item.unitType === 'KG';
      const valor = Number(item.quantity || 0);
      
      return {
        ...item,
        // Rabas (UNIT) mantiene su cantidad, Paella (KG) mantiene su peso
        quantity: isKg ? 1 : valor, 
        weightKg: isKg ? valor : 0, 
        unitPrice: Number(item.unitPrice || 0),
        subtotal: Number(item.subtotal || 0),
      };
    }) || []
  };
}

export const ordersService = {
  async createOrder(tenantId: string, data: any) {
    const shift = await prisma.shift.findFirst({
      where: { id: data.shiftId, tenantId, status: 'OPEN' },
    });

    if (!shift) throw createError('Turno no encontrado', 404);

    // Recopilar TODOS los productIds (items KG + cartaItems)
    const allProductIds = [
      ...data.items.map((i: any) => i.productId),
      ...(data.cartaItems || []).map((i: any) => i.productId),
    ];
    const products = await prisma.product.findMany({ where: { id: { in: allProductIds }, tenantId } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const itemsToCreate = data.items.map((item: any) => {
      const p = productMap.get(item.productId);
      const isKg = p?.unitType === 'KG';
      const qty = Number(item.quantity ?? item.weightKg ?? 1);
      const price = Number(isKg ? p?.pricePerKg : p?.price);
      const subtotal = Math.round(qty * price * 100) / 100;
      
      return {
        productId: item.productId,
        unitType: p?.unitType || 'UNIT',
        destination: p?.destination,
        quantity: qty,
        unitPrice: price,
        subtotal: subtotal,
        notes: item.notes,
      };
    });

    // Procesar cartaItems si vienen
    if (data.cartaItems && data.cartaItems.length > 0) {
      data.cartaItems.forEach((item: any) => {
        const p = productMap.get(item.productId);
        const qty = Number(item.quantity ?? 1);
        const price = Number(p?.price || 0);
        const subtotal = Math.round(qty * price * 100) / 100;
        
        itemsToCreate.push({
          productId: item.productId,
          unitType: p?.unitType || 'UNIT',
          destination: p?.destination,
          quantity: qty,
          unitPrice: price,
          subtotal: subtotal,
          notes: item.notes,
        });
      });
    }

    const totalPrice = itemsToCreate.reduce((sum: number, item: any) => sum + item.subtotal, 0);

    let finalOrderNumber = data.orderNumber;
    if (!finalOrderNumber) {
      const lastOrder = await prisma.order.findFirst({
        where: { tenantId, shiftId: data.shiftId },
        orderBy: { orderNumber: 'desc' },
      });
      finalOrderNumber = (lastOrder?.orderNumber || 0) + 1;
    }

    // Si se envía a kilaje desde la creación, guardar snapshot para tracking de adiciones
    let lastPrintedItems = undefined;
    if (data.isSentToKitchen) {
      lastPrintedItems = itemsToCreate.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitType: item.unitType,
      }));
    }

    const order = await prisma.order.create({
      data: {
        tenantId,
        shiftId: data.shiftId,
        userId: data.userId,
        customerId: data.customerId,
        orderNumber: finalOrderNumber,
        customerName: data.customerName,
        isDelivery: data.isDelivery,
        deliveryAddress: data.deliveryAddress,
        deliveryPhone: data.deliveryPhone,
        paymentMethod: data.paymentMethod,
        isSentToKitchen: data.isSentToKitchen,
        status: data.status || 'PENDING',
        totalPrice,
        source: data.source,
        notes: data.notes,
        lastPrintedItems,
        items: { create: itemsToCreate },
      },
      include: {
        items: { include: { product: true } },
      },
    });

    return formatHybridOrder(order);
  },

  async getOrderById(tenantId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: { include: { product: true } },
        shift: true,
      },
    });
    if (!order) throw createError('Order not found', 404);
    return formatHybridOrder(order);
  },

  async listOrders(tenantId: string, filters?: any) {
    const where: Prisma.OrderWhereInput = { tenantId };
    if (filters?.shiftId) where.shiftId = filters.shiftId;
    if (filters?.status) where.status = filters.status as any;

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(formatHybridOrder);
  },

  async updateOrder(tenantId: string, orderId: string, data: any) {
    const existingOrder = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { items: { include: { product: true } } },
    });
    if (!existingOrder) throw createError('Order not found', 404);

    // 🚩 CLAVE 1: Guardamos el snapshot viejo ANTES de actualizar nada
    const oldSnapshot = existingOrder.lastPrintedItems;

    const updateData: Prisma.OrderUpdateInput = {
      // ... (tus campos de customerName, delivery, etc.)
    };
    
    // Actualizar isSentToKitchen si viene en data
    if (data.isSentToKitchen !== undefined) {
      updateData.isSentToKitchen = data.isSentToKitchen;
    }
    
    // Actualizar customerName, delivery, notes, etc si vienen
    if (data.customerName) updateData.customerName = data.customerName;
    if (data.isDelivery !== undefined) updateData.isDelivery = data.isDelivery;
    if (data.deliveryAddress) updateData.deliveryAddress = data.deliveryAddress;
    if (data.deliveryPhone) updateData.deliveryPhone = data.deliveryPhone;
    if (data.notes !== undefined) updateData.notes = data.notes;

    if (data.items && data.items.length > 0) {
      // Buscar productos en DB para obtener precios reales
      const productIds = data.items.map((i: any) => i.productId);
      const products = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId } });
      const productMap = new Map(products.map((p) => [p.id, p]));
      
      const itemsToCreate = data.items.map((item: any) => {
        const p = productMap.get(item.productId);
        if (!p) throw createError(`Product ${item.productId} not found`, 404);
        
        const isKg = p.unitType === 'KG';
        const qty = Number(item.quantity ?? item.weightKg ?? 1);
        const price = Number(isKg ? p.pricePerKg : p.price);
        const sub = Math.round(price * qty * 100) / 100;
        
        return {
          productId: item.productId,
          unitType: p.unitType as any,
          quantity: qty,
          unitPrice: price,
          destination: p.destination,
          subtotal: sub,
          notes: item.notes,
        };
      });
      
      updateData.totalPrice = itemsToCreate.reduce((sum: number, item: any) => sum + item.subtotal, 0);
      
      // 🚩 CLAVE 2: Si se envía a cocina, preparamos el NUEVO snapshot 
      // pero el cálculo de adición usará el viejo.
      if (data.isSentToKitchen) {
        const printedSnapshot = itemsToCreate.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitType: item.unitType,
        }));
        updateData.lastPrintedItems = printedSnapshot;
      }
      
      await prisma.orderItem.deleteMany({ where: { orderId } });
      updateData.items = { create: itemsToCreate };
    }
    
    // Procesar cartaItems si vienen
    if (data.cartaItems && data.cartaItems.length > 0) {
      const productIds = data.cartaItems.map((i: any) => i.productId);
      const products = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId } });
      const productMap = new Map(products.map((p) => [p.id, p]));
      
      const cartaItemsToCreate = data.cartaItems.map((item: any) => {
        const p = productMap.get(item.productId);
        if (!p) throw createError(`Product ${item.productId} not found`, 404);
        
        const qty = Number(item.quantity ?? 1);
        const price = Number(p.price);
        const sub = Math.round(price * qty * 100) / 100;
        
        return {
          productId: item.productId,
          unitType: p.unitType as any,
          quantity: qty,
          unitPrice: price,
          destination: p.destination,
          subtotal: sub,
          notes: item.notes,
        };
      });
      
      // Si ya hay items de KG, agregar los de carta
      if (updateData.items && 'create' in updateData.items) {
        const existingItems = updateData.items.create as any[];
        updateData.items = { create: [...existingItems, ...cartaItemsToCreate] };
      } else {
        await prisma.orderItem.deleteMany({ where: { orderId } });
        updateData.items = { create: cartaItemsToCreate };
      }
      
      // Recalcular total
      const allItems = updateData.items.create as any[];
      updateData.totalPrice = allItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
    }

    // Track si realmente se actualizaron items
    const itemsWereUpdated = !!(data.items?.length > 0 || data.cartaItems?.length > 0);

    // Actualizamos
    await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });
    
    const fullOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });
    
    // 🚩 CLAVE 3: Solo inyectar el snapshot VIEJO cuando se actualizaron items.
    // Si no se actualizaron items (ej: re-impresión que solo actualiza notes),
    // devolver el pedido con su lastPrintedItems actual → no hay falsa adición.
    if (itemsWereUpdated) {
      return formatHybridOrder({ ...fullOrder, lastPrintedItems: oldSnapshot });
    }
    return formatHybridOrder(fullOrder);
},

  async deleteOrder(tenantId: string, orderId: string) {
    await prisma.order.delete({ where: { id: orderId } });
    return { success: true };
  },

  async sendToKitchen(tenantId: string, orderId: string) {
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { isSentToKitchen: true },
      include: { items: { include: { product: true } } },
    });
    return formatHybridOrder(updated);
  },

  async updateStatus(tenantId: string, orderId: string, status: string, paymentMethod?: string, orderData?: any) {
    const updateData: any = {};
    
    // Si viene status, actualizamos el estado de ENTREGA
    if (status) {
      updateData.status = status as any;
    }
    
    // Si vienen datos del pedido (customerName, items), actualizamos también
    if (orderData) {
      if (orderData.customerName) updateData.customerName = orderData.customerName;
      if (orderData.isDelivery !== undefined) updateData.isDelivery = orderData.isDelivery;
      if (orderData.deliveryAddress) updateData.deliveryAddress = orderData.deliveryAddress;
      if (orderData.deliveryPhone) updateData.deliveryPhone = orderData.deliveryPhone;
      if (orderData.isSentToKitchen !== undefined) updateData.isSentToKitchen = orderData.isSentToKitchen;
      
      // Manejar isPaid
      if (orderData.isPaid !== undefined) {
        updateData.isPaid = orderData.isPaid;
        if (orderData.isPaid) {
          updateData.paidAt = new Date();
        } else {
          // Reverting payment (cancellation of paid order)
          updateData.paidAt = null;
        }
      }
      
      // Guardar nota de cancelación
      if (orderData.cancellationNote) {
        const existing = await prisma.order.findFirst({ where: { id: orderId, tenantId }, select: { notes: true } });
        const currentNotes = existing?.notes || "";
        updateData.notes = `${currentNotes}\n[CANCELADO ${new Date().toLocaleTimeString()}] ${orderData.cancellationNote}`;
      }
    }
    
    // Si viene paymentMethod, marcamos como PAGADO (esto sobrescribe lo anterior)
    if (paymentMethod) {
      updateData.paymentMethod = paymentMethod;
      updateData.isPaid = true;
      updateData.paidAt = new Date();
    }
    
    // Continuar con items si vienen
    if (orderData) {
      
      // Si vienen items, actualizamos
      if (orderData.items && orderData.items.length > 0) {
        const productIds = orderData.items.map((i: any) => i.productId);
        const products = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId } });
        const productMap = new Map(products.map((p) => [p.id, p]));
        
        const itemsToCreate = orderData.items.map((item: any) => {
          const p = productMap.get(item.productId);
          const isKg = p?.unitType === 'KG';
          const qty = Number(item.quantity ?? item.weightKg ?? 1);
          const price = Number(isKg ? p?.pricePerKg : p?.price);
          
          return {
            productId: item.productId,
            unitType: p?.unitType || 'UNIT',
            quantity: qty,
            unitPrice: price,
            subtotal: Math.round(qty * price * 100) / 100,
            notes: item.notes,
          };
        });
        
        updateData.totalPrice = itemsToCreate.reduce((sum: number, item: any) => sum + item.subtotal, 0);
        await prisma.orderItem.deleteMany({ where: { orderId } });
        updateData.items = { create: itemsToCreate };
      }
    }
    
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: { items: { include: { product: true } } },
    });
    return formatHybridOrder(updated);
  },

  async assignCadete(tenantId: string, orderId: string, cadeteId: string) {
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { cadeteId },
      include: { items: { include: { product: true } } },
    });
    return formatHybridOrder(updated);
  },

  async updateCoords(tenantId: string, orderId: string, lat: number, lng: number) {
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { deliveryLat: lat, deliveryLng: lng },
      include: { items: { include: { product: true } } }
    });
    return formatHybridOrder(updated);
  },

  async getNextOrderNumber(tenantId: string, shiftId: string): Promise<number> {
    const lastOrder = await prisma.order.findFirst({
      where: { tenantId, shiftId },
      orderBy: { orderNumber: 'desc' },
    });
    return (lastOrder?.orderNumber || 0) + 1;
  },


 // --- REEMPLAZAR DESDE ACÁ HASTA EL FINAL ---

  async getKitchenOrders(tenantId: string, station: string) {
    const activeShift = await prisma.shift.findFirst({
      where: { tenantId, status: 'OPEN' }
    });
    if (!activeShift) return [];

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        shiftId: activeShift.id,
        status: { in: ['PENDING', 'IN_PROGRESS', 'READY'] },
        // REGLA DE ORO: Solo pedidos que tengan ALGO de Carta (No kilos) para esta estación
        items: { 
          some: { 
            unitType: { not: 'KG' },
            product: { destination: station as any } 
          } 
        }
      },
      include: {
        items: { 
          include: { product: true },
          // REGLA DE ORO: La cocina solo ve los items de Carta, la Paella se filtra acá
          where: {
            unitType: { not: 'KG' },
            product: { destination: station as any }
          }
        },
        shift: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return orders.map(formatHybridOrder);
  },

  async getKitchenProductKilos(tenantId: string) {
    const activeShift = await prisma.shift.findFirst({
      where: { tenantId, status: 'OPEN' }
    });
    if (!activeShift) return [];

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        shiftId: activeShift.id,
        status: { not: 'CANCELLED' } 
      },
      include: { items: { include: { product: true } } }
    });

    const kilosMap: Record<string, { name: string; totalKg: number }> = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.product && item.unitType === 'KG') {
          let name = item.product.name;
          if (name.toLowerCase().includes('paella')) {
            name = 'Paella';
          }
          if (!kilosMap[name]) {
            kilosMap[name] = { name, totalKg: 0 };
          }
          
          // CORRECCIÓN: En la DB cruda, el peso está en 'quantity'
          // No existe 'weightKg' en el modelo de Prisma
          const weight = Number(item.quantity || 0); 
          kilosMap[name].totalKg += weight;
        }
      });
    });

    return Object.values(kilosMap).sort((a, b) => b.totalKg - a.totalKg);
  },

  async getKitchenStats(tenantId: string) {
    const activeShift = await prisma.shift.findFirst({
      where: { tenantId, status: 'OPEN' }
    });
    if (!activeShift) return { pending: 0, inProgress: 0, ready: 0, total: 0 };

    // LAS BURBUJAS DE STATS: Solo cuentan comandas de Carta, ignoran los pedidos que son 100% Kilo
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        shiftId: activeShift.id,
        status: { in: ['PENDING', 'IN_PROGRESS', 'READY'] },
        items: { some: { unitType: { not: 'KG' } } }
      }
    });

    return {
      pending: orders.filter(o => o.status === 'PENDING').length,
      inProgress: orders.filter(o => o.status === 'IN_PROGRESS').length,
      ready: orders.filter(o => o.status === 'READY').length,
      total: orders.length
    };
  }
};