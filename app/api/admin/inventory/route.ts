import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';

const itemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.number().min(0),
  lowStockThreshold: z.number().min(0),
  costPerUnit: z.number().optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

const txSchema = z.object({
  itemId: z.string(),
  type: z.enum(['PURCHASE', 'USAGE', 'ADJUSTMENT', 'WASTE']),
  quantity: z.number(),
  unitCost: z.number().optional(),
  notes: z.string().optional(),
  reference: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const items = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      transactions: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Transaction log
  if (body.type === 'transaction') {
    const data = txSchema.parse(body);
    const tx = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: data.itemId } });
      if (!item) throw new Error('Item not found');

      const delta = ['PURCHASE', 'ADJUSTMENT'].includes(data.type)
        ? data.quantity
        : -Math.abs(data.quantity);

      const totalCost = data.unitCost ? data.quantity * data.unitCost : undefined;

      const [updated, log] = await Promise.all([
        tx.inventoryItem.update({
          where: { id: data.itemId },
          data: { quantity: { increment: delta } },
        }),
        tx.inventoryTransaction.create({
          data: {
            itemId: data.itemId,
            type: data.type as any,
            quantity: data.quantity,
            unitCost: data.unitCost,
            totalCost,
            notes: data.notes,
            reference: data.reference,
          },
        }),
      ]);
      return { item: updated, transaction: log };
    });
    return NextResponse.json(tx);
  }

  // Create item
  const data = itemSchema.parse(body);
  const item = await prisma.inventoryItem.create({ data: data as any });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, ...updates } = await req.json();
  const item = await prisma.inventoryItem.update({ where: { id }, data: updates });
  return NextResponse.json(item);
}
