import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const staff = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    include: { staffProfile: true },
  });
  return NextResponse.json(staff.map(u => ({ ...u, password: undefined })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (!['OWNER', 'MANAGER'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const data = createSchema.parse(body);

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
