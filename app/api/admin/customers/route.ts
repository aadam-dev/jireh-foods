import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';

// GET /api/admin/customers?phone=&name=&page=1
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as any).role;
  if (!['OWNER', 'MANAGER', 'ACCOUNTANT'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get('phone')?.trim();
  const name = searchParams.get('name')?.trim();
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = 20;

  if (!phone && !name) {
    return NextResponse.json({ customers: [], total: 0 });
  }

  const where: any = {
    isDemo: false,
    status: { not: 'CANCELLED' },
    OR: [
      ...(phone ? [{ customerPhone: { contains: phone } }] : []),
      ...(name ? [{ customerName: { contains: name, mode: 'insensitive' } }] : []),
    ],
  };

  try {
    // Get distinct customers (group by phone or name)
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        total: true,
        paymentMethod: true,
        createdAt: true,
        status: true,
        items: { select: { name: true, quantity: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.order.count({ where });

    // Group by phone to build customer profiles
    const profileMap = new Map<string, {
      key: string;
      name: string | null;
      phone: string | null;
      orderCount: number;
      totalSpend: number;
      lastOrder: string;
      orders: typeof orders;
    }>();

    for (const o of orders) {
      const key = o.customerPhone ?? o.customerName ?? o.id;
      const existing = profileMap.get(key);
      if (existing) {
        existing.orderCount++;
        existing.totalSpend += Number(o.total);
        existing.orders.push(o);
        if (new Date(o.createdAt) > new Date(existing.lastOrder)) {
          existing.lastOrder = o.createdAt.toISOString();
        }
      } else {
        profileMap.set(key, {
          key,
          name: o.customerName,
          phone: o.customerPhone,
          orderCount: 1,
          totalSpend: Number(o.total),
          lastOrder: o.createdAt.toISOString(),
          orders: [o],
        });
      }
    }

    return NextResponse.json({
      customers: Array.from(profileMap.values()),
      total,
      page,
    });
  } catch (err) {
    console.error('[customers GET]', err);
    return NextResponse.json({ error: 'Failed to search customers' }, { status: 500 });
  }
}
