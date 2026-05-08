import { NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 29); thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [todayOrders, yesterdayOrders, monthOrders, recentOrders, thirtyDayOrders, activeSession, topItems, allInventory] =
    await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: todayStart }, status: 'COMPLETED', isDemo: false },
        select: { total: true, paymentMethod: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: yesterdayStart, lt: todayStart }, status: 'COMPLETED', isDemo: false },
        select: { total: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: monthStart }, status: 'COMPLETED', isDemo: false },
        select: { total: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: todayStart }, isDemo: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
          staff: { select: { name: true } },
        },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: thirtyDaysAgo }, status: 'COMPLETED', isDemo: false },
        select: { total: true, createdAt: true },
      }),
      prisma.posSession.findFirst({
        where: { status: 'OPEN' },
        include: { openedByUser: { select: { name: true } }, _count: { select: { orders: true } } },
      }),
      prisma.orderItem.groupBy({
        by: ['name'],
        where: { order: { createdAt: { gte: monthStart }, status: 'COMPLETED', isDemo: false } },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 8,
      }),
      prisma.inventoryItem.findMany({ where: { isActive: true } }),
    ]);

  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total), 0);
  const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + Number(o.total), 0);
  const revenueTrend = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;
  const monthRevenue = monthOrders.reduce((s, o) => s + Number(o.total), 0);

  const paymentMix: Record<string, number> = {};
  for (const o of todayOrders) {
    paymentMix[o.paymentMethod] = (paymentMix[o.paymentMethod] ?? 0) + Number(o.total);
  }

  // Build 30-day trend
  const revMap: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo); d.setDate(thirtyDaysAgo.getDate() + i);
    revMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const o of thirtyDayOrders) {
    const day = new Date(o.createdAt).toISOString().slice(0, 10);
    if (day in revMap) revMap[day] += Number(o.total);
  }
  const trendChart = Object.entries(revMap).map(([date, revenue]) => ({ date, revenue }));

  const lowStockAlerts = allInventory
    .filter(i => Number(i.quantity) <= Number(i.lowStockThreshold))
    .sort((a, b) => Number(a.quantity) - Number(b.quantity))
    .slice(0, 10);

  const stockValue = allInventory.reduce(
    (s, i) => s + Number(i.quantity) * Number(i.costPerUnit ?? 0), 0,
  );

  return NextResponse.json({
    today: { revenue: todayRevenue, orders: todayOrders.length, revenueTrend: Math.round(revenueTrend * 10) / 10 },
    month: { revenue: monthRevenue, orders: monthOrders.length },
    paymentMix,
    trendChart,
    recentOrders,
    lowStockAlerts,
    activeSession,
    topItems: topItems.map(i => ({ name: i.name, qty: i._sum.quantity ?? 0, revenue: Number(i._sum.subtotal ?? 0) })),
    stockValue,
  });
}
