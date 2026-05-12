import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';
import * as XLSX from 'xlsx';

const ALLOWED_ROLES = ['OWNER', 'MANAGER', 'ACCOUNTANT'];

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash', MOMO: 'Mobile Money', BOLT_FOOD: 'Bolt Food',
  CARD: 'Card', BANK_TRANSFER: 'Bank Transfer', UNPAID: 'Unpaid',
};

function formatGHS(v: number) {
  return `GH₵ ${v.toFixed(2)}`;
}

// ─── Data fetching (shared between formats) ─────────────────────────────────
async function fetchReportData(month: string) {
  const [year, m] = month.split('-').map(Number);
  const start = startOfMonth(new Date(year, m - 1));
  const end = endOfMonth(new Date(year, m - 1));

  const [orders, expenses, payroll, sessions] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' }, isDemo: false },
      include: {
        items: { include: { menuItem: { select: { costPrice: true, name: true } } } },
        staff: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      include: { category: true },
      orderBy: { date: 'asc' },
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
        orders: { where: { status: { not: 'CANCELLED' }, isDemo: false }, select: { total: true, paymentMethod: true } },
      },
      orderBy: { openedAt: 'desc' },
    }),
  ]);

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const cogs = orders.reduce((s, o) => s + o.items.reduce((is, item) => is + Number(item.menuItem?.costPrice ?? 0) * item.quantity, 0), 0);
  const grossProfit = totalRevenue - cogs;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalPayroll = payroll.reduce((s, p) => s + Number(p.netPay), 0);
  const netProfit = grossProfit - totalExpenses - totalPayroll;

  const days = eachDayOfInterval({ start, end });
  const dailySales = days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayOrders = orders.filter(o => format(new Date(o.createdAt), 'yyyy-MM-dd') === dayStr);
    return {
      date: format(day, 'dd MMM yyyy'),
      orders: dayOrders.length,
      revenue: dayOrders.reduce((s, o) => s + Number(o.total), 0),
      discounts: dayOrders.reduce((s, o) => s + Number(o.discountAmount ?? 0), 0),
    };
  });

  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const order of orders) {
    for (const item of order.items) {
      const name = item.menuItem?.name ?? 'Unknown';
      if (!itemMap[name]) itemMap[name] = { name, qty: 0, revenue: 0 };
      itemMap[name].qty += item.quantity;
      itemMap[name].revenue += item.quantity * Number(item.price);
    }
  }
  const topItems = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);

  const paymentBreakdown = orders.reduce((acc: Record<string, number>, o) => {
    acc[o.paymentMethod] = (acc[o.paymentMethod] ?? 0) + Number(o.total);
    return acc;
  }, {});

  return {
    month, start, end,
    orders, expenses, payroll, sessions,
    summary: { totalRevenue, cogs, grossProfit, grossMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0, totalExpenses, totalPayroll, netProfit, totalOrders: orders.length },
    dailySales, topItems, paymentBreakdown,
  };
}

