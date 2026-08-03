import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { requireAuth, requireRoles } from '@/src/lib/api-auth';
import { canAssignRole } from '@/src/lib/permissions';

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['OWNER', 'MANAGER', 'ACCOUNTANT', 'CASHIER', 'STAFF']),
  phone: z.string().optional(),
  hireDate: z.string().optional(),
  salaryType: z.enum(['MONTHLY', 'DAILY', 'HOURLY']).default('MONTHLY'),
  salary: z.number().default(0),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER, UserRole.MANAGER]);
  if (forbidden) return forbidden;

  const staff = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    include: { staffProfile: true },
  });
  return NextResponse.json(staff.map(u => ({ ...u, password: undefined })));
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER, UserRole.MANAGER]);
  if (forbidden) return forbidden;
  const session = authResult;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (!canAssignRole(authResult.user.role, data.role as UserRole)) {
    return NextResponse.json({ error: 'You cannot assign that role' }, { status: 403 });
  }

  const emailLower = data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: emailLower } });
  if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 400 });

  const hashed = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: emailLower,
      password: hashed,
      role: data.role as any,
      staffProfile: {
        create: {
          phone: data.phone,
          hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
          salaryType: data.salaryType as any,
          salary: data.salary,
          bankName: data.bankName,
          bankAccount: data.bankAccount,
        },
      },
    },
    include: { staffProfile: true },
  });

  return NextResponse.json({ ...user, password: undefined });
}
