import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { requireResource } from '@/src/lib/api-auth';

export async function GET() {
  const authResult = await requireResource('inventory');
  if (authResult instanceof NextResponse) return authResult;

  try {
    const items = await prisma.inventoryItem.findMany({
      where: { isActive: true },
      select: { quantity: true, lowStockThreshold: true },
    });

    const count = items.filter(
      (i) => Number(i.quantity) <= Number(i.lowStockThreshold),
    ).length;

    return NextResponse.json({ count });
  } catch (err) {
    console.error('[low-stock]', err);
    return NextResponse.json({ count: 0 });
  }
}
