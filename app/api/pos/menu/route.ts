import { NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const categories = await prisma.menuCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: { isAvailable: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  // Prisma Decimal fields serialize to strings in JSON — coerce to number so
  // the POS can pass them back in order payloads without Zod rejecting them.
  const serialized = categories.map(cat => ({
    ...cat,
    items: cat.items.map(item => ({
      ...item,
      price: Number(item.price),
      costPrice: item.costPrice != null ? Number(item.costPrice) : null,
    })),
  }));

  return NextResponse.json(serialized);
}
