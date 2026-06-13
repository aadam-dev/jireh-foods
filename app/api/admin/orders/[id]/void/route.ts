import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { logAudit } from '@/src/lib/audit';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { requireAuth, requireRoles, applyInventoryDelta } from '@/src/lib/api-auth';

const voidSchema = z.object({
  reason: z.string().min(3, 'Reason required (min 3 chars)'),
  restockInventory: z.boolean().default(true),
});

// POST /api/admin/orders/[id]/void — void a completed order (OWNER/MANAGER only)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER, UserRole.MANAGER]);
  if (forbidden) return forbidden;

  try {
    const body = await req.json();
    const parsed = voidSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { reason, restockInventory } = parsed.data;

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: true },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Order is already voided/cancelled' }, { status: 400 });
    }
    if (order.isDemo) {
      return NextResponse.json({ error: 'Cannot void demo orders' }, { status: 400 });
    }

    const shouldRestock = restockInventory && order.status === 'COMPLETED';

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'FAILED',
          notes: order.notes
            ? `${order.notes} | VOIDED: ${reason}`
            : `VOIDED: ${reason}`,
        },
      });

      if (shouldRestock) {
        for (const item of order.items) {
          const bom = await tx.bom.findFirst({
            where: { menuItemId: item.menuItemId, isActive: true },
            include: { lines: true },
          });
          if (!bom) continue;

          for (const line of bom.lines) {
            const restoreQty = Number(line.quantity) * item.quantity;
            await applyInventoryDelta(tx, line.inventoryItemId, restoreQty);
            await tx.inventoryTransaction.create({
              data: {
                itemId: line.inventoryItemId,
                type: 'ADJUSTMENT',
                quantity: restoreQty,
                notes: `Restocked — order ${order.orderNumber} voided: ${reason}`,
                reference: order.id,
              },
            });
          }
        }
      }
    });

    await logAudit({
      userId: authResult.user.id,
      action: 'VOID',
      entity: 'Order',
      entityId: order.id,
      details: {
        orderNumber: order.orderNumber,
        total: Number(order.total),
        reason,
        restockInventory: shouldRestock,
      },
      req,
    });

    return NextResponse.json({ success: true, orderNumber: order.orderNumber });
  } catch (err: any) {
    console.error('[orders/void]', err);
    return NextResponse.json({ error: 'Failed to void order' }, { status: 500 });
  }
}
