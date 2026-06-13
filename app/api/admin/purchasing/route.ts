import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { UserRole } from '@prisma/client';
import { requireResource, requireRoles } from '@/src/lib/api-auth';

export async function GET(req: NextRequest) {
  const authResult = await requireResource('purchasing');
  if (authResult instanceof NextResponse) return authResult;

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

function generatePoNumber() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const r = Math.floor(100 + Math.random() * 900);
  return `PO-${d}-${r}`;
}

export async function POST(req: NextRequest) {
  const authResult = await requireResource('purchasing');
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER, UserRole.MANAGER]);
  if (forbidden) return forbidden;

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
      createdById: authResult.user.id,
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
