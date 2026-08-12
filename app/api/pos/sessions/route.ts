import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { classifyRegisterSession } from '@/src/lib/session-utils';
import { drawerTotals, walletTotals } from '@/src/lib/cash';
import { UserRole } from '@prisma/client';

// Break down orders into per-method revenue, handling SPLIT orders correctly.
function calcRevenue(orders: { total: unknown; paymentMethod: string; splitPayments: unknown }[]) {
  let cash = 0, momo = 0, bolt = 0, total = 0;
  for (const o of orders) {
    const amt = Number(o.total);
    total += amt;
    if (o.paymentMethod === 'SPLIT' && Array.isArray(o.splitPayments)) {
      for (const leg of o.splitPayments as { method: string; amount: number }[]) {
        if (leg.method === 'CASH')      cash += leg.amount;
        else if (leg.method === 'MOMO') momo += leg.amount;
        else if (leg.method === 'BOLT_FOOD') bolt += leg.amount;
      }
    } else {
      if (o.paymentMethod === 'CASH')      cash += amt;
      else if (o.paymentMethod === 'MOMO') momo += amt;
      else if (o.paymentMethod === 'BOLT_FOOD') bolt += amt;
    }
  }
  return { revenue: total, cashRevenue: cash, momoRevenue: momo, boltRevenue: bolt };
}

const MANAGER_ROLES: UserRole[] = [UserRole.OWNER, UserRole.MANAGER];

/* Shift accountability policy.
   ────────────────────────────────────────────────────────────────────────────
   Today the whole team shares one register, so anyone who can reach the POS may
   open a shift and close any shift — including one left open from a previous
   day. Every close still records closedBy, so the audit trail is intact even
   though the gate is open.

   To tighten later (own-shift-only for cashiers, managers for stale shifts),
   flip this to false — the stricter logic below is still here and tested. */
const ANY_POS_USER_MAY_CLOSE_ANY_SHIFT = true;

function canCloseSession(role: UserRole, openedBy: string, userId: string, isStale: boolean): boolean {
  if (ANY_POS_USER_MAY_CLOSE_ANY_SHIFT) return true;
  if (MANAGER_ROLES.includes(role)) return true;
  if (isStale) return false;
  return openedBy === userId;
}

/** Who may auto-close a stale shift in order to start a fresh one. */
function canForceCloseStale(role: UserRole): boolean {
  return ANY_POS_USER_MAY_CLOSE_ANY_SHIFT || MANAGER_ROLES.includes(role);
}

// GET /api/pos/sessions — current open session (if any)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const open = await prisma.posSession.findFirst({
      where: { status: 'OPEN' },
      include: {
        openedByUser: { select: { id: true, name: true } },
        _count: { select: { orders: true } },
      },
      orderBy: { openedAt: 'desc' },
    });

    const registerState = open ? classifyRegisterSession(open.openedAt) : 'none';

    // Compute session revenue (handles SPLIT orders via calcRevenue)
    let stats = { revenue: 0, cashRevenue: 0, momoRevenue: 0, boltRevenue: 0 };
    let drawer = { openingFloat: 0, cashRevenue: 0, cashIn: 0, cashOut: 0, expected: 0 };
    let movements: any[] = [];

    if (open) {
      const [orders, cashMovements] = await Promise.all([
        prisma.order.findMany({
          where: { sessionId: open.id, status: 'COMPLETED', isDemo: false },
          select: { total: true, paymentMethod: true, splitPayments: true },
        }),
        prisma.cashMovement.findMany({
          where: { sessionId: open.id },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, direction: true, amount: true, reason: true, createdAt: true,
            user: { select: { name: true } },
          },
        }),
      ]);
      const r = calcRevenue(orders as any);
      stats = { revenue: r.revenue, cashRevenue: r.cashRevenue, momoRevenue: r.momoRevenue, boltRevenue: r.boltRevenue };
      movements = cashMovements.map(m => ({ ...m, amount: Number(m.amount) }));
      // Same helper the close endpoint and the back-office report use, so the
      // figure on the till can never drift from the one on the report.
      drawer = drawerTotals({
        openingFloat: open.openingFloat,
        cashRevenue: r.cashRevenue,
        movements,
      });
    }

    return NextResponse.json({
      session: open,
      registerState,
      isStale: registerState === 'stale',
      ...stats,
      cashMovements: movements,
      cashIn: drawer.cashIn,
      cashOut: drawer.cashOut,
      expectedCash: drawer.expected,
    });
  } catch (err) {
    // An uncaught throw here used to 500 with an HTML error page, which left
    // the POS gate stuck on "Checking register…" with no retry path.
    console.error('[pos/sessions GET]', err);
    return NextResponse.json({ error: 'Failed to load register session' }, { status: 500 });
  }
}

