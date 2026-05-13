import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';

const ALLOWED_ROLES = ['OWNER', 'MANAGER', 'ACCOUNTANT'];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as any).role;
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || format(new Date(), 'yyyy-MM');
  const [year, m] = month.split('-').map(Number);
  const start = startOfMonth(new Date(year, m - 1));
  const end = endOfMonth(new Date(year, m - 1));

  const [orders, expenses, payroll, sessions] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' }, isDemo: false },
      include: { items: { include: { menuItem: { select: { costPrice: true, name: true } } } } },
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      include: { category: true },
    }),
    prisma.payrollRecord.findMany({
      where: { periodStart: { gte: start, lte: end }, status: { not: 'DRAFT' } },
      include: { user: { select: { name: true } } },
    }),
    prisma.posSession.findMany({
      where: { openedAt: { gte: start, lte: end } },
      include: {
        openedByUser: { select: { name: true } },
        closedByUser: { select: { name: true } },
      },
      orderBy: { openedAt: 'desc' },
    }),
  ]);

  // Revenue
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);

  // COGS
  const cogs = orders.reduce((s, o) => {
    return s + o.items.reduce((is, item) => {
      const cost = Number(item.menuItem.costPrice ?? 0);
      return is + cost * item.quantity;
    }, 0);
  }, 0);

  const grossProfit = totalRevenue - cogs;

  // Expenses
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const expenseByCategory = expenses.reduce((acc: Record<string, number>, e) => {
    const cat = e.category.name;
    acc[cat] = (acc[cat] || 0) + Number(e.amount);
    return acc;
  }, {});

  // Payroll
  const totalPayroll = payroll.reduce((s, p) => s + Number(p.netPay), 0);

  const netProfit = grossProfit - totalExpenses - totalPayroll;

  // Daily sales for chart
  const days = eachDayOfInterval({ start, end });
  const dailySales = days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayOrders = orders.filter(o => format(new Date(o.createdAt), 'yyyy-MM-dd') === dayStr);
    return {
      date: format(day, 'dd MMM'),
      revenue: dayOrders.reduce((s, o) => s + Number(o.total), 0),
      orders: dayOrders.length,
    };
  });

  // Payment method breakdown
  const paymentBreakdown = orders.reduce((acc: Record<string, number>, o) => {
    const method = o.paymentMethod;
    acc[method] = (acc[method] || 0) + Number(o.total);
    return acc;
  }, {});

  // Top items by quantity and revenue
  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const order of orders) {
    for (const item of order.items) {
      const name = item.menuItem?.name ?? 'Unknown';
      if (!itemMap[name]) itemMap[name] = { name, qty: 0, revenue: 0 };
      itemMap[name].qty += item.quantity;
      itemMap[name].revenue += item.quantity * Number((item as any).unitPrice ?? 0);
    }
  }
  const topItems = Object.values(itemMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Sessions with summary
  const sessionData = sessions.map(s => {
    const sessionOrders = orders.filter(o => (o as any).sessionId === s.id);
    const sessionRevenue = sessionOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const cashRevenue = sessionOrders
      .filter(o => o.paymentMethod === 'CASH')
      .reduce((sum, o) => sum + Number(o.total), 0);
    const expectedCash = Number(s.openingFloat) + cashRevenue;
    const closingCash = s.closingCash ? Number(s.closingCash) : null;
    const discrepancy = closingCash !== null ? closingCash - expectedCash : null;
    const durationMs = s.closedAt
      ? new Date(s.closedAt).getTime() - new Date(s.openedAt).getTime()
      : null;
    const durationHours = durationMs ? durationMs / 1000 / 60 / 60 : null;

    return {
      id: s.id,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      status: s.status,
      openedBy: s.openedByUser?.name ?? '—',
      closedBy: s.closedByUser?.name,
      openingFloat: Number(s.openingFloat),
      closingCash,
      sessionRevenue,
      cashRevenue,
      expectedCash,
      discrepancy,
      orderCount: sessionOrders.length,
      durationHours,
    };
  });

  return NextResponse.json({
    period: { start: start.toISOString(), end: end.toISOString(), month },
    summary: {
      totalRevenue,
      cogs,
      grossProfit,
      grossMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      totalExpenses,
      totalPayroll,
      netProfit,
      totalOrders: orders.length,
    },
    expenseByCategory,
    paymentBreakdown,
    dailySales,
    topItems,
    sessions: sessionData,
    payrollRecords: payroll,
  });
}
