import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { z, ZodError } from 'zod';
import { generateOrderNumber } from '@/src/lib/utils';
import { getTaxRate, isInventoryTrackingEnabled } from '@/src/lib/settings';
import { logAudit } from '@/src/lib/audit';
import { buildTransactionSnapshot, recordOrderEvent } from '@/src/lib/order-events';
import { computeOrderTotals, sumMoney, lineTotal, changeDue, moneyEquals } from '@/src/lib/money';
import { cleanName, nameKey, normalisePhone, isUsablePhone } from '@/src/lib/customer';

/* Attach the sale to a reusable customer record, creating one on first sight.
   ────────────────────────────────────────────────────────────────────────────
   Runs inside the order transaction so a sale and its customer land together
   or not at all. Matching order:
     1. a usable phone — the same number is the same person, whatever was typed
        in the name box that day, and the name on file is refreshed
     2. otherwise the normalised name
   A half-typed phone ("0241") is treated as no phone rather than claiming the
   unique slot. Returns null for a walk-in: no name, no row, no phantom
   "Walk-in" customer at the top of every suggestion list. */
async function resolveCustomer(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  rawName?: string | null,
  rawPhone?: string | null,
): Promise<string | null> {
  const name = cleanName(rawName);
  const phone = isUsablePhone(rawPhone) ? normalisePhone(rawPhone) : null;
  if (!name && !phone) return null;

  if (phone) {
    const existing = await tx.customer.findUnique({ where: { phone }, select: { id: true, name: true } });
    if (existing) {
      /* Adopt a genuinely different spelling on a later visit ("Kwame" →
         "Kwame Mensah"), but ignore pure case and spacing churn — otherwise
         one cashier typing in caps renames the customer for everybody, and
         the name in the list flips about between visits. A blank never wipes
         the name on file. */
      if (name && nameKey(name) !== nameKey(existing.name)) {
        await tx.customer.update({ where: { id: existing.id }, data: { name, nameKey: nameKey(name) } });
      }
      return existing.id;
    }
  }

  if (name) {
    const byName = await tx.customer.findFirst({
      where: { nameKey: nameKey(name) },
      select: { id: true, phone: true },
    });
    if (byName) {
      // Someone known by name alone has now given a number — record it, but
      // never overwrite a number already there.
      if (phone && !byName.phone) {
        await tx.customer.update({ where: { id: byName.id }, data: { phone } });
      }
      return byName.id;
    }
  }

  const created = await tx.customer.create({
    data: { name: name || phone!, nameKey: nameKey(name || phone!), phone },
    select: { id: true },
  });
  return created.id;
}

