import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { logAudit } from '@/src/lib/audit';
import { z } from 'zod';
import { UserRole, VoidInventoryAction, VoidReason } from '@prisma/client';
import { requireAuth, requireRoles, applyInventoryDelta } from '@/src/lib/api-auth';
import { recordOrderEvent } from '@/src/lib/order-events';

const voidSchema = z.object({
  voidReason: z.nativeEnum(VoidReason),
  reasonDetail: z.string().optional(),
  inventoryAction: z.nativeEnum(VoidInventoryAction).default(VoidInventoryAction.RESTOCK),
}).superRefine((data, ctx) => {
  if (data.voidReason === VoidReason.OTHER && (!data.reasonDetail || data.reasonDetail.trim().length < 3)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Please provide details when reason is Other (min 3 chars)',
      path: ['reasonDetail'],
    });
  }
});

function formatVoidReason(voidReason: VoidReason, reasonDetail?: string) {
  const labels: Record<VoidReason, string> = {
    CUSTOMER_CANCELLED: 'Customer cancelled',
    NO_SHOW: 'Customer no-show',
    WRONG_ORDER: 'Wrong order',
    DUPLICATE: 'Duplicate order',
    QUALITY_ISSUE: 'Quality issue',
    OTHER: reasonDetail?.trim() || 'Other',
  };
  return labels[voidReason];
}

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

    const { voidReason, reasonDetail, inventoryAction } = parsed.data;
    const reasonText = formatVoidReason(voidReason, reasonDetail);

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

    const shouldRestock = inventoryAction === VoidInventoryAction.RESTOCK && order.status === 'COMPLETED';
    const shouldRecordWaste = inventoryAction === VoidInventoryAction.WASTE && order.status === 'COMPLETED';

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'FAILED',
          voidReason,
          voidInventoryAction: inventoryAction,
          notes: order.notes
            ? `${order.notes} | VOIDED: ${reasonText}`
            : `VOIDED: ${reasonText}`,
        },
      });

      if (shouldRestock || shouldRecordWaste) {
        for (const item of order.items) {
          const bom = await tx.bom.findFirst({
            where: { menuItemId: item.menuItemId, isActive: true },
            include: { lines: true },
          });
          if (!bom) continue;

          for (const line of bom.lines) {
            const qty = Number(line.quantity) * item.quantity;

            if (shouldRestock) {
              await applyInventoryDelta(tx, line.inventoryItemId, qty);
              await tx.inventoryTransaction.create({
                data: {
                  itemId: line.inventoryItemId,
                  type: 'ADJUSTMENT',
                  quantity: qty,
                  notes: `Restocked — order ${order.orderNumber} voided: ${reasonText}`,
                  reference: order.id,
                },
              });
            } else if (shouldRecordWaste) {
              await tx.inventoryTransaction.create({
                data: {
                  itemId: line.inventoryItemId,
                  type: 'WASTE',
                  quantity: qty,
                  notes: `Waste — order ${order.orderNumber} voided (${reasonText}); stock not restored`,
                  reference: order.id,
                },
              });
            }
          }
        }
      }

      await recordOrderEvent(tx, {
        orderId: order.id,
        type: 'VOIDED',
        actorUserId: authResult.user.id,
        reason: reasonText,
        payload: {
          voidReason,
          reasonDetail: reasonDetail?.trim() || null,
          inventoryAction,
          previousStatus: order.status,
          total: Number(order.total),
        },
      });
    });

    await logAudit({
      userId: authResult.user.id,
      action: 'VOID',
      entity: 'Order',
      entityId: order.id,
      details: {
        orderNumber: order.orderNumber,
        total: Number(order.total),
        voidReason,
        reason: reasonText,
        inventoryAction,
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
