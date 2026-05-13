import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { logAudit } from '@/src/lib/audit';
import { z } from 'zod';

const voidSchema = z.object({
  reason: z.string().min(3, 'Reason required (min 3 chars)'),
  restockInventory: z.boolean().default(true),
});

// POST /api/admin/orders/[id]/void — void a completed order (OWNER/MANAGER only)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as any).role;
  if (!['OWNER', 'MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = voidSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { reason, restockInventory } = parsed.data;

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        items: true,
      },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Order is already voided/cancelled' }, { status: 400 });
    }
    if (order.isDemo) {
      return NextResponse.json({ error: 'Cannot void demo orders' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Mark order as cancelled
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

      // Re-stock inventory via BOM reversal if requested
      if (restockInventory) {
        for (const item of order.items) {
          const bom = await tx.bom.findFirst({
            where: { menuItemId: item.menuItemId, isActive: true },
            include: { lines: true },
          });
          if (!bom) continue;

          for (const line of bom.lines) {
            const restoreQty = Number(line.quantity) * item.quantity;
            await tx.inventoryItem.update({
              where: { id: line.inventoryItemId },
              data: { quantity: { increment: restoreQty } },
            });
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
      userId: session.user.id,
      action: 'VOID',
      entity: 'Order',
      entityId: order.id,
      details: {
        orderNumber: order.orderNumber,
        total: Number(order.total),
        reason,
        restockInventory,
      },
      req,
    });

    return NextResponse.json({ success: true, orderNumber: order.orderNumber });
  } catch (err: any) {
    console.error('[orders/void]', err);
    return NextResponse.json({ error: 'Failed to void order' }, { status: 500 });
  }
}
