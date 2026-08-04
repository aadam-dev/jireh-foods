import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const categories = await prisma.menuCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      // Unavailable items are returned too, greyed on the register as the 86
      // board — staff need to see what is off in order to put it back on.
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          modifiers: {
            orderBy: { sortOrder: 'asc' },
            include: {
              group: {
                include: {
                  options: {
                    where: { isAvailable: true },
                    orderBy: { sortOrder: 'asc' },
                  },
                },
              },
            },
          },
        },
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
      modifierGroups: item.modifiers
        .filter(link => link.group.isActive)
        .map(link => ({
          id: link.group.id,
          name: link.group.name,
          selection: link.group.selection,
          isRequired: link.group.isRequired,
          options: link.group.options.map(o => ({
            id: o.id,
            name: o.name,
            priceDelta: Number(o.priceDelta),
          })),
        }))
        .filter(g => g.options.length > 0),
      modifiers: undefined,
    })),
  }));

  return NextResponse.json(serialized);
}

const availabilitySchema = z.object({
  itemId: z.string().min(1),
  isAvailable: z.boolean(),
});

/* PATCH /api/pos/menu — the 86 board.
   ────────────────────────────────────────────────────────────────────────────
   Deliberately narrower than the admin menu endpoint: any POS user may flip
   availability (the person who discovers the fufu ran out is the cashier, not
   the owner), but nothing else about the item can be edited here. The change
   propagates to the public website through /api/menu. */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = availabilitySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'itemId and isAvailable are required' }, { status: 400 });
  }

  try {
    const item = await prisma.menuItem.update({
      where: { id: parsed.data.itemId },
      data: { isAvailable: parsed.data.isAvailable },
      select: { id: true, name: true, isAvailable: true },
    });
    return NextResponse.json(item);
  } catch (err) {
    console.error('[pos/menu PATCH]', err);
    return NextResponse.json({ error: 'Could not update availability' }, { status: 500 });
  }
}