// ─── CSV builder ─────────────────────────────────────────────────────────────
function buildCSV(data: Awaited<ReturnType<typeof fetchReportData>>) {
  const { month, summary: s, dailySales, topItems, expenses, paymentBreakdown, sessions, payroll } = data;
  const lines: string[] = [];

  const row = (...cols: (string | number)[]) =>
    lines.push(cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));

  row(`Jireh Natural Foods — Monthly Report: ${month}`);
  row('');

  // P&L Summary
  row('── PROFIT & LOSS SUMMARY ──');
  row('Line', 'Amount (GH₵)');
  row('Revenue', s.totalRevenue.toFixed(2));
  row('Cost of Goods Sold (COGS)', (-s.cogs).toFixed(2));
  row('Gross Profit', s.grossProfit.toFixed(2));
  row('Gross Margin %', `${s.grossMargin.toFixed(1)}%`);
  row('Operating Expenses', (-s.totalExpenses).toFixed(2));
  row('Payroll', (-s.totalPayroll).toFixed(2));
  row('Net Profit / (Loss)', s.netProfit.toFixed(2));
  row('Total Orders', s.totalOrders);
  row('');

  // Payment breakdown
  row('── REVENUE BY PAYMENT METHOD ──');
  row('Method', 'Amount (GH₵)');
  for (const [method, amount] of Object.entries(paymentBreakdown)) {
    row(PAYMENT_LABELS[method] ?? method, amount.toFixed(2));
  }
  row('');

  // Daily sales
  row('── DAILY SALES ──');
  row('Date', 'Orders', 'Revenue (GH₵)', 'Discounts (GH₵)');
  for (const d of dailySales) {
    row(d.date, d.orders, d.revenue.toFixed(2), d.discounts.toFixed(2));
  }
  row('');

  // Top items
  row('── TOP MENU ITEMS ──');
  row('Item', 'Quantity Sold', 'Revenue (GH₵)');
  for (const item of topItems) {
    row(item.name, item.qty, item.revenue.toFixed(2));
  }
  row('');

  // Expenses
  row('── EXPENSES ──');
  row('Date', 'Category', 'Description', 'Amount (GH₵)', 'Payment Method');
  for (const e of expenses) {
    row(
      format(new Date(e.date), 'dd MMM yyyy'),
      e.category.name,
      e.description,
      Number(e.amount).toFixed(2),
      PAYMENT_LABELS[e.paymentMethod] ?? e.paymentMethod,
    );
  }
  row('');

  // Payroll
  if (payroll.length > 0) {
    row('── PAYROLL ──');
    row('Staff', 'Gross Pay (GH₵)', 'Deductions (GH₵)', 'Net Pay (GH₵)', 'Status');
    for (const p of payroll) {
      row(
        (p as any).user?.name ?? '—',
        Number((p as any).grossPay ?? 0).toFixed(2),
        Number((p as any).deductions ?? 0).toFixed(2),
        Number(p.netPay).toFixed(2),
        p.status,
      );
    }
    row('');
  }

  // Sessions
  row('── SHIFT SESSIONS ──');
  row('Opened By', 'Opened At', 'Closed By', 'Closed At', 'Status', 'Opening Float (GH₵)', 'Cash Sales (GH₵)', 'Expected Cash (GH₵)', 'Closing Cash (GH₵)', 'Discrepancy (GH₵)', 'Orders');
  for (const s of sessions) {
    const cashRev = s.orders.filter(o => o.paymentMethod === 'CASH').reduce((sum, o) => sum + Number(o.total), 0);
    const expected = Number(s.openingFloat) + cashRev;
    const closing = s.closingCash ? Number(s.closingCash) : null;
    const discrepancy = closing !== null ? closing - expected : null;
    row(
      s.openedByUser?.name ?? '—',
      format(new Date(s.openedAt), 'dd MMM yyyy HH:mm'),
      s.closedByUser?.name ?? '—',
      s.closedAt ? format(new Date(s.closedAt), 'dd MMM yyyy HH:mm') : '—',
      s.status,
      Number(s.openingFloat).toFixed(2),
      cashRev.toFixed(2),
      expected.toFixed(2),
      closing !== null ? closing.toFixed(2) : '—',
      discrepancy !== null ? discrepancy.toFixed(2) : '—',
      s.orders.length,
    );
  }

  return lines.join('\n');
}

