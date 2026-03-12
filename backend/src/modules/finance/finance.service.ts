// backend/src/modules/finance/finance.service.ts
import { prisma } from "@/lib/prisma";
import { createError } from "@/middleware/errorHandler";
import { StructuralExpenseInput } from "./finance.schema";

// ─── Structural Expenses ──────────────────────────────────────────────────────

export async function listExpenses(
  tenantId: string,
  filters: { period?: string; isPaid?: string; category?: string }
) {
  return prisma.expense.findMany({
    where: {
      tenantId,
      ...(filters.period ? { period: filters.period } : {}),
      ...(filters.isPaid !== undefined ? { isPaid: filters.isPaid === "true" } : {}),
      ...(filters.category ? { category: filters.category as never } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createExpense(tenantId: string, input: StructuralExpenseInput) {
  const expense = await prisma.expense.create({
    data: {
      tenantId,
      type: 'STRUCTURAL',
      category: input.category,
      description: input.description,
      amount: input.amount,
      currency: input.currency || "ARS",
      period: input.period,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      isPaid: input.isPaid ?? false,
      notes: input.notes,
    },
  });
  return expense;
}

export async function updateExpense(
  tenantId: string,
  id: string,
  input: Partial<StructuralExpenseInput> & { paidAt?: string }
) {
  const existing = await prisma.expense.findFirst({ where: { id, tenantId } });
  if (!existing) throw createError("Gasto no encontrado", 404);

  return prisma.expense.update({
    where: { id },
    data: {
      ...(input.category ? { category: input.category } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.currency ? { currency: input.currency } : {}),
      ...(input.period ? { period: input.period } : {}),
      ...(input.dueDate ? { dueDate: new Date(input.dueDate) } : {}),
      ...(input.isPaid !== undefined ? { isPaid: input.isPaid } : {}),
      ...(input.paidAt ? { paidAt: new Date(input.paidAt) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });
}

export async function deleteExpense(tenantId: string, id: string) {
  const existing = await prisma.expense.findFirst({ where: { id, tenantId } });
  if (!existing) throw createError("Gasto no encontrado", 404);
  await prisma.expense.delete({ where: { id } });
}

// ─── Consolidator (LA TORRE DE CONTROL - BI) ──────────────────────────────────

export async function getConsolidator(
  tenantId: string,
  filters: { from?: string; to?: string; period?: string }
) {
  // 1. Filtro de fechas
  const dateFilter =
    filters.from || filters.to
      ? {
          openedAt: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
          },
        }
      : {};

  // 2. Traemos los turnos cerrados
  const shifts = await prisma.shift.findMany({
    where: { tenantId, status: "CLOSED", ...dateFilter },
    include: {
      openedBy: { select: { id: true, name: true } },
      _count: { select: { orders: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  const shiftIds = shifts.map((s) => s.id);

  // 3. LA EXTRACCIÓN MASIVA: Traemos todo el detalle de ventas
  // NOTA: Incluimos "DELIVERED" para arreglar el bug de los cadetes
  const kgOrders = await prisma.order.findMany({
    where: { shiftId: { in: shiftIds }, isPaid: true },
    select: {
      shiftId: true,
      totalPrice: true,
      paymentMethod: true,
      isDelivery: true,
      createdAt: true,
      items: { select: { quantity: true, unitType: true } }
    }
  });

  // Por si tenés órdenes del menú viejo (bebidas, empanadas unitarias, etc.)
  const regularOrders = await prisma.order.findMany({
    where: { shiftId: { in: shiftIds }, status: "DELIVERED" },
    select: { shiftId: true, totalPrice: true, createdAt: true }
  });

  // 4. EL DULCE DE LECHE: Variables para los gráficos y KPIs
  let totalSales = 0;
  let totalVolumeKg = 0;
  let totalOrdersCount = kgOrders.length + regularOrders.length;
  
  const salesByMethod: Record<string, number> = {};
  const salesByDay: Record<string, number> = {};
  const typeSplit = { delivery: 0, retiro: 0 };
  const shiftSalesMap = new Map<string, number>();

  // Procesamos los pedidos por kilo
  for (const o of kgOrders) {
    const price = Number(o.totalPrice || 0);
    totalSales += price;

    // Sumar al turno correspondiente (para la tabla inferior)
    shiftSalesMap.set(o.shiftId, (shiftSalesMap.get(o.shiftId) || 0) + price);

    // Sumar por método de pago
    const method = o.paymentMethod ? o.paymentMethod.toUpperCase() : "EFECTIVO";
    salesByMethod[method] = (salesByMethod[method] || 0) + price;

    // Delivery vs Retiro
    if (o.isDelivery) typeSplit.delivery += price;
    else typeSplit.retiro += price;

    // Volumen en Kilos
    for (const item of o.items) {
      if (item.unitType === 'KG') {
        totalVolumeKg += Number(item.quantity || 0);
      }
    }

    // Ingresos Diarios (Agrupación para gráfico de barras)
    // Restamos 3 horas para la zona horaria de Argentina (Corrientes)
    const d = new Date(o.createdAt);
    d.setHours(d.getHours() - 3);
    const day = d.toISOString().split('T')[0]; // Genera "2026-02-25"
    salesByDay[day] = (salesByDay[day] || 0) + price;
  }

  // Procesamos órdenes regulares (para no perder compatibilidad)
  for (const ro of regularOrders) {
    const price = Number(ro.totalPrice || 0);
    totalSales += price;
    shiftSalesMap.set(ro.shiftId, (shiftSalesMap.get(ro.shiftId) || 0) + price);
    
    // Por defecto las mandamos a efectivo y retiro si no tienen el campo
    salesByMethod["EFECTIVO"] = (salesByMethod["EFECTIVO"] || 0) + price;
    typeSplit.retiro += price;

    const d = new Date(ro.createdAt);
    d.setHours(d.getHours() - 3);
    const day = d.toISOString().split('T')[0];
    salesByDay[day] = (salesByDay[day] || 0) + price;
  }

  // 5. Enriquecemos la lista de turnos (No rompe la tabla actual del frontend)
  const enrichedShifts = shifts.map((s) => ({
    ...s,
    totalSales: shiftSalesMap.get(s.id) ?? 0,
    initialCash: Number(s.initialCash || 0),
    difference: Number(s.difference || 0)
  }));

  const totalInitialCash = enrichedShifts.reduce((acc, s) => acc + s.initialCash, 0);
  const totalDifference = enrichedShifts.reduce((acc, s) => acc + s.difference, 0);

  // 6. Gastos Estructurales (Luz, Alquiler, etc.)
  const expenses = filters.period
    ? await prisma.expense.findMany({ where: { tenantId, period: filters.period } })
    : [];
  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

  // 7. ARMAR EL PAQUETE (La respuesta de la API)
  return {
    shifts: enrichedShifts, // La tabla vieja sigue funcionando
    expenses,
    summary: {
      // Datos Base
      totalSales,
      totalInitialCash,
      totalDifference,
      totalExpenses,
      netResult: totalSales - totalExpenses,
      shiftCount: shifts.length,
      
      // NUEVO: Inteligencia de Negocio para el Frontend
      kpis: {
        ticketPromedio: totalOrdersCount > 0 ? (totalSales / totalOrdersCount) : 0,
        totalVolumeKg,
        deliverySales: typeSplit.delivery,
        retiroSales: typeSplit.retiro,
        totalOrdersCount
      },
      charts: {
        salesByMethod, // Ej: { "EFECTIVO": 5000, "MERCADO PAGO": 12000 }
        salesByDay     // Ej: { "2026-02-24": 15000, "2026-02-25": 32000 }
      }
    },
  };
}