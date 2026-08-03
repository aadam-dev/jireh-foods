import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { UserRole } from '@prisma/client';
import { requireAuth, requireRoles } from '@/src/lib/api-auth';

/* The "Today" cockpit follows the day of service: morning (prep & market),
   service (rush), night (close & count). Every figure here answers a question
   an owner actually asks, so the shapes are deliberately plain-language. */

/** Restaurants are weekly-cyclical — comparing to yesterday is noise. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** An order sitting unserved this long is worth flagging. */
const STALE_ORDER_MINUTES = 20;

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT]);
  if (forbidden) return forbidden;

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  // Same weekday last week, same window of the day
  const lastWeekStart = new Date(todayStart.getTime() - WEEK_MS);
  const lastWeekEnd = new Date(now.getTime() - WEEK_MS);

  // Week so far — Monday-based, matching how the kitchen thinks about a week
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 29); thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [
    todayOrders, lastWeekSameDayOrders, monthOrders, recentOrders, thirtyDayOrders,
    activeSession, staleSessions, topItemsMonth, topItemsToday, allInventory,
    weekOrders, weekExpenses, weekOrderItems, openOrders, unavailableItems, duePayroll,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: todayStart }, status: 'COMPLETED', isDemo: false },
      select: { total: true, paymentMethod: true, source: true, deliveryType: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: lastWeekStart, lte: lastWeekEnd }, status: 'COMPLETED', isDemo: false },
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
    // Shifts left open from a previous day — cash is unaccounted for until closed
    prisma.posSession.findMany({
      where: { status: 'OPEN', openedAt: { lt: todayStart } },
      include: { openedByUser: { select: { name: true } } },
    }),
    prisma.orderItem.groupBy({
      by: ['name'],
      where: { order: { createdAt: { gte: monthStart }, status: 'COMPLETED', isDemo: false } },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 8,
    }),
    prisma.orderItem.groupBy({
      by: ['name'],
      where: { order: { createdAt: { gte: todayStart }, status: 'COMPLETED', isDemo: false } },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 1,
    }),
    prisma.inventoryItem.findMany({ where: { isActive: true } }),
    prisma.order.findMany({
      where: { createdAt: { gte: weekStart }, status: 'COMPLETED', isDemo: false },
      select: { total: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: weekStart } },
      select: { amount: true },
    }),
    // Everything sold this week, so ingredient cost can be derived from recipes
    prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: { order: { createdAt: { gte: weekStart }, status: 'COMPLETED', isDemo: false } },
      _sum: { quantity: true },
    }),
    prisma.order.findMany({
      where: { status: { in: ['PENDING', 'PREPARING'] }, isDemo: false },
      orderBy: { createdAt: 'asc' },
      select: { id: true, orderNumber: true, status: true, createdAt: true, total: true },
    }),
    prisma.menuItem.findMany({
      where: { isAvailable: false },
      select: { id: true, name: true, category: { select: { name: true } } },
    }),
    prisma.payrollRecord.findMany({
      where: { status: { in: ['DRAFT', 'APPROVED'] }, periodEnd: { lte: now } },
      include: { user: { select: { name: true } } },
      orderBy: { periodEnd: 'asc' },
      take: 5,
    }),
  ]);

  const sum = (rows: { total: unknown }[]) => rows.reduce((s, r) => s + Number(r.total), 0);

  const todayRevenue = sum(todayOrders);
  const lastWeekRevenue = sum(lastWeekSameDayOrders);
  const revenueTrend = lastWeekRevenue > 0
    ? ((todayRevenue - lastWeekRevenue) / lastWeekRevenue) * 100
    : null;
  const monthRevenue = sum(monthOrders);
  const weekRevenue = sum(weekOrders);
  const averageTicket = todayOrders.length > 0 ? todayRevenue / todayOrders.length : 0;

  const paymentMix: Record<string, number> = {};
  const channelMix: Record<string, { orders: number; revenue: number }> = {};
  for (const o of todayOrders) {
    paymentMix[o.paymentMethod] = (paymentMix[o.paymentMethod] ?? 0) + Number(o.total);
    const channel = o.source;
    channelMix[channel] ??= { orders: 0, revenue: 0 };
    channelMix[channel].orders += 1;
    channelMix[channel].revenue += Number(o.total);
  }

  /* ── Money left = collected − ingredient cost − expenses ─────────────────
     Ingredient cost comes from each sold item's recipe (BOM) priced at the
     current cost per unit. Items without a recipe contribute 0, so the figure
     is understated until every plate is costed — the UI says so plainly. */
  const soldMenuItemIds = weekOrderItems.map(i => i.menuItemId);
  const boms = soldMenuItemIds.length
    ? await prisma.bom.findMany({
        where: { menuItemId: { in: soldMenuItemIds }, isActive: true },
        include: { lines: { include: { inventoryItem: { select: { costPerUnit: true } } } } },
      })
    : [];

  const costPerMenuItem = new Map<string, number>();
  for (const bom of boms) {
    const plateCost = bom.lines.reduce(
      (s, line) => s + Number(line.quantity) * Number(line.inventoryItem.costPerUnit ?? 0), 0,
    );
    costPerMenuItem.set(bom.menuItemId, plateCost);
  }

  let weekIngredientCost = 0;
  let costedUnits = 0;
  let totalUnits = 0;
  for (const row of weekOrderItems) {
    const qty = Number(row._sum.quantity ?? 0);
    totalUnits += qty;
    const unitCost = costPerMenuItem.get(row.menuItemId);
    if (unitCost !== undefined) {
      weekIngredientCost += unitCost * qty;
      costedUnits += qty;
    }
  }

  const weekExpenseTotal = weekExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const moneyLeft = weekRevenue - weekIngredientCost - weekExpenseTotal;
  const recipeCoverage = totalUnits > 0 ? Math.round((costedUnits / totalUnits) * 100) : 0;

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
    .slice(0, 10)
    .map(i => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      quantity: Number(i.quantity),
      threshold: Number(i.lowStockThreshold),
      costPerUnit: Number(i.costPerUnit ?? 0),
      /** Rough restock quantity to get back above par. */
      suggestedQty: Math.max(0, Number(i.lowStockThreshold) * 2 - Number(i.quantity)),
    }));

  const stockValue = allInventory.reduce(
    (s, i) => s + Number(i.quantity) * Number(i.costPerUnit ?? 0), 0,
  );

  const staleOrders = openOrders
    .filter(o => (now.getTime() - new Date(o.createdAt).getTime()) / 60000 > STALE_ORDER_MINUTES)
    .map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: Number(o.total),
      waitingMinutes: Math.round((now.getTime() - new Date(o.createdAt).getTime()) / 60000),
    }));

  // Yesterday's close, so the screen is useful before the first sale of the day
  const yesterdayOrders = await prisma.order.findMany({
    where: { createdAt: { gte: yesterdayStart, lt: todayStart }, status: 'COMPLETED', isDemo: false },
    select: { total: true },
  });

  return NextResponse.json({
    serverTime: now.toISOString(),
    today: {
      revenue: todayRevenue,
      orders: todayOrders.length,
      averageTicket,
      revenueTrend: revenueTrend === null ? null : Math.round(revenueTrend * 10) / 10,
      lastWeekSameDayRevenue: lastWeekRevenue,
      topSeller: topItemsToday[0]
        ? { name: topItemsToday[0].name, qty: Number(topItemsToday[0]._sum.quantity ?? 0) }
        : null,
    },
    yesterday: { revenue: yesterdayOrders.reduce((s, o) => s + Number(o.total), 0), orders: yesterdayOrders.length },
    week: {
      revenue: weekRevenue,
      ingredientCost: weekIngredientCost,
      expenses: weekExpenseTotal,
      moneyLeft,
      recipeCoverage,
      startDate: weekStart.toISOString(),
    },
    month: { revenue: monthRevenue, orders: monthOrders.length },
    channelMix,
    paymentMix,
    trendChart,
    recentOrders,
    lowStockAlerts,
    activeSession,
    attention: {
      staleShifts: staleSessions.map(s => ({
        id: s.id,
        openedAt: s.openedAt,
        openedBy: s.openedByUser?.name ?? 'Unknown',
      })),
      staleOrders,
      unavailableItems: unavailableItems.map(i => ({
        id: i.id, name: i.name, category: i.category?.name ?? '',
      })),
      duePayroll: duePayroll.map(p => ({
        id: p.id, name: p.user?.name ?? 'Staff', netPay: Number(p.netPay),
        periodEnd: p.periodEnd, status: p.status,
      })),
    },
    topItems: topItemsMonth.map(i => ({
      name: i.name, qty: Number(i._sum.quantity ?? 0), revenue: Number(i._sum.subtotal ?? 0),
    })),
    stockValue,
  });
}
