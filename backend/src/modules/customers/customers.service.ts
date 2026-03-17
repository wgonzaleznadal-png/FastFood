import { prisma } from '@/lib/prisma';
import { createError } from '@/middleware/errorHandler';
import { normalizePhone } from '@/lib/phoneUtils';
import type { CreateCustomerInput, UpdateCustomerInput, CreateAddressInput, UpdateAddressInput, CreateTagInput } from './customers.schema';

// ─── INCLUDES ────────────────────────────────────────────────────────────────

const CUSTOMER_INCLUDE = {
  addresses: true,
  tags: true,
  orders: {
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
};

// ─── CUSTOMER CRUD ───────────────────────────────────────────────────────────

export async function listCustomers(tenantId: string) {
  return await prisma.customer.findMany({
    where: { tenantId },
    include: {
      addresses: true,
      tags: true,
      _count: {
        select: { orders: true },
      },
    },
    orderBy: { lastOrderAt: 'desc' },
  });
}

export async function getCustomerById(tenantId: string, id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, tenantId },
    include: CUSTOMER_INCLUDE,
  });

  if (!customer) {
    throw createError('Cliente no encontrado', 404);
  }

  return customer;
}

export async function getCustomerByPhone(tenantId: string, phone: string) {
  const norm = normalizePhone(phone);

  // Buscar por teléfono normalizado o exacto
  const customer = await prisma.customer.findFirst({
    where: { tenantId, phone: { in: [norm, phone] } },
    include: CUSTOMER_INCLUDE,
  });

  if (!customer) {
    throw createError('Cliente no encontrado', 404);
  }

  // Calcular insights de fidelización
  const insights = await calculateCustomerInsights(customer);

  return {
    ...customer,
    insights,
  };
}

export async function createCustomer(tenantId: string, data: CreateCustomerInput) {
  const norm = normalizePhone(data.phone);

  const existing = await prisma.customer.findFirst({
    where: { tenantId, phone: { in: [norm, data.phone] } },
  });

  if (existing) {
    throw createError('Ya existe un cliente con ese teléfono', 400);
  }

  return await prisma.customer.create({
    data: {
      tenantId,
      ...data,
      phone: norm,
    },
    include: CUSTOMER_INCLUDE,
  });
}

export async function updateCustomer(tenantId: string, id: string, data: UpdateCustomerInput) {
  const existing = await prisma.customer.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    throw createError('Cliente no encontrado', 404);
  }

  return await prisma.customer.update({
    where: { id },
    data,
    include: CUSTOMER_INCLUDE,
  });
}

export async function deleteCustomer(tenantId: string, id: string) {
  const existing = await prisma.customer.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    throw createError('Cliente no encontrado', 404);
  }

  await prisma.customer.delete({ where: { id } });
}

// ─── BÚSQUEDA PROGRESIVA POR TELÉFONO ────────────────────────────────────────

export async function searchCustomersByPhone(tenantId: string, query: string) {
  if (!query || query.length < 3) return [];

  const norm = normalizePhone(query);
  const raw = query.replace(/\D/g, '');

  return await prisma.customer.findMany({
    where: {
      tenantId,
      OR: [
        { phone: { contains: raw } },
        { phone: { contains: norm } },
      ],
    },
    include: {
      addresses: true,
    },
    take: 8,
    orderBy: { lastOrderAt: 'desc' },
  });
}

// ─── UPSERT (Crear o Actualizar por teléfono) ───────────────────────────────

export async function upsertCustomerByPhone(
  tenantId: string,
  phone: string,
  data: { name?: string; email?: string; notes?: string; address?: string }
) {
  const norm = normalizePhone(phone);

  const existing = await prisma.customer.findFirst({
    where: { tenantId, phone: { in: [norm, phone] } },
  });

  if (existing) {
    const updated = await prisma.customer.update({
      where: { id: existing.id },
      data: {
        ...(data.name && !existing.name ? { name: data.name } : {}),
        phone: norm,
        updatedAt: new Date(),
      },
      include: { addresses: true },
    });

    // Si viene dirección y no la tiene guardada, agregarla
    if (data.address && data.address.trim()) {
      const hasAddr = updated.addresses.some(a => a.street === data.address);
      if (!hasAddr) {
        const isFirst = updated.addresses.length === 0;
        await prisma.address.create({
          data: { customerId: existing.id, street: data.address.trim(), isDefault: true },
        });
        if (!isFirst) {
          await prisma.address.updateMany({
            where: { customerId: existing.id, street: { not: data.address.trim() } },
            data: { isDefault: false },
          });
        }
      }
    }

    return existing;
  }

  const customer = await prisma.customer.create({
    data: {
      tenantId,
      phone: norm,
      name: data.name,
    },
  });

  if (data.address && data.address.trim()) {
    await prisma.address.create({
      data: { customerId: customer.id, street: data.address.trim(), isDefault: true },
    });
  }

  return customer;
}

// ─── ADDRESS CRUD ────────────────────────────────────────────────────────────

export async function createAddress(tenantId: string, data: CreateAddressInput) {
  // Verificar que el customer pertenece al tenant
  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, tenantId },
  });

  if (!customer) {
    throw createError('Cliente no encontrado', 404);
  }

  // Si es default, desmarcar las demás
  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { customerId: data.customerId },
      data: { isDefault: false },
    });
  }

  return await prisma.address.create({
    data,
  });
}

