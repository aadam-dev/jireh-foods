import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';

const expenseSchema = z.object({
  categoryId: z.string(),
  description: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'MOMO', 'CARD', 'BANK_TRANSFER', 'UNPAID']).default('CASH'),
  date: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month'); // YYYY-MM

  const where: any = {};
  if (month) {
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 1);
    where.date = { gte: start, lt: end };
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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  return NextResponse.json(expense);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (!['OWNER', 'MANAGER'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
