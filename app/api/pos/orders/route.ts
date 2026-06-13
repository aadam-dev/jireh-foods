import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { z, ZodError } from 'zod';
import { generateOrderNumber } from '@/src/lib/utils';
import { getTaxRate } from '@/src/lib/settings';
import { logAudit } from '@/src/lib/audit';
import { applyInventoryDelta } from '@/src/lib/api-auth';

const orderItemSchema = z.object({
  menuItemId: z.string(),
  name: z.string(),
  // coerce: Prisma Decimal serialises to string in JSON; the POS re-sends it as-is
  price: z.coerce.number(),
  quantity: z.coerce.number().int().positive(),
  notes: z.string().optional(),
  // allow subtotal passthrough (cart persisted items may include it)
  subtotal: z.coerce.number().optional(),
});

// A single leg of a split payment: method + amount + optional ref
const splitLegSchema = z.object({
  method: z.enum(['CASH', 'MOMO', 'BOLT_FOOD', 'CARD', 'BANK_TRANSFER']),
  amount: z.coerce.number().positive(),
  ref: z.string().optional(),
});

const createOrderSchema = z.object({
  // Idempotency key from the POS — dedupes offline re-sync and double-taps.
  clientRef: z.string().max(64).optional(),
  items: z.array(orderItemSchema).min(1),
  paymentMethod: z.enum(['CASH', 'MOMO', 'BOLT_FOOD', 'CARD', 'BANK_TRANSFER', 'UNPAID', 'SPLIT']),
  deliveryType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).default('TAKEAWAY'),
  paymentRef: z.string().optional(),
  tenderedAmount: z.coerce.number().optional(),
  discountAmount: z.coerce.number().default(0),
  sessionId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
  // Split payment legs — required when paymentMethod === 'SPLIT'
  splitPayments: z.array(splitLegSchema).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? 'Invalid request body';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const data = parsed.data;

  // ── Idempotency ─────────────────────────────────────────────────────
  // If the POS sent a clientRef and an order with it already exists, return
  // that order instead of creating a duplicate. This makes offline re-sync
  // and accidental double-taps safe (no double order, no double stock
  // deduction — the Odoo "lost/duplicated order" class of bug).
  if (data.clientRef) {
    const existing = await prisma.order.findUnique({
      where: { clientRef: data.clientRef },
      include: { items: true, staff: { select: { name: true } } },
    });
    if (existing) return NextResponse.json(existing); // 200, already processed
  }

  // IT admin demo account — orders are isolated from real sales data
  const userEmail = ((session.user as any).email ?? '').toLowerCase();
  const isItAdmin = userEmail === 'it@jireh.com';

  if (!isItAdmin) {
    // Real orders require an active open session
    if (!data.sessionId) {
      return NextResponse.json(
        { error: 'No open shift. Please open a session before placing orders.' },
        { status: 400 }
      );
    }
    const posSession = await prisma.posSession.findUnique({ where: { id: data.sessionId } });
    if (!posSession || posSession.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Session is closed. Please open a new shift to place orders.' },
        { status: 400 }
      );
    }
  }

  // ── Server-side price verification ──────────────────────────────────
  // Never trust client-sent prices — always look up from DB
  const menuItemIds = data.items.map(i => i.menuItemId);
  const dbMenuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, isAvailable: true },
    select: { id: true, price: true, name: true },
  });
  const priceMap = new Map(dbMenuItems.map(i => [i.id, i]));

  for (const item of data.items) {
    if (!priceMap.has(item.menuItemId)) {
      return NextResponse.json(
        { error: `Item "${item.name}" is not available` },
        { status: 400 }
      );
    }
  }

  // Build verified items using canonical DB prices
  const verifiedItems = data.items.map(item => {
    const dbItem = priceMap.get(item.menuItemId)!;
    return { ...item, price: Number(dbItem.price), name: dbItem.name };
  });

  const subtotal = verifiedItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountAmount = Math.min(data.discountAmount ?? 0, subtotal); // cap at subtotal
  if ((data.discountAmount ?? 0) > subtotal) {
    return NextResponse.json(
      { error: 'Discount cannot exceed the order subtotal' },
      { status: 400 }
    );
  }
  const taxableAmount = subtotal - discountAmount;
  // Ghana Composite Levy — rate pulled from Settings table (set via /admin/settings)
  const taxRate = await getTaxRate();
  const taxAmount = taxableAmount * taxRate;
  const total = taxableAmount + taxAmount;

  // ── Split payment validation ─────────────────────────────────────────
  if (data.paymentMethod === 'SPLIT') {
    if (!data.splitPayments || data.splitPayments.length < 2) {
      return NextResponse.json(
        { error: 'Split payment requires at least 2 payment legs.' },
        { status: 400 }
      );
    }
    const splitTotal = data.splitPayments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(splitTotal - total) > 0.01) {
      return NextResponse.json(
        { error: `Split amounts (GH₵${splitTotal.toFixed(2)}) must equal order total (GH₵${total.toFixed(2)}).` },
        { status: 400 }
      );
    }
  }

  // For single-method cash: compute change. For split: cash leg handles change.
  const cashLeg = data.paymentMethod === 'SPLIT'
    ? data.splitPayments?.find(p => p.method === 'CASH')
    : null;
  const tenderedForChange = cashLeg ? cashLeg.amount : data.tenderedAmount;
  const cashTotal = data.paymentMethod === 'SPLIT'
    ? (cashLeg?.amount ?? 0)
    : data.paymentMethod === 'CASH' ? total : 0;
  const changeAmount = tenderedForChange != null && data.paymentMethod !== 'SPLIT'
    ? Math.max(0, tenderedForChange - total)
    : undefined;

  const isDemo = isItAdmin; // demo orders are excluded from all revenue reporting

  // Run order creation + BOM deductions atomically
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        clientRef: data.clientRef ?? null,
        status: 'COMPLETED',
        source: 'POS',
        paymentMethod: data.paymentMethod as any,
        paymentStatus: data.paymentMethod === 'UNPAID' ? 'PENDING' : 'PAID',
        paymentRef: data.paymentRef ?? null,
        deliveryType: data.deliveryType as any,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        tenderedAmount: data.tenderedAmount ?? null,
        splitPayments: data.splitPayments ? (data.splitPayments as any) : undefined,
        changeAmount: changeAmount ?? null,
        sessionId: data.sessionId ?? null,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        notes: data.notes,
        staffId: session.user.id,
        isDemo,
        items: {
          create: verifiedItems.map(item => ({
            menuItemId: item.menuItemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity,
            notes: item.notes,
          })),
        },
      },
      include: { items: true, staff: { select: { name: true } } },
    });

    // BOM deductions — skip for demo orders (no real inventory impact)
    if (!isDemo) {
      for (const item of data.items) {
        const bom = await tx.bom.findFirst({
          where: { menuItemId: item.menuItemId, isActive: true },
          include: { lines: { include: { inventoryItem: true } } },
        });
        if (!bom) continue;

        for (const line of bom.lines) {
          const deductQty = Number(line.quantity) * item.quantity;
          await applyInventoryDelta(tx, line.inventoryItemId, -deductQty);
          await tx.inventoryTransaction.create({
            data: {
              itemId: line.inventoryItemId,
              type: 'USAGE',
              quantity: deductQty,
              notes: `Auto-deducted for order ${created.orderNumber}`,
              reference: created.id,
            },
          });
        }
      }
    }

    return created;
  });
  } catch (err: any) {
    if (err?.status === 409) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  // Audit — fire-and-forget, never blocks the response
  void logAudit({
    userId: session.user.id,
    action: 'CREATE',
    entity: 'Order',
    entityId: order.id,
    details: { orderNumber: order.orderNumber, total: Number(order.total), paymentMethod: data.paymentMethod, isDemo },
    req,
  });

  return NextResponse.json(order);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const staffId = req.nextUrl.searchParams.get('staffId');
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: {
      source: 'POS',
      isDemo: false,
      createdAt: { gte: today },
      ...(staffId ? { staffId } : {}),
      ...(sessionId ? { sessionId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { items: true, staff: { select: { name: true } } },
  });

  return NextResponse.json(orders);
}
