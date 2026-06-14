import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { requireAuth, requireResource } from '@/src/lib/api-auth';
import { logAudit } from '@/src/lib/audit';
import { recordOrderEvent } from '@/src/lib/order-events';

const ALLOWED_PATCH_ROLES = ['OWNER', 'MANAGER'];

const patchOrderSchema = z.object({
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED']).optional(),
  notes: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireResource('orders');
  if (authResult instanceof NextResponse) return authResult;

  const order = await prisma.order.findUnique({
    where: { id: params.id, isDemo: false },
    include: {
      items: { include: { menuItem: { select: { name: true } } } },
      staff: { select: { id: true, name: true, email: true } },
      session: {
        select: {
          id: true,
          openedAt: true,
          closedAt: true,
          status: true,
          openingFloat: true,
          openedByUser: { select: { name: true } },
        },
      },
      events: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, name: true } } },
      },
    },
  });

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const role = authResult.user.role;
  if (!ALLOWED_PATCH_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  try {
    const existing = await prisma.order.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    if (parsed.data.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Use the void endpoint to cancel orders — a reason and inventory action are required.' },
        { status: 400 }
      );
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: params.id },
        data: parsed.data,
        include: { items: true },
      });

      if (parsed.data.status && parsed.data.status !== existing.status) {
        await recordOrderEvent(tx, {
          orderId: params.id,
          type: 'STATUS_CHANGED',
          actorUserId: authResult.user.id,
          payload: {
            from: existing.status,
            to: parsed.data.status,
          },
        });
      }

      if (parsed.data.notes !== undefined && parsed.data.notes !== existing.notes) {
        await recordOrderEvent(tx, {
          orderId: params.id,
          type: 'NOTE_ADDED',
          actorUserId: authResult.user.id,
          payload: { notes: parsed.data.notes },
        });
      }

      if (parsed.data.paymentStatus && parsed.data.paymentStatus !== existing.paymentStatus) {
        await recordOrderEvent(tx, {
          orderId: params.id,
          type: 'PAYMENT_UPDATED',
          actorUserId: authResult.user.id,
          payload: {
            from: existing.paymentStatus,
            to: parsed.data.paymentStatus,
          },
        });
      }

      return updated;
    });

    void logAudit({
      userId: authResult.user.id,
      action: 'UPDATE',
      entity: 'Order',
      entityId: order.id,
      details: { orderNumber: order.orderNumber, changes: parsed.data },
      req,
    });

    return NextResponse.json(order);
  } catch (err: any) {
    if (err?.code === 'P2025') return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    console.error('[orders/[id] PATCH]', err);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.user.role !== UserRole.OWNER && authResult.user.role !== UserRole.MANAGER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const order = await prisma.order.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  return NextResponse.json(
    {
      error: 'Direct delete is disabled. Use POST /api/admin/orders/[id]/void with a reason and inventory action.',
    },
    { status: 410 }
  );
}
