import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { requireAuth, requireRoles } from '@/src/lib/api-auth';

const createSchema = z.object({
  userId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  baseSalary: z.number().min(0),
  bonus: z.number().min(0).default(0),
  deductions: z.number().min(0).default(0),
  notes: z.string().optional(),
});

const patchPayrollSchema = z.object({
  id: z.string(),
  status: z.enum(['DRAFT', 'APPROVED', 'PAID']),
});

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER, UserRole.ACCOUNTANT]);
  if (forbidden) return forbidden;

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
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER, UserRole.ACCOUNTANT]);
  if (forbidden) return forbidden;
  const session = authResult;

  const body = await req.json();
  const data = createSchema.parse(body);
  const netPay = data.baseSalary + data.bonus - data.deductions;
  if (netPay < 0) {
    return NextResponse.json({ error: 'Net pay cannot be negative' }, { status: 400 });
  }

  const periodStart = new Date(data.periodStart);
  const periodEnd = new Date(data.periodEnd);

  const duplicate = await prisma.payrollRecord.findFirst({
    where: { userId: data.userId, periodStart, periodEnd },
  });
  if (duplicate) {
    return NextResponse.json({ error: 'Payroll record already exists for this period' }, { status: 409 });
  }

  const record = await prisma.payrollRecord.create({
    data: {
      userId: data.userId,
      periodStart,
      periodEnd,
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
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER, UserRole.ACCOUNTANT]);
  if (forbidden) return forbidden;

  const parsed = patchPayrollSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { id, status } = parsed.data;

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
