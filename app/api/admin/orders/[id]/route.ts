import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';

// Only OWNER and MANAGER may mutate order records
const ALLOWED_PATCH_ROLES = ['OWNER', 'MANAGER'];

// Strict field whitelist — financial fields (total, subtotal, items, etc.) are immutable via this endpoint
const patchOrderSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED']).optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as any).role;
  if (!ALLOWED_PATCH_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
  }

  // Reject empty updates
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  try {
    const order = await prisma.order.update({
      where: { id: params.id },
      data: parsed.data,
      include: { items: true },
    });
    return NextResponse.json(order);
  } catch (err: any) {
    if (err?.code === 'P2025') return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    console.error('[orders/[id] PATCH]', err);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (!['OWNER', 'MANAGER'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    await prisma.order.update({ where: { id: params.id }, data: { status: 'CANCELLED' } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.code === 'P2025') return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    console.error('[orders/[id] DELETE]', err);
    return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });
  }
}
