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
  paymentMethod: z.enum(['CASH', 'MOMO', 'CARD', 'BANK_TRANSFER', 'UNPAID']),
  deliveryType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).default('DINE_IN'),
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

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      status: 'COMPLETED',
      source: 'POS',
      paymentMethod: data.paymentMethod as any,
      paymentStatus: data.paymentMethod === 'UNPAID' ? 'PENDING' : 'PAID',
      deliveryType: data.deliveryType as any,
      subtotal,
      total: subtotal,
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
    include: {
      items: true,
      staff: { select: { name: true } },
    },
  });

  return NextResponse.json(order);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get('staffId');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: {
      source: 'POS',
      createdAt: { gte: today },
      ...(staffId ? { staffId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { items: true },
  });

  return NextResponse.json(orders);
}
