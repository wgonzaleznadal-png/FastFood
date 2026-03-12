import { prisma } from "@/lib/prisma";
import { createError } from "@/middleware/errorHandler";
import { OpenShiftInput, CloseShiftInput, CashExpenseInput, AddCollaboratorInput, CreateCadeteInput, CloseDeliveryInput } from "./shifts.schema";
import { notifyOrderStatusChange } from "../whatsapp/whatsapp.notifications";

export async function openShift(tenantId: string, userId: string, input: OpenShiftInput) {
  const existing = await prisma.shift.findFirst({
    where: { tenantId, openedById: userId, status: "OPEN" },
  });
  if (existing) throw createError("Ya tenés un turno abierto", 409);

  return prisma.shift.create({
    data: {
      tenantId,
      openedById: userId,
      initialCash: input.initialCash,
      notes: input.notes,
      status: "OPEN",
    },
    include: { openedBy: { select: { id: true, name: true, role: true } } },
  });
}

// backend/src/modules/shifts/shifts.service.ts

// backend/src/modules/shifts/shifts.service.ts

export async function closeShift(
  tenantId: string,
  userId: string,
  shiftId: string,
  input: CloseShiftInput,
  role: string
) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId, status: "OPEN" },
  });
  if (!shift) throw createError("Turno no encontrado", 404);

  // 1. Venta TOTAL (Para la estadística - solo pedidos PAGADOS)
  const allKgOrders = await prisma.order.aggregate({
    where: { shiftId, isPaid: true },
    _sum: { totalPrice: true },
  });

  // 2. Solo EFECTIVO (Lo que el cajero DEBE tener en la mano)
  const cashKgOrders = await prisma.order.aggregate({
    where: { 
      shiftId, 
      isPaid: true,
      paymentMethod: "EFECTIVO"
    },
    _sum: { totalPrice: true },
  });

  const cashExpensesAgg = await prisma.expense.aggregate({
    where: { shiftId, type: "CASH" },
    _sum: { amount: true },
  });

  // CORRECCIÓN: Usamos totalPrice y manejamos Decimal de Prisma
  const totalSales = Number(allKgOrders._sum.totalPrice ?? 0);
  const totalCashSales = Number(cashKgOrders._sum.totalPrice ?? 0);
  const expensesTotal = Number(cashExpensesAgg._sum.amount ?? 0);

  // Obtener rendición de delivery si existe
  const deliverySettlement = Number(shift.deliverySettlementAmount ?? 0);
  
  // EL CÁLCULO REAL DEL CAJÓN:
  // Caja Inicial + Ventas Efectivo - Gastos + Rendición Delivery
  const expectedPhysicalCash = Number(shift.initialCash) + totalCashSales - expensesTotal + deliverySettlement;
  
  // DIFERENCIA FÍSICA: Lo que el cajero contó vs lo que debería haber
  const difference = input.finalCash - expectedPhysicalCash;

  // Eliminar cadetes del turno
  await prisma.cadete.deleteMany({
    where: { tenantId }
  });
  
  return prisma.shift.update({
    where: { id: shiftId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      finalCash: input.finalCash,
      expectedCash: expectedPhysicalCash,
      difference: difference,
      notes: input.notes,
    },
  });
}

export async function getMyActiveShift(tenantId: string, userId: string) {
  // First check if user owns a shift
  let shift = await prisma.shift.findFirst({
    where: { tenantId, openedById: userId, status: "OPEN" },
    include: {
      openedBy: { select: { id: true, name: true, role: true } },
      collaborators: { include: { user: { select: { id: true, name: true, role: true } } } },
      _count: { select: { orders: true } },
    },
  });

  // If not owner, check if collaborator on any open shift
  if (!shift) {
    const collab = await prisma.shiftCollaborator.findFirst({
      where: { tenantId, userId, shift: { status: "OPEN" } },
      include: {
        shift: {
          include: {
            openedBy: { select: { id: true, name: true, role: true } },
            collaborators: { include: { user: { select: { id: true, name: true, role: true } } } },
            _count: { select: { orders: true } },
          },
        },
      },
    });
    if (collab) shift = collab.shift;
  }

  return shift;
}

