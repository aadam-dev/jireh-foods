import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { UserRole } from '@prisma/client';
import { requireResource, requireRoles } from '@/src/lib/api-auth';

export async function GET() {
  const authResult = await requireResource('suppliers');
  if (authResult instanceof NextResponse) return authResult;

  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    include: { _count: { select: { purchaseOrders: true } } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(suppliers);
}

export async function POST(req: NextRequest) {
  const authResult = await requireResource('suppliers');
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER, UserRole.MANAGER]);
  if (forbidden) return forbidden;

  const body = await req.json();
  const supplier = await prisma.supplier.create({
    data: {
      name: body.name,
      contactPerson: body.contactPerson ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      address: body.address ?? null,
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json(supplier);
}