// POST /api/pos/sessions — open a new session
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const openingFloat = parseFloat(body.openingFloat ?? '0');
  /* Null, not 0, when the cashier skips MoMo. A zero we invented looks
     authoritative and quietly makes the first close wrong by whatever was
     actually in the wallet. */
  const openingMomo =
    body.openingMomo === undefined || body.openingMomo === null || body.openingMomo === ''
      ? null
      : parseFloat(body.openingMomo);
  const forceCloseStale = body.forceCloseStale === true;

  try {
    const posSession = await prisma.$transaction(async (tx) => {
      const existing = await tx.posSession.findFirst({
        where: { status: 'OPEN' },
        include: { openedByUser: { select: { id: true, name: true } } },
      });

      if (existing) {
        const stale = classifyRegisterSession(existing.openedAt) === 'stale';
        if (!stale) {
          throw Object.assign(new Error('A session is already open'), { status: 409 });
        }
        if (!forceCloseStale) {
          throw Object.assign(new Error('Stale session must be closed before opening a new shift'), { status: 409, code: 'STALE_OPEN' });
        }
        const role = (session.user as any).role as UserRole;
        if (!canForceCloseStale(role)) {
          throw Object.assign(new Error('Only a manager can close a stale shift'), { status: 403 });
        }
        await tx.posSession.update({
          where: { id: existing.id },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closedBy: session.user.id!,
            notes: existing.notes
              ? `${existing.notes}\nAuto-closed stale session before new shift.`
              : 'Auto-closed stale session before new shift.',
          },
        });
      }

      return tx.posSession.create({
        data: {
          openedBy: session.user.id!,
          openingFloat,
          openingMomo,
          status: 'OPEN',
          notes: body.notes ?? null,
        },
        include: { openedByUser: { select: { id: true, name: true } } },
      });
    });

    return NextResponse.json(posSession);
  } catch (err: any) {
    const status = err?.status ?? 500;
    if (status !== 500) {
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error('[pos/sessions POST]', err);
    return NextResponse.json({ error: 'Failed to open session' }, { status: 500 });
  }
}

// PATCH /api/pos/sessions — close the current session
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    sessionId,
    closingCash,
    closingMomo,
    closingBolt,
    cashCount,
    notes,
  } = body;

  const pos = await prisma.posSession.findUnique({
    where: { id: sessionId },
    include: { openedByUser: { select: { id: true, name: true } } },
  });
  if (!pos || pos.status !== 'OPEN') {
    return NextResponse.json({ error: 'Session not found or already closed' }, { status: 404 });
  }

  const isStale = classifyRegisterSession(pos.openedAt) === 'stale';
  const role = (session.user as any).role as UserRole;
  if (!canCloseSession(role, pos.openedBy, session.user.id!, isStale)) {
    return NextResponse.json(
      { error: isStale ? 'Ask a manager to close this stale shift' : 'You can only close your own shift' },
      { status: 403 },
    );
  }

  const orders = await prisma.order.findMany({
    where: { sessionId, status: 'COMPLETED', isDemo: false },
    select: { total: true, paymentMethod: true, splitPayments: true },
  });

  const { revenue: totalRevenue, cashRevenue, momoRevenue, boltRevenue } = calcRevenue(orders as any);

  /* Cash that left or entered the drawer without being a sale has to be in
     the expected figure, or a shift that paid GH₵50 for gas reads as GH₵50
     missing and the cashier is asked to explain a hole they already logged. */
  const movements = await prisma.cashMovement.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, direction: true, amount: true, reason: true, createdAt: true,
      user: { select: { name: true } },
    },
  });
  const drawer = drawerTotals({
    openingFloat: pos.openingFloat,
    cashRevenue,
    movements: movements.map(m => ({ direction: m.direction, amount: m.amount })),
  });

  const expectedCash = drawer.expected;
  const wallet = walletTotals({ openingMomo: pos.openingMomo, momoRevenue });
  const expectedMomo = wallet.expected;
  const actualCash = parseFloat(closingCash ?? '0');
  const actualMomo = closingMomo != null && closingMomo !== '' ? parseFloat(closingMomo) : expectedMomo;
  const actualBolt = closingBolt != null && closingBolt !== '' ? parseFloat(closingBolt) : boltRevenue;

  const revenueByMethod: Record<string, number> = {
    CASH: cashRevenue, MOMO: momoRevenue, BOLT_FOOD: boltRevenue,
  };
  for (const o of orders) {
    if (o.paymentMethod !== 'SPLIT' && o.paymentMethod !== 'CASH' &&
        o.paymentMethod !== 'MOMO' && o.paymentMethod !== 'BOLT_FOOD') {
      revenueByMethod[o.paymentMethod] = (revenueByMethod[o.paymentMethod] ?? 0) + Number(o.total);
    }
  }

  const closed = await prisma.posSession.update({
    where: { id: sessionId },
    data: {
      closedAt: new Date(),
      closedBy: session.user.id!,
      closingCash: actualCash,
      closingMomo: actualMomo,
      closingBolt: actualBolt,
      expectedCash,
      expectedMomo,
      cashCount: cashCount ?? undefined,
      status: 'CLOSED',
      notes: notes ?? null,
    },
    include: {
      openedByUser: { select: { name: true } },
      closedByUser: { select: { name: true } },
    },
  });

  return NextResponse.json({
    session: closed,
    summary: {
      orderCount: orders.length,
      totalRevenue,
      revenueByMethod,
      // The printed shift report shows the running sum, so it has to carry the
      // movements that produced the expected figure.
      openingFloat: Number(pos.openingFloat),
      openingMomo: wallet.openingMomo,
      cashIn: drawer.cashIn,
      cashOut: drawer.cashOut,
      cashMovements: movements.map(m => ({
        id: m.id,
        direction: m.direction,
        amount: Number(m.amount),
        reason: m.reason,
        by: m.user?.name ?? null,
        at: m.createdAt,
      })),
      cash:  { expected: expectedCash,  actual: actualCash, discrepancy: actualCash - expectedCash },
      momo:  { expected: expectedMomo,  actual: actualMomo, discrepancy: actualMomo - expectedMomo },
      bolt:  { expected: boltRevenue,   actual: actualBolt, discrepancy: actualBolt - boltRevenue },
      expectedCash,
      expectedMomo,
      closingCash: actualCash,
      discrepancy: actualCash - expectedCash,
    },
  });
}