export async function getShiftSummary(tenantId: string, shiftId: string, userId: string, role: string) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId },
    include: {
      openedBy: { select: { id: true, name: true, role: true } },
      orders: {
        where: { isPaid: true },
        select: { id: true, totalPrice: true, createdAt: true, status: true, isPaid: true },
      },
    },
  });

  if (!shift) throw createError("Turno no encontrado", 404);

  // Cashiers can only see their own shifts
  if (role === "CASHIER" && shift.openedById !== userId) {
    throw createError("No tenés acceso a este turno", 403);
  }

  return shift;
}

// OWNER/MANAGER only — list all shifts for the tenant
export async function listShifts(
  tenantId: string,
  filters: { status?: string; from?: string; to?: string }
) {
  return prisma.shift.findMany({
    where: {
      tenantId,
      ...(filters.status ? { status: filters.status as "OPEN" | "CLOSED" } : {}),
      ...(filters.from || filters.to
        ? {
            openedAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    },
    include: {
      openedBy: { select: { id: true, name: true, role: true } },
      _count: { select: { orders: true } },
    },
    orderBy: { openedAt: "desc" },
  });
}

// ─── SHIFT SUMMARY ───────────────────────────────────────────────────────────

export async function getShiftDetailedSummary(tenantId: string, shiftId: string, userId: string, role: string) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId },
    include: { openedBy: { select: { id: true, name: true, role: true } } },
  });

  if (!shift) throw createError("Turno no encontrado", 404);
  if (role === "CASHIER" && shift.openedById !== userId) throw createError("No tenés acceso", 403);

  // 1. Traemos TODOS los pedidos cobrados (READY) o entregados por cadete (DELIVERED)
  const kgOrders = await prisma.order.findMany({
    where: { 
      shiftId, 
      isPaid: true 
    },
    select: { totalPrice: true, paymentMethod: true }
  });

  // 2. Calculamos el Total de Ventas Real ($71.000 en tu caso)
  const totalSales = kgOrders.reduce((sum, o) => sum + Number(o.totalPrice), 0);

  // 3. AGRUPACIÓN REAL: Sumamos lo que dice la DB para cada método
  const methodsMap = kgOrders.reduce((acc, o) => {
    const method = o.paymentMethod || 'EFECTIVO';
    acc[method] = (acc[method] || 0) + Number(o.totalPrice);
    return acc;
  }, {} as Record<string, number>);

  const paymentMethods = Object.entries(methodsMap).map(([name, amount]) => ({
    id: name.toLowerCase().replace(/\s+/g, '_'),
    name: name,
    amount
  }));

  const cashExpensesAgg = await prisma.expense.aggregate({
    where: { shiftId, type: "CASH" },
    _sum: { amount: true },
  });

  return {
    shift: {
      ...shift,
      initialCash: shift.initialCash.toString(),
      finalCash: shift.finalCash?.toString(),
      expectedCash: shift.expectedCash?.toString(),
      difference: shift.difference?.toString(),
    },
    totalSales,
    totalExpenses: Number(cashExpensesAgg._sum.amount ?? 0),
    paymentMethods,
  };
}

// ─── CASH EXPENSES ───────────────────────────────────────────────────────────

export async function createCashExpense(
  tenantId: string,
  userId: string,
  input: CashExpenseInput
) {
  const shift = await prisma.shift.findFirst({
    where: { id: input.shiftId, tenantId, status: "OPEN" },
  });
  if (!shift) throw createError("Turno no encontrado o cerrado", 404);

  return prisma.expense.create({
    data: {
      tenantId,
      shiftId: input.shiftId,
      userId,
      type: "CASH",
      description: input.description,
      amount: input.amount,
      notes: input.notes,
    },
  });
}

export async function listCashExpenses(tenantId: string, shiftId: string) {
  return prisma.expense.findMany({
    where: { tenantId, shiftId, type: "CASH" },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteCashExpense(
  tenantId: string,
  userId: string,
  expenseId: string,
  role: string
) {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, tenantId, type: "CASH" },
    include: { shift: true },
  });
  if (!expense) throw createError("Egreso no encontrado", 404);

  if (role === "CASHIER" && expense.shift && expense.shift.openedById !== userId) {
    throw createError("No tenés permiso para eliminar este egreso", 403);
  }

  await prisma.expense.delete({ where: { id: expenseId } });
}

