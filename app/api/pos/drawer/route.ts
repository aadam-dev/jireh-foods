import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';
import { roundMoney } from '@/src/lib/money';
import { logAudit } from '@/src/lib/audit';

/* Money crossing the register for a reason other than a sale.
   ────────────────────────────────────────────────────────────────────────────
   Any cashier may record one, deliberately: the person who actually handed over
   the money is the only one who can log it at the moment it happens. Gating this
   behind a manager would mean it simply never gets logged, and the drawer goes
   short anyway with nobody able to say why. Every row carries its actor, so the
   trail survives without the gate. */

/** Reasons that are genuinely a business cost, so they also reach the expense books. */
const EXPENSE_REASONS = new Set(['MARKET_RUN', 'EXPENSE', 'STAFF_PAYMENT']);

/** Transfers move value between tenders — one row per side, sharing a group id. */
const TRANSFERS: Record<string, { from: 'CASH' | 'MOMO'; to: 'CASH' | 'MOMO' }> = {
  CASH_TO_MOMO: { from: 'CASH', to: 'MOMO' },
  MOMO_TO_CASH: { from: 'MOMO', to: 'CASH' },
};

const bodySchema = z.object({
  sessionId: z.string().min(1),
  reason: z.enum([
    'MARKET_RUN', 'EXPENSE', 'OWNER_DRAWING', 'STAFF_PAYMENT',
    'FLOAT_TOP_UP', 'CASH_TO_MOMO', 'MOMO_TO_CASH', 'OTHER',
  ]),
  tender: z.enum(['CASH', 'MOMO']).default('CASH'),
  amount: z.coerce.number().positive('Enter an amount greater than zero.'),
  note: z.string().max(280).optional(),
  /** Optional expense category for reasons that post a cost. */
  expenseCategoryId: z.string().optional(),
});

/** Money added to the drawer rather than taken out. */
const INBOUND_REASONS = new Set(['FLOAT_TOP_UP']);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' }, { status: 400 });
  }
  const data = parsed.data;
  const amount = roundMoney(data.amount);

  const posSession = await prisma.posSession.findUnique({ where: { id: data.sessionId } });
  if (!posSession) return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
  if (posSession.status !== 'OPEN') {
    return NextResponse.json(
      { error: 'That shift is already closed. Money movements belong to an open shift.' },
      { status: 409 },
    );
  }

  const transfer = TRANSFERS[data.reason];
  const actorUserId = session.user.id!;

  const created = await prisma.$transaction(async tx => {
    /* A real cost also becomes an Expense, so the money is both explained on the
       shift and counted in "Are we making money?". Without this the cost would
       vanish from the books the moment the drawer balanced. */
    let expenseId: string | null = null;
    if (EXPENSE_REASONS.has(data.reason)) {
      const categoryId = data.expenseCategoryId
        ?? (await tx.expenseCategory.findFirst({ where: { isActive: true }, select: { id: true } }))?.id
        ?? (await tx.expenseCategory.create({ data: { name: 'Register payouts' }, select: { id: true } })).id;

      const expense = await tx.expense.create({
        data: {
          categoryId,
          description: data.note?.trim() || REASON_DESCRIPTIONS[data.reason],
          amount,
          paymentMethod: data.tender === 'MOMO' ? 'MOMO' : 'CASH',
          notes: `Recorded from the register during shift ${posSession.id}.`,
        },
        select: { id: true },
      });
      expenseId = expense.id;
    }

    if (transfer) {
      const transferGroupId = `xfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await tx.drawerMovement.createMany({
        data: [
          {
            sessionId: posSession.id, direction: 'OUT', tender: transfer.from,
            amount, reason: data.reason, note: data.note, actorUserId, transferGroupId,
          },
          {
            sessionId: posSession.id, direction: 'IN', tender: transfer.to,
            amount, reason: data.reason, note: data.note, actorUserId, transferGroupId,
          },
        ],
      });
      return tx.drawerMovement.findMany({ where: { transferGroupId } });
    }

    const row = await tx.drawerMovement.create({
      data: {
        sessionId: posSession.id,
        direction: INBOUND_REASONS.has(data.reason) ? 'IN' : 'OUT',
        tender: data.tender,
        amount,
        reason: data.reason,
        note: data.note,
        actorUserId,
        expenseId,
      },
    });
    return [row];
  });

  await logAudit({
    userId: actorUserId,
    action: transfer ? 'drawer_transfer' : (INBOUND_REASONS.has(data.reason) ? 'drawer_cash_in' : 'drawer_cash_out'),
    entity: 'PosSession',
    entityId: posSession.id,
    details: { reason: data.reason, tender: data.tender, amount, note: data.note ?? null },
  });

  return NextResponse.json({ movements: created });
}

const REASON_DESCRIPTIONS: Record<string, string> = {
  MARKET_RUN: 'Market run from the register',
  EXPENSE: 'Expense paid from the register',
  STAFF_PAYMENT: 'Staff payment from the register',
};

/** GET /api/pos/drawer?sessionId=… — movements for a shift, newest first. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

  const movements = await prisma.drawerMovement.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    include: { actor: { select: { name: true } } },
  });

  return NextResponse.json(
    movements.map(m => ({ ...m, amount: Number(m.amount) })),
  );
}
