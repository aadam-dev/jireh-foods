import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { requireAuth, requireRoles, applyInventoryDelta } from '@/src/lib/api-auth';

const receiveLineSchema = z.object({
  poLineId: z.string().min(1),
  qtyReceived: z.coerce.number().positive(),
});

const receiveSchema = z.object({
  notes: z.string().optional(),
  lines: z.array(receiveLineSchema).min(1),
});

const RECEIVABLE_STATUSES = ['CONFIRMED', 'PARTIALLY_RECEIVED'];

// POST — receive goods against a PO, auto-update inventory
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER, UserRole.MANAGER]);
  if (forbidden) return forbidden;

  const parsed = receiveSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { notes, lines } = parsed.data;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: { lines: { include: { inventoryItem: true } } },
  });
  if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });
  if (po.status === 'RECEIVED') {
    return NextResponse.json({ error: 'PO is already fully received' }, { status: 409 });
  }
  if (!RECEIVABLE_STATUSES.includes(po.status)) {
    return NextResponse.json({ error: 'PO must be confirmed before receiving goods' }, { status: 400 });
  }

  for (const line of lines) {
    const poLine = po.lines.find(pl => pl.id === line.poLineId);
    if (!poLine) {
      return NextResponse.json({ error: `Invalid PO line: ${line.poLineId}` }, { status: 400 });
    }
    const remaining = Number(poLine.orderedQty) - Number(poLine.receivedQty);
    if (line.qtyReceived > remaining + 0.0001) {
      return NextResponse.json({
        error: `Cannot receive ${line.qtyReceived} — only ${remaining} remaining on line`,
      }, { status: 400 });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.poReceipt.create({
        data: {
          poId: po.id,
          receivedById: authResult.user.id,
          notes: notes ?? null,
          lines: {
            create: lines.map((l) => {
              const poLine = po.lines.find(pl => pl.id === l.poLineId)!;
              return {
                poLineId: l.poLineId,
                inventoryItemId: poLine.inventoryItemId,
                qtyReceived: l.qtyReceived,
                purchaseUnit: poLine.purchaseUnit,
              };
            }),
          },
        },
        include: { lines: true },
      });

      for (const rl of lines) {
        const poLine = po.lines.find(pl => pl.id === rl.poLineId)!;
        const qtyReceived = rl.qtyReceived;
        const invItem = poLine.inventoryItem;
        const conversionFactor = Number(invItem.conversionFactor ?? 1);
        const invQtyIncrease = qtyReceived * conversionFactor;

        await applyInventoryDelta(tx, poLine.inventoryItemId, invQtyIncrease);

        await tx.inventoryTransaction.create({
          data: {
            itemId: poLine.inventoryItemId,
            type: 'PURCHASE',
            quantity: invQtyIncrease,
            unitCost: Number(poLine.unitPrice) / conversionFactor,
            totalCost: Number(poLine.unitPrice) * qtyReceived,
            notes: `Received from PO ${po.poNumber}`,
            reference: po.id,
          },
        });

        await tx.poLine.update({
          where: { id: rl.poLineId },
          data: { receivedQty: { increment: qtyReceived } },
        });
      }

      const updatedLines = await tx.poLine.findMany({ where: { poId: po.id } });
      const allReceived = updatedLines.every(l => Number(l.receivedQty) >= Number(l.orderedQty));
      const anyReceived = updatedLines.some(l => Number(l.receivedQty) > 0);

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: allReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : po.status,
          updatedAt: new Date(),
        },
      });

      return receipt;
    });

    return NextResponse.json(result);
  } catch (err: any) {
    const status = err?.status ?? 500;
    if (status !== 500) return NextResponse.json({ error: err.message }, { status });
    console.error('[purchasing/receive]', err);
    return NextResponse.json({ error: 'Failed to receive goods' }, { status: 500 });
  }
}