const orderItemSchema = z.object({
  menuItemId: z.string(),
  name: z.string(),
  // coerce: Prisma Decimal serialises to string in JSON; the POS re-sends it as-is
  price: z.coerce.number(),
  quantity: z.coerce.number().int().positive(),
  notes: z.string().optional(),
  // allow subtotal passthrough (cart persisted items may include it)
  subtotal: z.coerce.number().optional(),
  /* Chosen modifiers, by option id only. The client never gets to say what an
     extra costs — deltas are looked up server-side, exactly like base prices. */
  modifierOptionIds: z.array(z.string()).optional(),
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
  /* Nullable as well as optional: a walk-in is expressed as an absent name,
     and callers express "absent" both ways — the register omits the key, an
     explicit null arrives from anything serialising the whole form. Rejecting
     null here would fail the commonest sale there is. */
  customerName: z.string().max(80).nullable().optional(),
  customerPhone: z.string().max(30).nullable().optional(),
  notes: z.string().optional(),
  // Split payment legs — required when paymentMethod === 'SPLIT'
  splitPayments: z.array(splitLegSchema).optional(),
  /* Where the order came from. Defaults to the register; the intake screen
     passes ONLINE or BOLT so channel mix on the dashboard stays honest. */
  source: z.enum(['POS', 'ONLINE', 'BOLT', 'WALK_IN']).default('POS'),
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

  /* An UNPAID ticket takes no money, so it does not need an open drawer — a
     WhatsApp order can be logged at 9am before the register is opened, and is
     settled later against whichever shift is running then. */
  const takesMoney = data.paymentMethod !== 'UNPAID';

  if (!isItAdmin && takesMoney) {
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

  /* ── Modifier verification ────────────────────────────────────────────
     Look up every referenced option so the price delta and the display name
     both come from the database, never from the request body. Unknown or
     unavailable options are rejected rather than silently dropped — a ticket
     that prints "Extra chicken" the kitchen never charged for is worse than
     an error at the register. */
  const requestedOptionIds = Array.from(
    new Set(data.items.flatMap(i => i.modifierOptionIds ?? [])),
  );

  const optionMap = new Map<string, { id: string; name: string; priceDelta: number; groupName: string }>();
  if (requestedOptionIds.length > 0) {
    const options = await prisma.modifierOption.findMany({
      where: { id: { in: requestedOptionIds }, isAvailable: true },
      include: { group: { select: { name: true } } },
    });
    for (const o of options) {
      optionMap.set(o.id, {
        id: o.id,
        name: o.name,
        priceDelta: Number(o.priceDelta),
        groupName: o.group.name,
      });
    }
    const missing = requestedOptionIds.filter(id => !optionMap.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'One of the selected options is no longer available. Rebuild the item and try again.' },
        { status: 400 },
      );
    }
  }

  // Build verified items using canonical DB prices (base + verified modifiers)
  const verifiedItems = data.items.map(item => {
    const dbItem = priceMap.get(item.menuItemId)!;
    const chosen = (item.modifierOptionIds ?? []).map(id => optionMap.get(id)!);
    const modifierTotal = chosen.reduce((s, o) => s + o.priceDelta, 0);
    return {
      ...item,
      // Line price includes the extras, so subtotal/tax/BOM all stay consistent.
      price: Number(dbItem.price) + modifierTotal,
      name: dbItem.name,
      chosenModifiers: chosen,
    };
  });

  // Ghana Composite Levy — rate pulled from Settings table (set via /admin/settings)
  const taxRate = await getTaxRate();
  const preDiscountSubtotal = sumMoney(verifiedItems.map(i => lineTotal(i.price, i.quantity)));
  if ((data.discountAmount ?? 0) > preDiscountSubtotal) {
    return NextResponse.json(
      { error: 'Discount cannot exceed the order subtotal' },
      { status: 400 }
    );
  }
  /* One definition of the bill, shared with the register — see src/lib/money.ts.
     Every step rounds to whole pesewas so change owed and split-payment checks
     never disagree with what the customer was shown. */
  const { subtotal, discountAmount, taxableAmount, taxAmount, total } = computeOrderTotals({
    lines: verifiedItems.map(i => ({ price: i.price, quantity: i.quantity })),
    discountAmount: data.discountAmount ?? 0,
    taxRate,
  });

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
  // Inventory tracking is OFF by default (informal business). The OWNER turns it
  // on in Settings once recipes (BOMs) + stock counts are entered. Only then do
  // sales deduct ingredients.
  const trackInventory = await isInventoryTrackingEnabled();

  // Run order creation + BOM deductions atomically
  const order = await prisma.$transaction(async (tx) => {
    const customerId = await resolveCustomer(tx, data.customerName, data.customerPhone);

    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        clientRef: data.clientRef ?? null,
        /* An unpaid ticket has been sent to the kitchen but not settled, so it
           must NOT be COMPLETED — that is exactly what keeps it on the open
           tickets rail until someone takes the money. */
        status: data.paymentMethod === 'UNPAID' ? 'PREPARING' : 'COMPLETED',
        source: data.source,
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
        customerId,
        customerName: cleanName(data.customerName) || null,
        customerPhone: data.customerPhone || null,
        notes: data.notes,
        staffId: session.user.id,
        isDemo,
        items: {
          create: verifiedItems.map(item => ({
            menuItemId: item.menuItemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            subtotal: lineTotal(item.price, item.quantity),
            notes: item.notes,
            modifiers: item.chosenModifiers.length
              ? {
                  create: item.chosenModifiers.map(o => ({
                    optionId: o.id,
                    groupName: o.groupName,
                    name: o.name,
                    priceDelta: o.priceDelta,
                  })),
                }
              : undefined,
          })),
        },
      },
      include: { items: { include: { modifiers: true } }, staff: { select: { name: true } } },
    });

    // BOM deductions — only when inventory tracking is ON (and not a demo order).
    // Defaults OFF; sales are recorded normally with no stock impact until the
    // OWNER enables tracking in Settings.
    if (!isDemo && trackInventory) {
      for (const item of data.items) {
        const bom = await tx.bom.findFirst({
          where: { menuItemId: item.menuItemId, isActive: true },
          include: { lines: { include: { inventoryItem: true } } },
        });
        if (!bom) continue;

        for (const line of bom.lines) {
          const deductQty = Number(line.quantity) * item.quantity;
          // Allow-but-flag: NEVER block a paying customer over a possibly-stale
          // count. Negative stock is permitted and surfaced as an "Oversold"
          // badge in Inventory. Do NOT use applyInventoryDelta() here — that
          // guard throws 409 on negative and is only for manual admin
          // adjustments / PO receipts, not the live sale path.
          await tx.inventoryItem.update({
            where: { id: line.inventoryItemId },
            data: { quantity: { decrement: deductQty } },
          });
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

    const snapshot = buildTransactionSnapshot({
      orderNumber: created.orderNumber,
      clientRef: created.clientRef,
      staff: created.staff
        ? { id: session.user.id, name: created.staff.name }
        : { id: session.user.id, name: (session.user as any).name ?? 'Staff' },
      sessionId: created.sessionId,
      items: created.items,
      subtotal: created.subtotal,
      discountAmount: created.discountAmount,
      taxAmount: created.taxAmount,
      total: created.total,
      paymentMethod: created.paymentMethod,
      paymentStatus: created.paymentStatus,
      paymentRef: created.paymentRef,
      splitPayments: created.splitPayments,
      tenderedAmount: created.tenderedAmount,
      changeAmount: created.changeAmount,
      deliveryType: created.deliveryType,
      customerName: created.customerName,
      customerPhone: created.customerPhone,
      notes: created.notes,
    });

    await tx.order.update({
      where: { id: created.id },
      data: { transactionSnapshot: snapshot as any },
    });

    await recordOrderEvent(tx, {
      orderId: created.id,
      type: 'CREATED',
      actorUserId: session.user.id,
      payload: {
        source: 'POS',
        paymentMethod: data.paymentMethod,
        total: Number(created.total),
        isDemo,
      },
    });

    return { ...created, transactionSnapshot: snapshot };
  });

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
  /* Open tickets: sent to the kitchen but not yet paid — the dine-in rail.
     Not date-bounded, because a table that sat through midnight still has to
     be settled in the morning. */
  const openOnly = req.nextUrl.searchParams.get('open') === '1';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: {
      // The open rail covers every channel — a WhatsApp order still has to be
      // cooked and settled. Today's register list stays POS-only.
      // When scoped to a sessionId (shift report / till copy), drop the date
      // bound — a shift that ran past midnight still has to print every sale.
      ...(openOnly ? {} : { source: 'POS' as const }),
      isDemo: false,
      ...(openOnly
        ? { paymentStatus: 'PENDING', status: { notIn: ['COMPLETED', 'CANCELLED'] } }
        : sessionId
          ? {}
          : { createdAt: { gte: today } }),
      ...(staffId ? { staffId } : {}),
      ...(sessionId ? { sessionId } : {}),
    },
    orderBy: { createdAt: openOnly ? 'asc' : 'desc' },
    take: 100,
    include: {
      items: { include: { modifiers: true } },
      staff: { select: { name: true } },
    },
  });

  return NextResponse.json(orders);
}

