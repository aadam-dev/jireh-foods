import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';

const createSchema = z.object({
  userId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  baseSalary: z.number(),
  bonus: z.number().default(0),
  deductions: z.number().default(0),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');

  const where: any = {};
  if (month) {
    const [year, m] = month.split('-').map(Number);
    where.periodStart = { gte: new Date(year, m - 1, 1), lt: new Date(year, m, 1) };
  }

  const records = await prisma.payrollRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true, role: true } } },
  });
  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (!['OWNER', 'ACCOUNTANT'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const data = createSchema.parse(body);
  const netPay = data.baseSalary + data.bonus - data.deductions;

  const record = await prisma.payrollRecord.create({
    data: {
      userId: data.userId,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      baseSalary: data.baseSalary,
      bonus: data.bonus,
      deductions: data.deductions,
      netPay,
      notes: data.notes,
    },
    include: { user: { select: { name: true, email: true, role: true } } },
  });
  return NextResponse.json(record);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (!['OWNER', 'ACCOUNTANT'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, status } = await req.json();
  const record = await prisma.payrollRecord.update({
    where: { id },
    data: {
      status,
      ...(status === 'PAID' ? { paidAt: new Date() } : {}),
    },
    include: { user: { select: { name: true } } },
  });
  return NextResponse.json(record);
}
