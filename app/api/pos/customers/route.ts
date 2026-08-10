import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { cleanName, normalisePhone } from '@/src/lib/customer';

/* Customer suggestions for the register.
   ────────────────────────────────────────────────────────────────────────────
   Deliberately separate from /api/admin/customers, which is scoped to
   OWNER/MANAGER/ACCOUNTANT — a cashier needs to look a name up and has no
   business reading spend history. This returns the three fields the
   suggestion list draws and nothing else: no totals, no order history.

   Auth is plain `auth()` like /api/pos/menu, so any signed-in till user can
   call it. Living under /api/pos also means the service worker can cache it,
   which /api/admin/* is not set up to do. */

/** Enough to pick from, few enough to render in one screenful. */
const LIMIT = 20;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = req.nextUrl.searchParams.get('q') ?? '';
  const q = cleanName(raw);
  const digits = normalisePhone(raw);

  try {
    /* No query yet: hand back the most recently added, so the list is useful
       the moment it opens rather than only after typing. */
    if (!q) {
      const recent = await prisma.customer.findMany({
        orderBy: { updatedAt: 'desc' },
        take: LIMIT,
        select: { id: true, name: true, phone: true },
      });
      return NextResponse.json(recent);
    }

    const matches = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        ],
      },
      // Alphabetical so the same name never moves position between keystrokes —
      // a list that reorders under a moving finger causes mis-taps.
      orderBy: { name: 'asc' },
      take: LIMIT,
      select: { id: true, name: true, phone: true },
    });

    return NextResponse.json(matches);
  } catch (err) {
    console.error('[pos/customers GET]', err);
    // A lookup failure must never block a sale — the cashier can still type a
    // name freely, it just will not be suggested.
    return NextResponse.json([], { status: 200 });
  }
}
