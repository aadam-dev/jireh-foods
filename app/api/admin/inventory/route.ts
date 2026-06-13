import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { requireAuth, requireRoles, applyInventoryDelta } from '@/src/lib/api-auth';

const itemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.coerce.number().min(0),
  lowStockThreshold: z.coerce.number().min(0),
  costPerUnit: z.coerce.number().optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  purchaseUnit: z.string().optional(),
  conversionFactor: z.coerce.number().min(0.001).default(1),
});

const txSchema = z.object({
  itemId: z.string(),
  type: z.enum(['PURCHASE', 'USAGE', 'ADJUSTMENT', 'WASTE']),
  quantity: z.number(),
  unitCost: z.number().optional(),
  notes: z.string().optional(),
  reference: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER, UserRole.MANAGER]);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const withTransactions = searchParams.get('transactions') === '1';

  // Single item with full transaction history
  if (id && withTransactions) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ item, transactions: item.transactions });
  }

  // All items list
  const items = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const session = authResult;

  const body = await req.json();

  const isInventoryTx =
    typeof body?.itemId === 'string' &&
    ['PURCHASE', 'USAGE', 'ADJUSTMENT', 'WASTE'].includes(body?.type);

  if (isInventoryTx) {
    const forbidden = requireRoles(session.user.role, [UserRole.OWNER, UserRole.MANAGER]);
    if (forbidden) return forbidden;
  } else {
    const forbidden = requireRoles(session.user.role, [UserRole.OWNER, UserRole.MANAGER]);
    if (forbidden) return forbidden;
  }

  // Transaction log (distinct from creating a new stock item — no itemId + tx type on new items)
  if (isInventoryTx) {
    const data = txSchema.parse(body);
    try {
      const delta = data.type === 'ADJUSTMENT'
        ? data.quantity
        : data.type === 'PURCHASE'
          ? Math.abs(data.quantity)
          : -Math.abs(data.quantity);

      const txResult = await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findUnique({ where: { id: data.itemId } });
        if (!item) throw Object.assign(new Error('Item not found'), { status: 404 });

        await applyInventoryDelta(tx, data.itemId, delta);

        const totalCost = data.unitCost ? Math.abs(data.quantity) * data.unitCost : undefined;
        const log = await tx.inventoryTransaction.create({
          data: {
            itemId: data.itemId,
            type: data.type as any,
            quantity: Math.abs(data.quantity),
            unitCost: data.unitCost,
            totalCost,
            notes: data.notes,
            reference: data.reference,
          },
        });
        const updated = await tx.inventoryItem.findUnique({ where: { id: data.itemId } });
        return { item: updated, transaction: log };
      });
      return NextResponse.json(txResult);
    } catch (err: any) {
      const status = err?.status ?? 500;
      if (status !== 500) return NextResponse.json({ error: err.message }, { status });
      throw err;
    }
  }

  // Create item — OWNER/MANAGER only
  const role = (session.user as any).role;
  if (!['OWNER', 'MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const data = itemSchema.parse(body);
  const item = await prisma.inventoryItem.create({ data: data as any });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER, UserRole.MANAGER]);
  if (forbidden) return forbidden;

  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: 'Item ID required' }, { status: 400 });

  const data = itemSchema.partial().parse(updates);
  const item = await prisma.inventoryItem.update({ where: { id }, data: data as any });
  return NextResponse.json(item);
}