// ─── SHIFT COLLABORATORS ────────────────────────────────────────────────────

export async function addCollaborator(
  tenantId: string,
  ownerId: string,
  shiftId: string,
  input: AddCollaboratorInput
) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId, status: "OPEN" },
  });
  if (!shift) throw createError("Turno no encontrado o cerrado", 404);
  if (shift.openedById !== ownerId) {
    throw createError("Solo el cajero principal puede agregar colaboradores", 403);
  }

  const user = await prisma.user.findFirst({
    where: { id: input.userId, tenantId, isActive: true },
  });
  if (!user) throw createError("Usuario no encontrado", 404);
  if (user.id === ownerId) throw createError("No podés agregarte a vos mismo", 400);

  return prisma.shiftCollaborator.create({
    data: { tenantId, shiftId, userId: input.userId },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
}

export async function removeCollaborator(
  tenantId: string,
  ownerId: string,
  shiftId: string,
  userId: string
) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId, status: "OPEN" },
  });
  if (!shift) throw createError("Turno no encontrado o cerrado", 404);
  if (shift.openedById !== ownerId) {
    throw createError("Solo el cajero principal puede quitar colaboradores", 403);
  }

  const collab = await prisma.shiftCollaborator.findUnique({
    where: { shiftId_userId: { shiftId, userId } },
  });
  if (!collab) throw createError("Colaborador no encontrado", 404);

  await prisma.shiftCollaborator.delete({ where: { id: collab.id } });
}

export async function listCollaborators(tenantId: string, shiftId: string) {
  return prisma.shiftCollaborator.findMany({
    where: { tenantId, shiftId },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { addedAt: "asc" },
  });
}

// ─── CADETES ────────────────────────────────────────────────────────────────

export async function createCadete(tenantId: string, input: CreateCadeteInput) {
  return prisma.cadete.create({
    data: { tenantId, name: input.name, phone: input.phone },
  });
}

export async function listCadetes(tenantId: string) {
  return prisma.cadete.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function deleteCadete(tenantId: string, id: string) {
  const existing = await prisma.cadete.findFirst({ where: { id, tenantId } });
  if (!existing) throw createError("Cadete no encontrado", 404);
  await prisma.cadete.update({ where: { id }, data: { isActive: false } });
}

// ─── DELIVERY OPERATIONS ────────────────────────────────────────────────────

export async function assignCadete(tenantId: string, orderId: string, cadeteId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, tenantId } });
  if (!order) throw createError("Pedido no encontrado", 404);

  const cadete = await prisma.cadete.findFirst({ where: { id: cadeteId, tenantId, isActive: true } });
  if (!cadete) throw createError("Cadete no encontrado", 404);

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { 
      cadeteId, 
      // EL BLINDAJE: Si ya estaba PAGADO, no lo toques. Si no, pasalo a PESADO porque ya está en viaje.
      status: order.status === "READY" ? "READY" : "IN_PROGRESS" 
    },
    include: {
      cadete: true,
      items: { include: { product: { select: { id: true, name: true, pricePerKg: true } } } },
    },
  });

  // 🎯 Notificación automática: "Tu pedido fue asignado a nuestro repartidor"
  // Luego de 5 minutos: "Tu pedido ya salió! Llegará en 10-15 min"
  notifyOrderStatusChange(orderId, "ASSIGNED_TO_CADETE", tenantId).catch(err => {
    console.error("[Shifts Service] Error enviando notificación de asignación:", err);
  });

  return updatedOrder;
}

export async function renderCadeteOrder(tenantId: string, orderId: string, cadetePaidAmount: number) {
  const order = await prisma.order.findFirst({ where: { id: orderId, tenantId } });
  if (!order) throw createError("Pedido no encontrado", 404);

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { 
      status: "DELIVERED",
      cadetePaidAmount,
      // Si el cadete cobró en efectivo, marcar como pagado
      isPaid: cadetePaidAmount > 0,
      paidAt: cadetePaidAmount > 0 ? new Date() : undefined,
      paymentMethod: cadetePaidAmount > 0 ? "EFECTIVO" : order.paymentMethod,
    },
    include: {
      cadete: true,
      items: { include: { product: { select: { id: true, name: true, pricePerKg: true } } } },
    },
  });

  // Notificar al cliente que su pedido fue entregado
  notifyOrderStatusChange(orderId, "DELIVERED", tenantId).catch(err => {
    console.error("[Shifts Service] Error enviando notificación de entrega:", err);
  });

  return updatedOrder;
}

