import { prisma } from '../../lib/prisma';
import { createError } from '../../middleware/errorHandler';
import type { CreateExpenseInput, UpdateExpenseInput } from './expenses.schema';
import type { Prisma } from '@prisma/client';

// ─── EXPENSE SERVICE (UNIFICADO) ─────────────────────────────────────────────

export const expensesService = {
  /**
   * Crear nuevo egreso (CASH, STRUCTURAL, SUPPLIES)
   */
  async createExpense(tenantId: string, data: CreateExpenseInput) {
    // Si es CASH, validar que el shift existe
    if (data.type === 'CASH' && data.shiftId) {
      const shift = await prisma.shift.findFirst({
        where: { id: data.shiftId, tenantId, status: 'OPEN' },
      });

      if (!shift) {
        throw createError('Shift not found or closed', 404);
      }
    }

    const expense = await prisma.expense.create({
      data: {
        tenantId,
        shiftId: data.shiftId,
        userId: data.userId,
        type: data.type,
        category: data.category,
        description: data.description,
        amount: data.amount,
        currency: data.currency,
        period: data.period,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        paidAt: data.paidAt ? new Date(data.paidAt) : undefined,
        isPaid: data.isPaid,
        notes: data.notes,
      },
      include: {
        shift: true,
        user: true,
      },
    });

    return expense;
  },

  /**
   * Obtener egreso por ID
   */
  async getExpenseById(tenantId: string, expenseId: string) {
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, tenantId },
      include: {
        shift: true,
        user: true,
      },
    });

    if (!expense) {
      throw createError('Expense not found', 404);
    }

    return expense;
  },

  /**
   * Listar egresos con filtros
   */
  async listExpenses(
    tenantId: string,
    filters?: {
      shiftId?: string;
      type?: string;
      isPaid?: boolean;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const where: Prisma.ExpenseWhereInput = { tenantId };

    if (filters?.shiftId) where.shiftId = filters.shiftId;
    if (filters?.type) where.type = filters.type as any;
    if (filters?.isPaid !== undefined) where.isPaid = filters.isPaid;
    
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        shift: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return expenses;
  },

  /**
   * Actualizar egreso
   */
  async updateExpense(tenantId: string, expenseId: string, data: UpdateExpenseInput) {
    const existingExpense = await prisma.expense.findFirst({
      where: { id: expenseId, tenantId },
    });

    if (!existingExpense) {
      throw createError('Expense not found', 404);
    }

    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        type: data.type,
        category: data.category,
        description: data.description,
        amount: data.amount,
        currency: data.currency,
        period: data.period,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        paidAt: data.paidAt ? new Date(data.paidAt) : undefined,
        isPaid: data.isPaid,
        notes: data.notes,
      },
      include: {
        shift: true,
        user: true,
      },
    });

    return expense;
  },

  /**
   * Eliminar egreso
   */
  async deleteExpense(tenantId: string, expenseId: string) {
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, tenantId },
    });

    if (!expense) {
      throw createError('Expense not found', 404);
    }

    await prisma.expense.delete({
      where: { id: expenseId },
    });

    return { success: true };
  },

  /**
   * Obtener egresos de un turno específico
   */
  async getExpensesByShift(tenantId: string, shiftId: string) {
    const expenses = await prisma.expense.findMany({
      where: { tenantId, shiftId, type: 'CASH' },
      include: {
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return expenses;
  },

  /**
   * Obtener egresos por tipo
   */
  async getExpensesByType(tenantId: string, type: 'CASH' | 'STRUCTURAL' | 'SUPPLIES') {
    const expenses = await prisma.expense.findMany({
      where: { tenantId, type },
      include: {
        shift: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return expenses;
  },

  /**
   * Obtener total de egresos por tipo en un período
   */
  async getTotalByType(
    tenantId: string,
    type: 'CASH' | 'STRUCTURAL' | 'SUPPLIES',
    startDate?: string,
    endDate?: string
  ) {
    const where: Prisma.ExpenseWhereInput = { tenantId, type };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const result = await prisma.expense.aggregate({
      where,
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount || 0;
  },
};
