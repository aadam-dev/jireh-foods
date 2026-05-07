import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';
import { generateOrderNumber } from '@/src/lib/utils';

const orderItemSchema = z.object({
  menuItemId: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  paymentMethod: z.enum(['CASH', 'MOMO', 'BOLT_FOOD', 'CARD', 'BANK_TRANSFER', 'UNPAID']),
  deliveryType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).default('DINE_IN'),
  paymentRef: z.string().optional(),
  tenderedAmount: z.number().optional(),
  discountAmount: z.number().default(0),
  sessionId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const data = createOrderSchema.parse(body);

  const subtotal = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountAmount = data.discountAmount ?? 0;
  const taxableAmount = subtotal - discountAmount;
  // Ghana Composite Levy — check settings, default disabled for startup
  const taxRate = 0; // Set to 0.15 when GRA registered
  const taxAmount = taxableAmount * taxRate;
  const total = taxableAmount + taxAmount;
  const changeAmount = data.tenderedAmount != null ? Math.max(0, data.tenderedAmount - total) : undefined;

  // Run order creation + BOM deductions atomically
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        status: 'COMPLETED',
        source: 'POS',
        paymentMethod: data.paymentMethod as any,
        paymentStatus: data.paymentMethod === 'UNPAID' ? 'PENDING' : 'PAID',
        paymentRef: data.paymentRef ?? null,
        deliveryType: data.deliveryType as any,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        tenderedAmount: data.tenderedAmount ?? null,
        changeAmount: changeAmount ?? null,
        sessionId: data.sessionId ?? null,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        notes: data.notes,
        staffId: session.user.id,
        items: {
          create: data.items.map(item => ({
            menuItemId: item.menuItemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity,
            notes: item.notes,
          })),
        },
      },
      include: { items: true, staff: { select: { name: true } } },
    });

    // BOM deductions — deduct ingredients for each sold item
    for (const item of data.items) {
      const bom = await tx.bom.findFirst({
        where: { menuItemId: item.menuItemId, isActive: true },
        include: { lines: { include: { inventoryItem: true } } },
      });
      if (!bom) continue;

      for (const line of bom.lines) {
        const deductQty = Number(line.quantity) * item.quantity;
        await tx.inventoryItem.update({
          where: { id: line.inventoryItemId },
          data: { quantity: { decrement: deductQty } },
        });
        await tx.inventoryTransaction.create({
          data: {
            itemId: line.inventoryItemId,
            type: 'USAGE',
            quantity: deductQty,
            notes: `Auto-deducted for order ${created.orderNumber}`,
            reference: created.id,
          },
        });
      }
    }

    return created;
  });

  return NextResponse.json(order);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get('staffId');
  const sessionId = searchParams.get('sessionId');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: {
      source: 'POS',
      createdAt: { gte: today },
      ...(staffId ? { staffId } : {}),
      ...(sessionId ? { sessionId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { items: true, staff: { select: { name: true } } },
  });

  return NextResponse.json(orders);
}
