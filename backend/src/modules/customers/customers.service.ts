import { prisma } from '@/lib/prisma';
import { createError } from '@/middleware/errorHandler';
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
  const customer = await prisma.customer.findFirst({
    where: { tenantId, phone },
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
  // Verificar si ya existe un cliente con ese teléfono
  const existing = await prisma.customer.findFirst({
    where: { tenantId, phone: data.phone },
  });

  if (existing) {
    throw createError('Ya existe un cliente con ese teléfono', 400);
  }

  return await prisma.customer.create({
    data: {
      tenantId,
      ...data,
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

// ─── UPSERT (Crear o Actualizar por teléfono) ───────────────────────────────

export async function upsertCustomerByPhone(
  tenantId: string,
  phone: string,
  data: { name?: string; email?: string; notes?: string }
) {
  const existing = await prisma.customer.findFirst({
    where: { tenantId, phone },
  });

  if (existing) {
    return await prisma.customer.update({
      where: { id: existing.id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: CUSTOMER_INCLUDE,
    });
  }

  return await prisma.customer.create({
    data: {
      tenantId,
      phone,
      ...data,
    },
    include: CUSTOMER_INCLUDE,
  });
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
  averageOrderValue: number;
  daysSinceLastOrder: number | null;
  loyaltyTags: string[];
}

async function calculateCustomerInsights(customer: any): Promise<CustomerInsights> {
  const orders = customer.orders || [];

  // Producto más pedido
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

  // Racha de domingos
  let sundayStreak = 0;
  const sortedOrders = [...orders].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  for (const order of sortedOrders) {
    const orderDate = new Date(order.createdAt);
    if (orderDate.getDay() === 0) {
      sundayStreak++;
    } else {
      break;
    }
  }

  // Promedio de gasto
  const totalSpent = orders.reduce((sum: number, order: any) => 
    sum + Number(order.totalPrice || 0), 0
  );
  const averageOrderValue = orders.length > 0 ? totalSpent / orders.length : 0;

  // Días desde último pedido
  let daysSinceLastOrder: number | null = null;
  if (customer.lastOrderAt) {
    const now = new Date();
    const lastOrder = new Date(customer.lastOrderAt);
    daysSinceLastOrder = Math.floor((now.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Tags de fidelización
  const loyaltyTags: string[] = [];
  if (sundayStreak >= 3) loyaltyTags.push(`Racha de ${sundayStreak} domingos`);
  if (orders.length >= 10) loyaltyTags.push('Cliente frecuente');
  if (averageOrderValue > 50000) loyaltyTags.push('Alto valor');
  if (daysSinceLastOrder !== null && daysSinceLastOrder <= 7) loyaltyTags.push('Activo');

  return {
    favoriteProduct,
    sundayStreak,
    averageOrderValue,
    daysSinceLastOrder,
    loyaltyTags,
  };
}

// ─── ACTUALIZAR ESTADÍSTICAS DEL CLIENTE ────────────────────────────────────

export async function updateCustomerStats(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
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