export async function updateAddress(tenantId: string, id: string, data: UpdateAddressInput) {
  const address = await prisma.address.findFirst({
    where: { id },
    include: { customer: true },
  });

  if (!address || address.customer.tenantId !== tenantId) {
    throw createError('Dirección no encontrada', 404);
  }

  // Si se marca como default, desmarcar las demás
  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { customerId: address.customerId },
      data: { isDefault: false },
    });
  }

  return await prisma.address.update({
    where: { id },
    data,
  });
}

export async function deleteAddress(tenantId: string, id: string) {
  const address = await prisma.address.findFirst({
    where: { id },
    include: { customer: true },
  });

  if (!address || address.customer.tenantId !== tenantId) {
    throw createError('Dirección no encontrada', 404);
  }

  await prisma.address.delete({ where: { id } });
}

// ─── CUSTOMER TAGS ───────────────────────────────────────────────────────────

export async function createTag(tenantId: string, data: CreateTagInput) {
  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, tenantId },
  });

  if (!customer) {
    throw createError('Cliente no encontrado', 404);
  }

  return await prisma.customerTag.create({
    data,
  });
}

export async function deleteTag(tenantId: string, id: string) {
  const tag = await prisma.customerTag.findFirst({
    where: { id },
    include: { customer: true },
  });

  if (!tag || tag.customer.tenantId !== tenantId) {
    throw createError('Etiqueta no encontrada', 404);
  }

  await prisma.customerTag.delete({ where: { id } });
}

// ─── INSIGHTS DE FIDELIZACIÓN ────────────────────────────────────────────────

interface CustomerInsights {
  favoriteProduct: { name: string; count: number } | null;
  sundayStreak: number;
  totalPrizes: number;
  averageOrderValue: number;
  daysSinceLastOrder: number | null;
  lastOrderNotes: string | null;
  loyaltyTags: string[];
}

async function calculateCustomerInsights(customer: any): Promise<CustomerInsights> {
  const orders = customer.orders || [];

  const productCounts: Record<string, { name: string; count: number }> = {};
  orders.forEach((order: any) => {
    order.items?.forEach((item: any) => {
      const productName = item.product?.name || 'Desconocido';
      if (!productCounts[productName]) {
        productCounts[productName] = { name: productName, count: 0 };
      }
      productCounts[productName].count++;
    });
  });

  const favoriteProduct = Object.values(productCounts).sort((a, b) => b.count - a.count)[0] || null;

  // Racha de domingos consecutivos (mirando semanas, no solo el último pedido)
  let sundayStreak = 0;
  const sortedOrders = [...orders]
    .filter((o: any) => o.status !== 'CANCELLED')
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const sundayWeeks = new Set<string>();
  for (const order of sortedOrders) {
    const d = new Date(order.createdAt);
    if (d.getDay() === 0) {
      const weekKey = `${d.getFullYear()}-W${Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)}`;
      sundayWeeks.add(weekKey);
    }
  }

  // Count consecutive Sundays from most recent
  const now = new Date();
  let checkDate = new Date(now);
  // Find most recent Sunday
  while (checkDate.getDay() !== 0) checkDate.setDate(checkDate.getDate() - 1);

  for (let i = 0; i < 52; i++) {
    const weekKey = `${checkDate.getFullYear()}-W${Math.ceil(((checkDate.getTime() - new Date(checkDate.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)}`;
    if (sundayWeeks.has(weekKey)) {
      sundayStreak++;
      checkDate.setDate(checkDate.getDate() - 7);
    } else {
      break;
    }
  }

  // Premios completados (cada 5 domingos seguidos = 1 premio)
  const totalPrizes = Math.floor(sundayStreak / 5);

  const totalSpent = orders.reduce((sum: number, order: any) => sum + Number(order.totalPrice || 0), 0);
  const averageOrderValue = orders.length > 0 ? totalSpent / orders.length : 0;

  let daysSinceLastOrder: number | null = null;
  if (customer.lastOrderAt) {
    daysSinceLastOrder = Math.floor((now.getTime() - new Date(customer.lastOrderAt).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Notes del último pedido
  const lastOrder = sortedOrders[0];
  const lastOrderNotes = lastOrder?.notes || null;

  const loyaltyTags: string[] = [];
  if (sundayStreak >= 3) loyaltyTags.push(`Racha de ${sundayStreak} domingos`);
  if (orders.length >= 10) loyaltyTags.push('Cliente frecuente');
  if (averageOrderValue > 50000) loyaltyTags.push('Alto valor');
  if (daysSinceLastOrder !== null && daysSinceLastOrder <= 7) loyaltyTags.push('Activo');

  return {
    favoriteProduct,
    sundayStreak,
    totalPrizes,
    averageOrderValue,
    daysSinceLastOrder,
    lastOrderNotes,
    loyaltyTags,
  };
}

// ─── ACTUALIZAR ESTADÍSTICAS DEL CLIENTE ────────────────────────────────────

export async function updateCustomerStats(customerId: string, tenantId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    include: {
      orders: {
        where: { status: { not: 'CANCELLED' } },
      },
    },
  });

  if (!customer) return;

  const totalOrders = customer.orders.length;
  const totalSpent = customer.orders.reduce((sum, order) => 
    sum + Number(order.totalPrice), 0
  );
  const lastOrderAt = customer.orders.length > 0
    ? customer.orders.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0].createdAt
    : null;

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      totalOrders,
      totalSpent,
      lastOrderAt,
    },
  });
}
