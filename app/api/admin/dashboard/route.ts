import { NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { startOfDay, subDays, startOfMonth } from 'date-fns';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const today = startOfDay(new Date());
    const yesterday = startOfDay(subDays(new Date(), 1));
    const monthStart = startOfMonth(new Date());

    const [
      todayOrders, yesterdayOrders, monthOrders,
      pendingCount, recentOrders, lowStockItems,
    ] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: today }, status: { not: 'CANCELLED' } },
        select: { total: true, status: true, source: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: yesterday, lt: today }, status: { not: 'CANCELLED' } },
        select: { total: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
        select: { total: true },
      }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          staff: { select: { name: true } },
          items: { include: { menuItem: { select: { name: true } } } },
        },
      }),
      prisma.inventoryItem.findMany({
        where: { isActive: true },
        select: { id: true, name: true, quantity: true, lowStockThreshold: true, unit: true },
      }),
    ]);

    const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total), 0);
    const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + Number(o.total), 0);
    const monthRevenue = monthOrders.reduce((s, o) => s + Number(o.total), 0);
    const revenueTrend = yesterdayRevenue === 0 ? 0
      : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;

    const alertItems = lowStockItems.filter(i => Number(i.quantity) <= Number(i.lowStockThreshold));

    return NextResponse.json({
      today: {
        revenue: todayRevenue,
        orders: todayOrders.length,
        pending: pendingCount,
        revenueTrend,
      },
      month: { revenue: monthRevenue, orders: monthOrders.length },
      recentOrders,
      lowStockAlerts: alertItems,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