const settleSchema = z.object({
  orderId: z.string().min(1),
  paymentMethod: z.enum(['CASH', 'MOMO', 'BOLT_FOOD', 'CARD', 'BANK_TRANSFER', 'SPLIT']),
  paymentRef: z.string().optional(),
  tenderedAmount: z.coerce.number().optional(),
  splitPayments: z.array(splitLegSchema).optional(),
});

/* PATCH /api/pos/orders — settle an open ticket.
   Payment only. Line items are deliberately immutable here: once a ticket has
   gone to the kitchen, changing what was cooked is a void-and-reorder, not an
   edit, so the audit trail stays honest. */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = settleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' }, { status: 400 });
  }
  const data = parsed.data;

  const order = await prisma.order.findUnique({ where: { id: data.orderId } });
  if (!order) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  if (order.paymentStatus === 'PAID') {
    return NextResponse.json({ error: 'This ticket has already been paid.' }, { status: 409 });
  }
  if (order.status === 'CANCELLED') {
    return NextResponse.json({ error: 'This ticket was voided.' }, { status: 409 });
  }

  const total = Number(order.total);

  if (data.paymentMethod === 'SPLIT') {
    if (!data.splitPayments || data.splitPayments.length < 2) {
      return NextResponse.json({ error: 'Split payment requires at least 2 payment legs.' }, { status: 400 });
    }
    const splitTotal = data.splitPayments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(splitTotal - total) > 0.01) {
      return NextResponse.json(
        { error: `Split legs must add up to ${total.toFixed(2)}.` },
        { status: 400 },
      );
    }
  }

  const cashLeg = data.paymentMethod === 'SPLIT'
    ? data.splitPayments?.find(p => p.method === 'CASH')
    : undefined;
  const tendered = cashLeg ? cashLeg.amount : data.tenderedAmount;
  const changeAmount = data.paymentMethod === 'CASH' && tendered != null
    ? Math.max(0, tendered - total)
    : 0;

  // Payment and its audit event land together or not at all.
  const settled = await prisma.$transaction(async tx => {
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentMethod: data.paymentMethod as any,
        paymentStatus: 'PAID',
        paymentRef: data.paymentRef ?? null,
        tenderedAmount: data.tenderedAmount ?? null,
        changeAmount,
        splitPayments: data.splitPayments ? (data.splitPayments as any) : undefined,
        status: 'COMPLETED',
      },
      include: { items: { include: { modifiers: true } }, staff: { select: { name: true } } },
    });

    await recordOrderEvent(tx, {
      orderId: order.id,
      type: 'PAYMENT_UPDATED',
      actorUserId: session.user.id,
      payload: { paymentMethod: data.paymentMethod, total },
    });

    return updated;
  });

  return NextResponse.json(settled);
}
