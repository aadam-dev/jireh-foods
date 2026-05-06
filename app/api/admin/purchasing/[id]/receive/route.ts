import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';

// POST — receive goods against a PO, auto-update inventory
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!['OWNER', 'MANAGER', 'ACCOUNTANT'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { notes, lines } = body;
  // lines: [{ poLineId, qtyReceived }]

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: { lines: { include: { inventoryItem: true } } },
  });
  if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });
  if (po.status === 'RECEIVED') {
    return NextResponse.json({ error: 'PO is already fully received' }, { status: 409 });
  }

  const result = await prisma.$transaction(async (tx) => {
    // Create receipt header
    const receipt = await tx.poReceipt.create({
      data: {
        poId: po.id,
        receivedById: session.user.id!,
        notes: notes ?? null,
        lines: {
          create: lines.map((l: any) => {
            const poLine = po.lines.find(pl => pl.id === l.poLineId);
            return {
              poLineId: l.poLineId,
              inventoryItemId: poLine!.inventoryItemId,
              qtyReceived: parseFloat(l.qtyReceived),
              purchaseUnit: poLine!.purchaseUnit,
            };
          }),
        },
      },
      include: { lines: true },
    });

    // Update inventory and poLine receivedQty for each line
    for (const rl of lines) {
      const poLine = po.lines.find(pl => pl.id === rl.poLineId);
      if (!poLine) continue;

      const qtyReceived = parseFloat(rl.qtyReceived);
      const invItem = poLine.inventoryItem;

      // Convert purchase units → inventory units
      const conversionFactor = Number(invItem.conversionFactor ?? 1);
      const invQtyIncrease = qtyReceived * conversionFactor;

      // Update inventory quantity
      await tx.inventoryItem.update({
        where: { id: poLine.inventoryItemId },
        data: { quantity: { increment: invQtyIncrease } },
      });

      // Record stock movement
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

      // Update received qty on poLine
      await tx.poLine.update({
        where: { id: rl.poLineId },
        data: { receivedQty: { increment: qtyReceived } },
      });
    }

    // Refresh PO lines to determine new status
    const updatedLines = await tx.poLine.findMany({ where: { poId: po.id } });
    const allReceived = updatedLines.every(l => Number(l.receivedQty) >= Number(l.orderedQty));
    const anyReceived = updatedLines.some(l => Number(l.receivedQty) > 0);

    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: allReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : 'CONFIRMED',
        updatedAt: new Date(),
      },
    });

    return receipt;
  });

  return NextResponse.json(result);
}
