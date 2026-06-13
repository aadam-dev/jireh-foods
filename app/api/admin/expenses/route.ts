import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';
import { logAudit } from '@/src/lib/audit';
import { requireAuth, requireResource, requireRoles } from '@/src/lib/api-auth';
import { UserRole } from '@prisma/client';

const expenseSchema = z.object({
  categoryId: z.string(),
  description: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'MOMO', 'CARD', 'BANK_TRANSFER', 'UNPAID']).default('CASH'),
  date: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await requireResource('expenses');
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');

  const where: Record<string, unknown> = {};
  if (month) {
    const [year, m] = month.split('-').map(Number);
    where.date = { gte: new Date(year, m - 1, 1), lt: new Date(year, m, 1) };
  }

  const [expenses, categories] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { category: true },
    }),
    prisma.expenseCategory.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ]);

  return NextResponse.json({ expenses, categories });
}

export async function POST(req: NextRequest) {
  const authResult = await requireResource('expenses');
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();
  const data = expenseSchema.parse(body);

  const expense = await prisma.expense.create({
    data: {
      categoryId: data.categoryId,
      description: data.description,
      amount: data.amount,
      paymentMethod: data.paymentMethod as any,
      date: data.date ? new Date(data.date) : new Date(),
      notes: data.notes,
    },
    include: { category: true },
  });
  void logAudit({
    userId: authResult.user.id,
    action: 'CREATE',
    entity: 'Expense',
    entityId: expense.id,
    details: { amount: Number(expense.amount), category: expense.category.name, description: expense.description },
    req,
  });

  return NextResponse.json(expense);
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER, UserRole.MANAGER]);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
