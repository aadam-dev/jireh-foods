import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

/* Public menu feed — no auth, no prices hidden, no cost data.
   ────────────────────────────────────────────────────────────────────────────
   This is the third leg of availability sync: the menu manager toggles
   isAvailable, the register hides the tile, and this endpoint takes the dish
   off the public website too. One source of truth, no stale printed menu.

   Deliberately excludes costPrice and any recipe data — this response is
   world-readable. */

export const revalidate = 60;

export async function GET() {
  try {
    const categories = await prisma.menuCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        items: {
          where: { isAvailable: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            image: true,
            isPopular: true,
          },
        },
      },
    });

    return NextResponse.json(
      categories
        .filter(c => c.items.length > 0)
        .map(c => ({
          ...c,
          items: c.items.map(i => ({ ...i, price: Number(i.price) })),
        })),
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch (err) {
    console.error('[api/menu]', err);
    // The marketing site falls back to its built-in menu, so a database blip
    // must never blank the page — return an empty list rather than a 500.
    return NextResponse.json([], { status: 200 });
  }
}
