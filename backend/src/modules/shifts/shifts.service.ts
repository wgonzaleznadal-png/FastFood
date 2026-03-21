import { prisma } from "@/lib/prisma";
import { createError } from "@/middleware/errorHandler";
import { logAudit } from "@/lib/auditLog";
import {
  OpenShiftInput,
  CloseShiftInput,
  CashExpenseInput,
  AddCollaboratorInput,
  CreateCadeteInput,
  CloseDeliveryInput,
  AddInitialCashInput,
  ManualShiftIncomeInput,
} from "./shifts.schema";
import { canonicalPaymentMethod, isCashDrawerPaymentMethod } from "@/lib/paymentMethod";
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

/** Suma efectivo a `initialCash` del turno abierto (más cambio en caja tras la apertura). */
export async function addInitialCashToShift(
  tenantId: string,
  userId: string,
  shiftId: string,
  input: AddInitialCashInput
) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId, status: "OPEN" },
  });
  if (!shift) throw createError("Turno no encontrado o cerrado", 404);

  const noteLine = input.note?.trim();
  const newNotes =
    noteLine != null && noteLine.length > 0
      ? [shift.notes?.trim() || "", `+Cambio en caja: ${input.amount} — ${noteLine}`].filter(Boolean).join("\n")
      : undefined;

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      initialCash: { increment: input.amount },
      ...(newNotes !== undefined ? { notes: newNotes } : {}),
    },
    include: {
      openedBy: { select: { id: true, name: true, role: true } },
      collaborators: { include: { user: { select: { id: true, name: true, role: true } } } },
      _count: { select: { orders: true } },
    },
  });

  void logAudit({
    tenantId,
    userId,
    action: "SHIFT_ADD_INITIAL_CASH",
    entity: "shift",
    entityId: shiftId,
    metadata: { amount: input.amount, note: noteLine ?? null },
  });

  return serializeShiftForJson(updated as Record<string, unknown>);
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
  if (process.env.NODE_ENV === "development") console.log("[closeShift] Starting close for shift:", shiftId);

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId, status: "OPEN" },
  });
  if (!shift) throw createError("Turno no encontrado", 404);

  const paidOrders = await prisma.order.findMany({
    where: { shiftId, isPaid: true },
    select: { totalPrice: true, paymentMethod: true, isDelivery: true },
  });

  // Solo efectivo de LOCAL/retiro (lo que el cajero recibió directamente)
  const localCashSales = paidOrders
    .filter((o) => o.paymentMethod === "EFECTIVO" && !o.isDelivery)
    .reduce((sum, o) => sum + Number(o.totalPrice), 0);

  const cashExpenses = await prisma.expense.findMany({
    where: { shiftId, type: "CASH" },
    select: { amount: true, paymentMethod: true },
  });
  const expensesTotal = cashExpenses
    .filter((e) => isCashDrawerPaymentMethod(e.paymentMethod))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const manualCashIn = await prisma.shiftManualIncome.findMany({
    where: { shiftId, tenantId },
    select: { amount: true, paymentMethod: true },
  });
  const manualCashInTotal = manualCashIn
    .filter((m) => canonicalPaymentMethod(m.paymentMethod) === "EFECTIVO")
    .reduce((sum, m) => sum + Number(m.amount), 0);

  // Rendición = lo que el encargado de delivery entregó físicamente al cajero
  const deliverySettlement = Number(shift.deliverySettlementAmount ?? 0);

  // Cajón = Inicial + Efectivo local + Ingresos efectivo manuales + Rendición − Egresos en efectivo
  const expectedPhysicalCash =
    Number(shift.initialCash) + localCashSales + manualCashInTotal - expensesTotal + deliverySettlement;
  const difference = input.finalCash - expectedPhysicalCash;

  if (process.env.NODE_ENV === "development") {
    console.log("[closeShift] Calc:", { localCashSales, expensesTotal, deliverySettlement, expectedPhysicalCash, finalCash: input.finalCash, difference });
  }

  // Desvincular cadetes de pedidos y eliminar cadetes temporales
  try {
    await prisma.order.updateMany({
      where: { shiftId },
      data: { cadeteId: null },
    });
    await prisma.cadete.deleteMany({
      where: { tenantId, isFixed: false },
    });
  } catch (e) {
    console.warn("[closeShift] Warning: cadete cleanup error:", e);
  }

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      finalCash: input.finalCash,
      expectedCash: expectedPhysicalCash,
      difference,
      notes: input.notes ?? null,
      billCounts: input.billCounts ? JSON.parse(JSON.stringify(input.billCounts)) : null,
    },
  });

  logAudit({ tenantId, userId, action: "SHIFT_CLOSED", entity: "shift", entityId: shiftId });
  return serializeShiftForJson(updated as Record<string, unknown>);
}

