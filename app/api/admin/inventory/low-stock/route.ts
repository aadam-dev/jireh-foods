import { NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';

// Lightweight endpoint: just the count of low-stock items for the sidebar badge
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
