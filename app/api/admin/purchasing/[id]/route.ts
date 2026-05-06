import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      createdBy: { select: { name: true } },
      lines: {
        include: { inventoryItem: { select: { id: true, name: true, unit: true, purchaseUnit: true, conversionFactor: true } } },
      },
      receipts: {
        include: {
          receivedBy: { select: { name: true } },
          lines: { include: { inventoryItem: { select: { name: true, unit: true } } } },
        },
        orderBy: { receivedAt: 'desc' },
      },
    },
  });

  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(po);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!['OWNER', 'MANAGER', 'ACCOUNTANT'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const po = await prisma.purchaseOrder.update({
    where: { id: params.id },
    data: {
      status: body.status ?? undefined,
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
      notes: body.notes ?? undefined,
      updatedAt: new Date(),
    },
    include: { supplier: { select: { name: true } } },
  });

  return NextResponse.json(po);
}