function serializeShiftForJson(shift: Record<string, unknown>) {
  const num = (v: unknown) => (v != null ? String(v) : null);
  return {
    ...shift,
    initialCash: num(shift.initialCash),
    finalCash: num(shift.finalCash),
    expectedCash: num(shift.expectedCash),
    difference: num(shift.difference),
    deliverySettlementAmount: num(shift.deliverySettlementAmount),
    deliverySettlementExpectedCash: num(shift.deliverySettlementExpectedCash),
    deliverySettlementDifference: num(shift.deliverySettlementDifference),
  };
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

  return shift ? serializeShiftForJson(shift as Record<string, unknown>) : null;
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

  const allOrders = await prisma.order.findMany({
    where: { shiftId },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      totalPrice: true,
      paymentMethod: true,
      isPaid: true,
      isDelivery: true,
      status: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          quantity: true,
          unitType: true,
          unitPrice: true,
          subtotal: true,
          product: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { orderNumber: "asc" },
  });

  const paidOrders = allOrders.filter((o) => o.isPaid);
  const orderSalesTotal = paidOrders.reduce((sum, o) => sum + Number(o.totalPrice), 0);

  const methodsMap = paidOrders.reduce((acc, o) => {
    const method = canonicalPaymentMethod(o.paymentMethod);
    acc[method] = (acc[method] || 0) + Number(o.totalPrice);
    return acc;
  }, {} as Record<string, number>);

  const manualIncomes = await prisma.shiftManualIncome.findMany({
    where: { tenantId, shiftId },
    orderBy: { createdAt: "asc" },
  });
  const manualSalesTotal = manualIncomes.reduce((s, m) => s + Number(m.amount), 0);
  const manualCashIncomeTotal = manualIncomes
    .filter((m) => canonicalPaymentMethod(m.paymentMethod) === "EFECTIVO")
    .reduce((s, m) => s + Number(m.amount), 0);
  for (const mi of manualIncomes) {
    const method = canonicalPaymentMethod(mi.paymentMethod);
    methodsMap[method] = (methodsMap[method] || 0) + Number(mi.amount);
  }

  const expensesList = await prisma.expense.findMany({
    where: { shiftId, type: "CASH" },
    select: { id: true, description: true, amount: true, notes: true, createdAt: true, paymentMethod: true },
    orderBy: { createdAt: "asc" },
  });
  const totalExpenses = expensesList.reduce((sum, e) => sum + Number(e.amount), 0);
  const cashDrawerExpenses = expensesList
    .filter((e) => isCashDrawerPaymentMethod(e.paymentMethod))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  for (const e of expensesList) {
    if (!isCashDrawerPaymentMethod(e.paymentMethod)) {
      const pm = canonicalPaymentMethod(e.paymentMethod);
      methodsMap[pm] = (methodsMap[pm] || 0) - Number(e.amount);
    }
  }

  const paymentMethods = Object.entries(methodsMap)
    .filter(([, amount]) => amount !== 0)
    .map(([name, amount]) => ({
      id: name.toLowerCase().replace(/\s+/g, "_"),
      name,
      amount,
    }));

  const totalSales = orderSalesTotal + manualSalesTotal;

  const cancelledOrders = allOrders.filter((o) => o.status === "CANCELLED");
  const deliveryOrders = allOrders.filter((o) => o.isDelivery && o.status !== "CANCELLED");
  const localOrders = allOrders.filter((o) => !o.isDelivery && o.status !== "CANCELLED");

  // Efectivo separado: local (cajero recibió) vs delivery (cadete cobró)
  const cashSalesLocal = paidOrders
    .filter((o) => o.paymentMethod === "EFECTIVO" && !o.isDelivery)
    .reduce((sum, o) => sum + Number(o.totalPrice), 0);
  const cashSalesDelivery = paidOrders
    .filter((o) => o.paymentMethod === "EFECTIVO" && o.isDelivery)
    .reduce((sum, o) => sum + Number(o.totalPrice), 0);

  return {
    shift: {
      id: shift.id,
      tenantId: shift.tenantId,
      openedById: shift.openedById,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      initialCash: String(shift.initialCash),
      finalCash: shift.finalCash != null ? String(shift.finalCash) : null,
      expectedCash: shift.expectedCash != null ? String(shift.expectedCash) : null,
      difference: shift.difference != null ? String(shift.difference) : null,
      status: shift.status,
      notes: shift.notes,
      deliverySettlementAmount: shift.deliverySettlementAmount != null ? String(shift.deliverySettlementAmount) : null,
      deliverySettlementExpectedCash:
        shift.deliverySettlementExpectedCash != null ? String(shift.deliverySettlementExpectedCash) : null,
      deliverySettlementDifference:
        shift.deliverySettlementDifference != null ? String(shift.deliverySettlementDifference) : null,
      deliverySettlementBy: shift.deliverySettlementBy,
      deliverySettlementAt: shift.deliverySettlementAt,
      billCounts: shift.billCounts,
      createdAt: shift.createdAt,
      updatedAt: shift.updatedAt,
      openedBy: shift.openedBy ? { id: shift.openedBy.id, name: shift.openedBy.name, role: String(shift.openedBy.role) } : null,
    },
    totalSales,
    totalExpenses,
    /** Solo egresos que salen del cajón (efectivo) — para cuadrar billetes. */
    cashDrawerExpenses,
    paymentMethods,
    manualIncomes: manualIncomes.map((m) => ({
      id: m.id,
      amount: Number(m.amount),
      paymentMethod: m.paymentMethod,
      description: m.description,
      notes: m.notes,
      createdAt: m.createdAt,
    })),
    orders: allOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      totalPrice: String(o.totalPrice),
      paymentMethod: o.paymentMethod,
      isPaid: o.isPaid,
      isDelivery: o.isDelivery,
      status: o.status,
      createdAt: o.createdAt,
      items: o.items.map((i) => ({
        id: i.id,
        productName: i.product?.name || "Sin producto",
        quantity: Number(i.quantity),
        unitType: i.unitType,
        unitPrice: Number(i.unitPrice),
        subtotal: Number(i.subtotal),
      })),
    })),
    expenses: expensesList.map((e) => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      notes: e.notes,
      createdAt: e.createdAt,
      paymentMethod: canonicalPaymentMethod(e.paymentMethod),
    })),
    productSummary: (() => {
      const map: Record<string, { kg: number; units: number; revenue: number }> = {};
      for (const o of paidOrders) {
        for (const item of o.items) {
          const name = item.product?.name || "Sin producto";
          if (!map[name]) map[name] = { kg: 0, units: 0, revenue: 0 };
          if (item.unitType === "KG") map[name].kg += Number(item.quantity);
          else map[name].units += Number(item.quantity);
          map[name].revenue += Number(item.subtotal);
        }
      }
      return Object.entries(map).map(([name, data]) => ({ name, ...data }));
    })(),
    totalVolumeKg: paidOrders.reduce((sum, o) =>
      sum + o.items.filter((i) => i.unitType === "KG").reduce((s, i) => s + Number(i.quantity), 0), 0),
    counts: {
      total: allOrders.length,
      paid: paidOrders.length,
      cancelled: cancelledOrders.length,
      delivery: deliveryOrders.length,
      local: localOrders.length,
    },
    cashSalesLocal,
    cashSalesDelivery,
    /** Ingresos manuales en efectivo (suman al esperado en cajón). */
    manualCashIncomeTotal,
    /** Egresos de caja cargados por el usuario que cerró delivery (si hay rendición con userId) */
    deliveryCadeteEgresos: shift.deliverySettlementUserId
      ? Number(
          (
            await prisma.expense.aggregate({
              where: {
                tenantId,
                shiftId,
                type: "CASH",
                userId: shift.deliverySettlementUserId,
                OR: [{ paymentMethod: null }, { paymentMethod: "EFECTIVO" }],
              },
              _sum: { amount: true },
            })
          )._sum.amount ?? 0,
        )
      : 0,
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
      paymentMethod: input.paymentMethod,
    },
  });
}

