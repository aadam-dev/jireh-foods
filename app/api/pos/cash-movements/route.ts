import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { logAudit } from '@/src/lib/audit';
import { z } from 'zod';

/* Money in and out of the drawer that is not a sale.
   ────────────────────────────────────────────────────────────────────────────
   Gas bought from the till, the owner taking cash, change brought in. Without
   a record these simply surface as a shortfall at close, which the manual
   already lists as a common innocent reason for a difference.

   Open to any till user, like the rest of /api/pos — the person who hands the
   money over is the cashier, and making them fetch a manager is how movements
   end up unrecorded. Every write is audited instead. */

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json([]);

  const movements = await prisma.cashMovement.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      direction: true,
      amount: true,
      reason: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });

  // Decimal serialises to string; the register does arithmetic on these.
  return NextResponse.json(movements.map(m => ({ ...m, amount: Number(m.amount) })));
}

const movementSchema = z.object({
  sessionId: z.string().min(1),
  direction: z.enum(['IN', 'OUT']),
  amount: z.coerce.number().positive('Enter an amount greater than zero'),
  /* Required, and trimmed so a row of spaces cannot pass for an explanation —
     an unexplained movement is exactly what this endpoint exists to prevent. */
  reason: z.string().trim().min(1, 'Say what the money was for').max(120),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = movementSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { sessionId, direction, amount, reason } = parsed.data;

  /* A movement against a closed shift would change a drawer that has already
     been counted and signed off, so the figures would no longer add up. */
  const posSession = await prisma.posSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true },
  });
  if (!posSession) return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
  if (posSession.status !== 'OPEN') {
    return NextResponse.json(
      { error: 'That shift is already closed. Cash movements belong to an open shift.' },
      { status: 409 },
    );
  }

  try {
    const movement = await prisma.cashMovement.create({
      data: { sessionId, direction, amount, reason, createdBy: session.user.id! },
      select: {
        id: true, direction: true, amount: true, reason: true, createdAt: true,
        user: { select: { name: true } },
      },
    });

    await logAudit({
      userId: session.user.id!,
      action: 'CREATE',
      entity: 'CashMovement',
      entityId: movement.id,
      details: { sessionId, direction, amount, reason },
      req,
    });

    return NextResponse.json({ ...movement, amount: Number(movement.amount) });
  } catch (err) {
    console.error('[pos/cash-movements POST]', err);
    return NextResponse.json({ error: 'Could not record that. Please try again.' }, { status: 500 });
  }
}
