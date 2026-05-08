import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';

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

  // Compute session revenue
  let revenue = 0;
  let cashRevenue = 0;
  if (open) {
    const orders = await prisma.order.findMany({
      where: { sessionId: open.id, status: 'COMPLETED', isDemo: false },
      select: { total: true, paymentMethod: true },
    });
    revenue = orders.reduce((s, o) => s + Number(o.total), 0);
    cashRevenue = orders
      .filter(o => o.paymentMethod === 'CASH')
      .reduce((s, o) => s + Number(o.total), 0);
  }

  return NextResponse.json({ session: open, revenue, cashRevenue });
}

// POST /api/pos/sessions — open a new session
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as any;
  if (!['OWNER', 'MANAGER', 'CASHIER'].includes(user.role)) {
    return NextResponse.json({ error: 'You do not have permission to manage shifts' }, { status: 403 });
  }

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

  const user = session.user as any;
  if (!['OWNER', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Only Owner/Manager can close a session' }, { status: 403 });
  }

  const body = await req.json();
  const { sessionId, closingCash, notes } = body;

  const pos = await prisma.posSession.findUnique({ where: { id: sessionId } });
  if (!pos || pos.status !== 'OPEN') {
    return NextResponse.json({ error: 'Session not found or already closed' }, { status: 404 });
  }

  // Compute expected cash before closing
  const orders = await prisma.order.findMany({
    where: { sessionId, status: 'COMPLETED', isDemo: false },
    select: { total: true, paymentMethod: true, paymentRef: true, tenderedAmount: true, changeAmount: true },
  });

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const cashRevenue = orders
    .filter(o => o.paymentMethod === 'CASH')
    .reduce((s, o) => s + Number(o.total), 0);
  const expectedCash = Number(pos.openingFloat) + cashRevenue;
  const discrepancy = parseFloat(closingCash) - expectedCash;

  const revenueByMethod: Record<string, number> = {};
  for (const o of orders) {
    revenueByMethod[o.paymentMethod] = (revenueByMethod[o.paymentMethod] ?? 0) + Number(o.total);
  }

  const closed = await prisma.posSession.update({
    where: { id: sessionId },
    data: {
      closedAt: new Date(),
      closedBy: session.user.id!,
      closingCash: parseFloat(closingCash),
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
      expectedCash,
      closingCash: parseFloat(closingCash),
      discrepancy,
    },
  });
}