export async function createManualShiftIncome(
  tenantId: string,
  userId: string,
  input: ManualShiftIncomeInput
) {
  const shift = await prisma.shift.findFirst({
    where: { id: input.shiftId, tenantId, status: "OPEN" },
  });
  if (!shift) throw createError("Turno no encontrado o cerrado", 404);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { adminPin: true },
  });
  if (tenant?.adminPin) {
    if (!input.pin) throw createError("Ingresá el PIN de administrador", 400);
    const { validateAdminPin } = await import("@/modules/config/config.service");
    const ok = await validateAdminPin(tenantId, input.pin);
    if (!ok) throw createError("PIN de administrador incorrecto", 401);
  }

  const row = await prisma.shiftManualIncome.create({
    data: {
      tenantId,
      shiftId: input.shiftId,
      userId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      description: input.description.trim(),
      notes: input.notes?.trim() || null,
    },
  });

  void logAudit({
    tenantId,
    userId,
    action: "SHIFT_MANUAL_INCOME",
    entity: "shift",
    entityId: input.shiftId,
    metadata: {
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      description: input.description.trim(),
    },
  });

  return {
    id: row.id,
    amount: Number(row.amount),
    paymentMethod: row.paymentMethod,
    description: row.description,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

export async function listCashExpenses(tenantId: string, shiftId: string) {
  const expenses = await prisma.expense.findMany({
    where: { tenantId, shiftId, type: "CASH" },
    orderBy: { createdAt: "desc" },
  });
  return expenses.map((e) => ({
    id: e.id,
    tenantId: e.tenantId,
    shiftId: e.shiftId,
    userId: e.userId,
    type: e.type,
    category: e.category,
    description: e.description,
    amount: Number(e.amount),
    currency: e.currency,
    notes: e.notes,
    paymentMethod: canonicalPaymentMethod(e.paymentMethod),
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));
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

  let deliveryPersonName = input.deliveryPersonName?.trim();
  if (input.deliveryPersonUserId) {
    const user = await prisma.user.findFirst({
      where: { id: input.deliveryPersonUserId, tenantId },
    });
    if (user) deliveryPersonName = user.name;
  }
  if (!deliveryPersonName) throw createError("Nombre del encargado de delivery requerido", 400);

  // Todos los deliverys pagados del turno (para conteo)
  const allPaidDelivery = await prisma.order.findMany({
    where: {
      shiftId,
      isDelivery: true,
      isPaid: true,
    },
    include: {
      cadete: true,
      items: { include: { product: true } },
    },
  });

  const cashOrders = allPaidDelivery.filter((o) => o.paymentMethod === "EFECTIVO");
  const mpOrders = allPaidDelivery.filter((o) => o.paymentMethod === "MERCADO PAGO" || o.paymentMethod === "MERCADOPAGO");
  const otherOrders = allPaidDelivery.filter((o) => o.paymentMethod !== "EFECTIVO" && o.paymentMethod !== "MERCADO PAGO" && o.paymentMethod !== "MERCADOPAGO");

  const grossDeliveryCash = cashOrders.reduce((sum, order) => sum + Number(order.totalPrice), 0);

  // Egresos de caja chica cargados por el encargado (mismo usuario): salen del efectivo que tenía en mano del delivery
  let deliveryPersonExpensesTotal = 0;
  if (input.deliveryPersonUserId) {
    const agg = await prisma.expense.aggregate({
      where: {
        tenantId,
        shiftId,
        type: "CASH",
        userId: input.deliveryPersonUserId,
      },
      _sum: { amount: true },
    });
    deliveryPersonExpensesTotal = Number(agg._sum.amount ?? 0);
  }

  const netExpectedDelivery = grossDeliveryCash - deliveryPersonExpensesTotal;
  const diff = input.receivedAmount - netExpectedDelivery;

  const updatedShift = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      deliverySettlementAmount: input.receivedAmount,
      deliverySettlementExpectedCash: netExpectedDelivery,
      deliverySettlementDifference: diff,
      deliverySettlementBy: deliveryPersonName,
      deliverySettlementUserId: input.deliveryPersonUserId ?? null,
      deliverySettlementAt: new Date(),
    },
  });

  return {
    shift: updatedShift,
    deliveryOrders: cashOrders,
    totalDeliveryOrders: allPaidDelivery.length,
    cashOrdersCount: cashOrders.length,
    mpOrdersCount: mpOrders.length,
    otherOrdersCount: otherOrders.length,
    /** Efectivo cobrado en delivery (bruto, según pedidos) */
    totalDeliveryCash: grossDeliveryCash,
    /** Suma de egresos de caja registrados por el encargado (userId) */
    deliveryPersonExpensesTotal,
    /** Bruto - egresos del encargado: lo que debería entregar al cajero */
    netExpectedDeliveryCash: netExpectedDelivery,
    receivedAmount: input.receivedAmount,
    difference: diff,
    deliveryPersonName,
  };
}
