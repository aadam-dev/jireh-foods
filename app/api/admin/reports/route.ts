import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || format(new Date(), 'yyyy-MM');
  const [year, m] = month.split('-').map(Number);
  const start = startOfMonth(new Date(year, m - 1));
  const end = endOfMonth(new Date(year, m - 1));

  const [orders, expenses, payroll] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
      include: { items: { include: { menuItem: { select: { costPrice: true } } } } },
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      include: { category: true },
    }),
    prisma.payrollRecord.findMany({
      where: { periodStart: { gte: start, lte: end }, status: { not: 'DRAFT' } },
      include: { user: { select: { name: true } } },
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
    payrollRecords: payroll,
  });
}