// ─── XLSX builder ─────────────────────────────────────────────────────────────
function buildXLSX(data: Awaited<ReturnType<typeof fetchReportData>>) {
  const { month, summary: s, dailySales, topItems, expenses, paymentBreakdown, sessions, payroll } = data;
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: P&L Summary ──
  const plRows = [
    ['Jireh Natural Foods', `Monthly Report — ${month}`, '', '', ''],
    [''],
    ['Profit & Loss Statement', '', '', '', ''],
    ['Line Item', 'Amount (GH₵)', '', '', ''],
    ['Revenue', s.totalRevenue],
    ['Cost of Goods Sold (COGS)', -s.cogs],
    ['Gross Profit', s.grossProfit],
    ['Gross Margin %', `${s.grossMargin.toFixed(1)}%`],
    ['Operating Expenses', -s.totalExpenses],
    ['Payroll', -s.totalPayroll],
    ['Net Profit / (Loss)', s.netProfit],
    [''],
    ['Total Orders', s.totalOrders],
    [''],
    ['Revenue by Payment Method', '', '', '', ''],
    ['Method', 'Amount (GH₵)', '', '', ''],
    ...Object.entries(paymentBreakdown).map(([method, amount]) => [PAYMENT_LABELS[method] ?? method, amount]),
  ];
  const plWS = XLSX.utils.aoa_to_sheet(plRows);
  plWS['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, plWS, 'P&L Summary');

  // ── Sheet 2: Daily Sales ──
  const salesHeader = ['Date', 'Orders', 'Revenue (GH₵)', 'Discounts (GH₵)'];
  const salesRows = dailySales.map(d => [d.date, d.orders, d.revenue, d.discounts]);
  const salesWS = XLSX.utils.aoa_to_sheet([salesHeader, ...salesRows]);
  salesWS['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, salesWS, 'Daily Sales');

  // ── Sheet 3: Top Menu Items ──
  const itemsHeader = ['Item', 'Quantity Sold', 'Revenue (GH₵)'];
  const itemsRows = topItems.map(i => [i.name, i.qty, i.revenue]);
  const itemsWS = XLSX.utils.aoa_to_sheet([itemsHeader, ...itemsRows]);
  itemsWS['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, itemsWS, 'Top Items');

  // ── Sheet 4: Expenses ──
  const expHeader = ['Date', 'Category', 'Description', 'Amount (GH₵)', 'Payment Method', 'Notes'];
  const expRows = expenses.map(e => [
    format(new Date(e.date), 'dd MMM yyyy'),
    e.category.name,
    e.description,
    Number(e.amount),
    PAYMENT_LABELS[e.paymentMethod] ?? e.paymentMethod,
    e.notes ?? '',
  ]);
  const expWS = XLSX.utils.aoa_to_sheet([expHeader, ...expRows]);
  expWS['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, expWS, 'Expenses');

  // ── Sheet 5: Payroll ──
  if (payroll.length > 0) {
    const prHeader = ['Staff', 'Period Start', 'Period End', 'Gross Pay (GH₵)', 'Deductions (GH₵)', 'Net Pay (GH₵)', 'Status'];
    const prRows = payroll.map(p => [
      (p as any).user?.name ?? '—',
      (p as any).periodStart ? format(new Date((p as any).periodStart), 'dd MMM yyyy') : '',
      (p as any).periodEnd ? format(new Date((p as any).periodEnd), 'dd MMM yyyy') : '',
      Number((p as any).grossPay ?? 0),
      Number((p as any).deductions ?? 0),
      Number(p.netPay),
      p.status,
    ]);
    const prWS = XLSX.utils.aoa_to_sheet([prHeader, ...prRows]);
    prWS['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, prWS, 'Payroll');
  }

  // ── Sheet 6: Shift Sessions ──
  const sessHeader = ['Opened By', 'Opened At', 'Closed By', 'Closed At', 'Status', 'Opening Float (GH₵)', 'Cash Sales (GH₵)', 'Expected Cash (GH₵)', 'Closing Cash (GH₵)', 'Discrepancy (GH₵)', 'Orders'];
  const sessRows = sessions.map(s => {
    const cashRev = s.orders.filter(o => o.paymentMethod === 'CASH').reduce((sum, o) => sum + Number(o.total), 0);
    const expected = Number(s.openingFloat) + cashRev;
    const closing = s.closingCash ? Number(s.closingCash) : null;
    return [
      s.openedByUser?.name ?? '—',
      format(new Date(s.openedAt), 'dd MMM yyyy HH:mm'),
      s.closedByUser?.name ?? '—',
      s.closedAt ? format(new Date(s.closedAt), 'dd MMM yyyy HH:mm') : '—',
      s.status,
      Number(s.openingFloat),
      cashRev,
      expected,
      closing ?? '—',
      closing !== null ? closing - expected : '—',
      s.orders.length,
    ];
  });
  const sessWS = XLSX.utils.aoa_to_sheet([sessHeader, ...sessRows]);
  sessWS['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, sessWS, 'Shift Sessions');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as any).role;
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const exportFormat = searchParams.get('format') ?? 'csv'; // 'csv' | 'xlsx'
  const month = searchParams.get('month') ?? format(new Date(), 'yyyy-MM');

  if (!['csv', 'xlsx'].includes(exportFormat)) {
    return NextResponse.json({ error: 'Invalid format. Use csv or xlsx.' }, { status: 400 });
  }

  const data = await fetchReportData(month);
  const filename = `jireh-report-${month}`;

  if (exportFormat === 'xlsx') {
    const buffer = buildXLSX(data);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // CSV
  const csv = buildCSV(data);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
