import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';

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

// GET /api/pos/sessions — current open session (if any)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const open = await prisma.posSession.findFirst({
    where: { status: 'OPEN' },
    include: {
      openedByUser: { select: { id: true, name: true } },
      _count: { select: { orders: true } },
    },
    orderBy: { openedAt: 'desc' },
  });

  // Compute session revenue (handles SPLIT orders via calcRevenue)
  let stats = { revenue: 0, cashRevenue: 0, momoRevenue: 0, boltRevenue: 0 };
  if (open) {
    const orders = await prisma.order.findMany({
      where: { sessionId: open.id, status: 'COMPLETED', isDemo: false },
      select: { total: true, paymentMethod: true, splitPayments: true },
    });
    const r = calcRevenue(orders as any);
    stats = { revenue: r.revenue, cashRevenue: r.cashRevenue, momoRevenue: r.momoRevenue, boltRevenue: r.boltRevenue };
  }

  return NextResponse.json({ session: open, ...stats });
}

// POST /api/pos/sessions — open a new session
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check for existing open session
  const existing = await prisma.posSession.findFirst({ where: { status: 'OPEN' } });
  if (existing) {
    return NextResponse.json({ error: 'A session is already open' }, { status: 409 });
  }

  const body = await req.json();
  const openingFloat = parseFloat(body.openingFloat ?? '0');

  const posSession = await prisma.posSession.create({
    data: {
      openedBy: session.user.id!,
      openingFloat,
      status: 'OPEN',
      notes: body.notes ?? null,
    },
    include: { openedByUser: { select: { id: true, name: true } } },
  });

  return NextResponse.json(posSession);
}

// PATCH /api/pos/sessions — close the current session
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    sessionId,
    closingCash,
    closingMomo,   // actual MoMo received (entered by staff at close)
    closingBolt,   // actual Bolt Food received (entered by staff at close)
    notes,
  } = body;

  const pos = await prisma.posSession.findUnique({ where: { id: sessionId } });
  if (!pos || pos.status !== 'OPEN') {
    return NextResponse.json({ error: 'Session not found or already closed' }, { status: 404 });
  }

  // Compute expected amounts per payment method before closing (handles SPLIT)
  const orders = await prisma.order.findMany({
    where: { sessionId, status: 'COMPLETED', isDemo: false },
    select: { total: true, paymentMethod: true, splitPayments: true },
  });

  const { revenue: totalRevenue, cashRevenue, momoRevenue, boltRevenue } = calcRevenue(orders as any);

  const expectedCash = Number(pos.openingFloat) + cashRevenue;
  const actualCash = parseFloat(closingCash ?? '0');
  const actualMomo = closingMomo != null ? parseFloat(closingMomo) : momoRevenue;
  const actualBolt = closingBolt != null ? parseFloat(closingBolt) : boltRevenue;

  // revenueByMethod for the summary display
  const revenueByMethod: Record<string, number> = {
    CASH: cashRevenue, MOMO: momoRevenue, BOLT_FOOD: boltRevenue,
  };
  // Add any other methods (CARD, BANK_TRANSFER etc.) from non-split orders
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
      // Per-method expected vs actual (for reconciliation display)
      cash:  { expected: expectedCash,  actual: actualCash, discrepancy: actualCash - expectedCash },
      momo:  { expected: momoRevenue,   actual: actualMomo, discrepancy: actualMomo - momoRevenue },
      bolt:  { expected: boltRevenue,   actual: actualBolt, discrepancy: actualBolt - boltRevenue },
      // Legacy fields kept so the existing closing-summary screen still works
      expectedCash,
      closingCash: actualCash,
      discrepancy: actualCash - expectedCash,
    },
  });
}
