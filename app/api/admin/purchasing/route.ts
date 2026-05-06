import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';

function generatePoNumber() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const r = Math.floor(100 + Math.random() * 900);
  return `PO-${d}-${r}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const pos = await prisma.purchaseOrder.findMany({
    where: { ...(status ? { status: status as any } : {}) },
    include: {
      supplier: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      lines: {
        include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
      },
      receipts: { select: { id: true, receivedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(pos);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!['OWNER', 'MANAGER', 'ACCOUNTANT'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { supplierId, expectedDate, notes, lines } = body;

  if (!supplierId || !Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: 'supplierId and lines required' }, { status: 400 });
  }

  const totalAmount = lines.reduce(
    (s: number, l: any) => s + parseFloat(l.orderedQty) * parseFloat(l.unitPrice),
    0,
  );

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber: generatePoNumber(),
      supplierId,
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      notes: notes ?? null,
      totalAmount,
      createdById: session.user.id!,
      lines: {
        create: lines.map((l: any) => ({
          inventoryItemId: l.inventoryItemId,
          orderedQty: parseFloat(l.orderedQty),
          purchaseUnit: l.purchaseUnit,
          unitPrice: parseFloat(l.unitPrice),
        })),
      },
    },
    include: {
      supplier: { select: { id: true, name: true } },
      lines: { include: { inventoryItem: { select: { id: true, name: true, unit: true } } } },
    },
  });

  return NextResponse.json(po);
}