export async function getCadeteSummary(tenantId: string, shiftId: string, cadeteId: string) {
  const orders = await prisma.order.findMany({
    where: { tenantId, shiftId, cadeteId },
    include: {
      items: { include: { product: { select: { id: true, name: true, pricePerKg: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const pending = orders.filter(
    (o) => o.paymentMethod === "EFECTIVO" && !o.isPaid && o.status !== "CANCELLED"
  );
  const delivered = orders.filter(
    (o) => o.isPaid || o.status === "DELIVERED" || o.paymentMethod !== "EFECTIVO"
  );
  
  // FIX CRÍTICO: Calcular deuda solo de pedidos en efectivo NO pagados
  const totalDebt = orders
    .filter(o => 
      o.paymentMethod === 'EFECTIVO' && 
      !o.isPaid && 
      o.status !== 'CANCELLED'
    )
    .reduce((sum, o) => sum + Number(o.totalPrice), 0);

  return {
    orders: orders.map((o) => ({
      ...o,
      totalPrice: o.totalPrice.toString(),
      cadetePaidAmount: o.cadetePaidAmount.toString(),
    })),
    pendingOrders: pending.map((o) => ({
      ...o,
      totalPrice: o.totalPrice.toString(),
      cadetePaidAmount: o.cadetePaidAmount.toString(),
    })),
    deliveredOrders: delivered.map((o) => ({
      ...o,
      totalPrice: o.totalPrice.toString(),
      cadetePaidAmount: o.cadetePaidAmount.toString(),
    })),
    totalDebt,
  };
}

export async function getDeliveryOrders(tenantId: string, shiftId: string) {
  const orders = await prisma.order.findMany({
    where: { tenantId, shiftId, isDelivery: true },
    include: {
      cadete: true,
      items: { include: { product: { select: { id: true, name: true, pricePerKg: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((o) => ({
    ...o,
    totalPrice: o.totalPrice.toString(),
    cadetePaidAmount: o.cadetePaidAmount.toString(),
    totalAmount: o.totalPrice.toString(),
    items: o.items.map((item) => ({
      ...item,
      weightKg: item.quantity.toString(),
      quantity: item.quantity.toString(),
      subtotal: item.subtotal.toString(),
    })),
  }));
}

export async function updateOrderCoords(tenantId: string, orderId: string, lat: number, lng: number) {
  const order = await prisma.order.findFirst({ where: { id: orderId, tenantId } });
  if (!order) throw createError("Pedido no encontrado", 404);
  return prisma.order.update({ where: { id: orderId }, data: { deliveryLat: lat, deliveryLng: lng } });
}

export async function closeDeliverySettlement(tenantId: string, shiftId: string, input: CloseDeliveryInput) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId, status: "OPEN" },
  });
  if (!shift) throw createError("Turno no encontrado", 404);
  
  // Calcular total de delivery en efectivo
  const deliveryOrders = await prisma.order.findMany({
    where: {
      shiftId,
      isDelivery: true,
      isPaid: true,
      paymentMethod: "EFECTIVO",
    },
    include: {
      cadete: true,
      items: { include: { product: true } },
    },
  });
  
  const totalDeliveryCash = deliveryOrders.reduce((sum, order) => sum + Number(order.totalPrice), 0);
  
  // Actualizar shift con rendición
  const updatedShift = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      deliverySettlementAmount: input.receivedAmount,
      deliverySettlementBy: input.deliveryPersonName,
      deliverySettlementAt: new Date(),
    },
  });
  
  return {
    shift: updatedShift,
    deliveryOrders,
    totalDeliveryCash,
    receivedAmount: input.receivedAmount,
    difference: input.receivedAmount - totalDeliveryCash,
  };
}
