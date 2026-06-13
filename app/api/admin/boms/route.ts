import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { requireResource } from '@/src/lib/api-auth';

export async function GET() {
  const authResult = await requireResource('boms');
  if (authResult instanceof NextResponse) return authResult;

  const boms = await prisma.bom.findMany({
    include: {
      menuItem: { select: { id: true, name: true, price: true, category: { select: { name: true } } } },
      lines: {
        include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { menuItem: { name: 'asc' } },
  });

  return NextResponse.json(boms);
}

export async function POST(req: NextRequest) {
  const authResult = await requireResource('boms');
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();
  const { menuItemId, notes, lines } = body;

  if (!menuItemId || !Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: 'menuItemId and at least one line required' }, { status: 400 });
  }

  const bom = await prisma.bom.create({
    data: {
      menuItemId,
      notes: notes ?? null,
      isActive: true,
      lines: {
        create: lines.map((l: any) => ({
          inventoryItemId: l.inventoryItemId,
          quantity: parseFloat(l.quantity),
          unit: l.unit,
        })),
      },
    },
    include: {
      menuItem: { select: { id: true, name: true } },
      lines: { include: { inventoryItem: { select: { id: true, name: true, unit: true } } } },
    },
  });

  return NextResponse.json(bom);
}
