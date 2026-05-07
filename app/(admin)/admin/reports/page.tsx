'use client';

import { useEffect, useState } from 'react';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  ShoppingBag, DollarSign, BarChart3, Clock, CheckCircle2,
  AlertTriangle, Users,
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { formatCurrency, formatDateTime } from '@/src/lib/utils';

interface SessionSummary {
  id: string;
  openedAt: string;
  closedAt?: string;
  status: string;
  openedBy: string;
  closedBy?: string;
  openingFloat: number;
  closingCash?: number;
  sessionRevenue: number;
  cashRevenue: number;
  expectedCash: number;
  discrepancy?: number;
  orderCount: number;
  durationHours?: number;
}

interface ReportData {
  summary: {
    totalRevenue: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    totalExpenses: number;
    totalPayroll: number;
    netProfit: number;
    totalOrders: number;
  };
  expenseByCategory: Record<string, number>;
  paymentBreakdown: Record<string, number>;
  dailySales: { date: string; revenue: number; orders: number }[];
  topItems: { name: string; qty: number; revenue: number }[];
  sessions: SessionSummary[];
}

const PAYMENT_COLORS: Record<string, string> = {
  CASH: '#5ecf4f', MOMO: '#f59e0b', BOLT_FOOD: '#60a5fa', CARD: '#a78bfa', BANK_TRANSFER: '#c084fc', UNPAID: '#6b7280',
};
const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash', MOMO: 'Mobile Money', BOLT_FOOD: 'Bolt Food', CARD: 'Card', BANK_TRANSFER: 'Bank Transfer', UNPAID: 'Unpaid',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-[#aba8a4] mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? '#5ecf4f' }} className="font-semibold">
          {p.name === 'orders' ? `${p.value} orders` : formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

function StatCard({ title, value, sub, icon, iconBg = 'bg-[#349f2d]/20', valueColor = 'text-[#f4efeb]' }: {
  title: string; value: string; sub?: string; icon: React.ReactNode; iconBg?: string; valueColor?: string;
}) {
  return (
    <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-[#aba8a4]">{title}</p>
        <div className={`w-8 h-8 rounded-xl ${iconBg} border border-white/5 flex items-center justify-center`}>{icon}</div>
      </div>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-[#aba8a4] mt-1">{sub}</p>}
    </div>
  );
}

type Tab = 'pl' | 'sales' | 'sessions';

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [tab, setTab] = useState<Tab>('pl');

  const fetchData = async () => {
    setLoading(true);
    try {
      const monthStr = format(month, 'yyyy-MM');
      const res = await fetch(`/api/admin/reports?month=${monthStr}`);
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, [month]);

  const s = data?.summary;
  const isProfit = (s?.netProfit ?? 0) >= 0;

  const paymentData = Object.entries(data?.paymentBreakdown ?? {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const paymentTotal = paymentData.reduce((sum, d) => sum + d.value, 0);

  const expenseData = Object.entries(data?.expenseByCategory ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({ name: name.length > 12 ? name.slice(0, 12) + '…' : name, value, full: name }));

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'pl', label: 'P&L', icon: <TrendingUp size={14} /> },
    { id: 'sales', label: 'Sales Analysis', icon: <BarChart3 size={14} /> },
    { id: 'sessions', label: 'Shift Sessions', icon: <Clock size={14} /> },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Reports</h1>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => setMonth(subMonths(month, 1))}
              className="text-[#aba8a4] hover:text-[#f4efeb] p-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-[#aba8a4]">{format(month, 'MMMM yyyy')}</span>
            <button
              onClick={() => setMonth(addMonths(month, 1))}
              className="text-[#aba8a4] hover:text-[#f4efeb] p-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#111311] border border-[#2b2f2b] rounded-xl p-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === t.id
                  ? 'bg-[#349f2d] text-white'
                  : 'text-[#aba8a4] hover:text-[#f4efeb]'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ─── P&L TAB ─── */}
          {tab === 'pl' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Revenue" value={formatCurrency(s?.totalRevenue ?? 0)}
                  sub={`${s?.totalOrders} orders`}
                  icon={<DollarSign size={16} className="text-[#5ecf4f]" />} />
                <StatCard title="Gross Profit" value={formatCurrency(s?.grossProfit ?? 0)}
                  sub={`${(s?.grossMargin ?? 0).toFixed(1)}% margin`}
                  icon={<TrendingUp size={16} className="text-blue-400" />} iconBg="bg-blue-500/20"
                  valueColor="text-blue-400" />
                <StatCard title="Total Expenses" value={formatCurrency((s?.totalExpenses ?? 0) + (s?.totalPayroll ?? 0))}
                  icon={<TrendingDown size={16} className="text-red-400" />} iconBg="bg-red-500/20"
                  valueColor="text-red-400" />
                <StatCard title="Net Profit" value={formatCurrency(s?.netProfit ?? 0)}
                  icon={isProfit ? <TrendingUp size={16} className="text-[#5ecf4f]" /> : <TrendingDown size={16} className="text-red-400" />}
                  iconBg={isProfit ? 'bg-[#349f2d]/20' : 'bg-red-500/20'}
                  valueColor={isProfit ? 'text-[#5ecf4f]' : 'text-red-400'} />
              </div>

              {/* P&L Statement */}
              <Card>
                <CardHeader>
                  <CardTitle>Profit & Loss Statement — {format(month, 'MMMM yyyy')}</CardTitle>
                </CardHeader>
                <div className="space-y-1">
                  {[
                    { label: 'Revenue', value: s?.totalRevenue ?? 0, color: 'text-[#f4efeb]', bold: true },
                    { label: 'Cost of Goods Sold (COGS)', value: -(s?.cogs ?? 0), color: 'text-red-400' },
                    { label: 'Gross Profit', value: s?.grossProfit ?? 0, color: 'text-[#5ecf4f]', bold: true, border: true },
                    { label: 'Operating Expenses', value: -(s?.totalExpenses ?? 0), color: 'text-red-400' },
                    { label: 'Payroll', value: -(s?.totalPayroll ?? 0), color: 'text-red-400' },
                    { label: 'Net Profit / (Loss)', value: s?.netProfit ?? 0, color: isProfit ? 'text-[#5ecf4f]' : 'text-red-400', bold: true, border: true },
                  ].map(row => (
                    <div key={row.label}
                      className={`flex justify-between items-center py-2.5 px-1 ${row.border ? 'border-t border-[#2b2f2b] mt-1' : ''}`}>
                      <span className={`text-sm ${row.bold ? 'font-semibold text-[#f4efeb]' : 'text-[#aba8a4]'}`}>{row.label}</span>
                      <span className={`text-sm ${row.bold ? 'font-bold' : 'font-medium'} ${row.color}`}>
                        {row.value < 0 ? `(${formatCurrency(Math.abs(row.value))})` : formatCurrency(row.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payment breakdown */}
                <Card>
                  <CardHeader><CardTitle>Revenue by Payment Method</CardTitle></CardHeader>
                  {paymentData.length === 0 ? (
                    <p className="text-sm text-[#aba8a4] text-center py-8">No data this month</p>
                  ) : (
                    <div className="space-y-3">
                      {paymentData.map(({ name, value }) => {
                        const pct = paymentTotal > 0 ? (value / paymentTotal) * 100 : 0;
                        return (
                          <div key={name}>
                            <div className="flex justify-between text-sm mb-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ background: PAYMENT_COLORS[name] ?? '#6b7280' }} />
                                <span className="text-[#aba8a4]">{PAYMENT_LABELS[name] ?? name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-[#aba8a4]">{pct.toFixed(1)}%</span>
                                <span className="text-[#f4efeb] font-medium">{formatCurrency(value)}</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-[#2b2f2b] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, background: PAYMENT_COLORS[name] ?? '#349f2d' }} />
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2 border-t border-[#2b2f2b] flex justify-between text-sm">
                        <span className="font-semibold text-[#f4efeb]">Total</span>
                        <span className="font-bold text-[#5ecf4f]">{formatCurrency(paymentTotal)}</span>
                      </div>
                    </div>
                  )}
                </Card>

                {/* Expense breakdown */}
                <Card>
                  <CardHeader><CardTitle>Expenses by Category</CardTitle></CardHeader>
                  {expenseData.length === 0 ? (
                    <p className="text-sm text-[#aba8a4] text-center py-8">No expenses this month</p>
                  ) : (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={expenseData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                          <XAxis type="number" tick={{ fill: '#aba8a4', fontSize: 10 }}
                            tickFormatter={v => `₵${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`}
                            axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" tick={{ fill: '#aba8a4', fontSize: 10 }}
                            axisLine={false} tickLine={false} width={70} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="value" fill="#5ecf4f" radius={[0, 4, 4, 0]} name="revenue" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}

          {/* ─── SALES ANALYSIS TAB ─── */}
          {tab === 'sales' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Revenue" value={formatCurrency(s?.totalRevenue ?? 0)}
                  icon={<DollarSign size={16} className="text-[#5ecf4f]" />} />
                <StatCard title="Total Orders" value={String(s?.totalOrders ?? 0)}
                  sub={s?.totalOrders && s.totalOrders > 0 ? `avg ${formatCurrency((s.totalRevenue ?? 0) / s.totalOrders)}/order` : undefined}
                  icon={<ShoppingBag size={16} className="text-blue-400" />} iconBg="bg-blue-500/20" />
                <StatCard title="Sessions" value={String(data?.sessions.length ?? 0)}
                  sub={`${data?.sessions.filter(s => s.status === 'CLOSED').length} closed`}
                  icon={<Clock size={16} className="text-purple-400" />} iconBg="bg-purple-500/20" />
                <StatCard title="Avg Daily Revenue"
                  value={formatCurrency(
                    data?.dailySales
                      ? data.dailySales.filter(d => d.revenue > 0).reduce((s, d) => s + d.revenue, 0) /
                        Math.max(data.dailySales.filter(d => d.revenue > 0).length, 1)
                      : 0
                  )}
                  icon={<TrendingUp size={16} className="text-orange-400" />} iconBg="bg-orange-500/20" />
              </div>

              {/* Daily sales area chart */}
              <Card padding="none">
                <CardHeader className="px-5 pt-5 pb-4">
                  <CardTitle>Daily Sales — {format(month, 'MMMM yyyy')}</CardTitle>
                </CardHeader>
                <div className="px-4 pb-5 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.dailySales ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#349f2d" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#349f2d" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2b2f2b" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#aba8a4', fontSize: 10 }}
                        tickLine={false} axisLine={false}
                        interval={Math.max(Math.floor((data?.dailySales?.length ?? 30) / 8), 1)} />
                      <YAxis tick={{ fill: '#aba8a4', fontSize: 10 }} tickLine={false} axisLine={false}
                        tickFormatter={v => `₵${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="revenue" stroke="#349f2d" strokeWidth={2}
                        fill="url(#salesGrad)" dot={false} activeDot={{ r: 4, fill: '#5ecf4f' }} name="revenue" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top items by revenue */}
                <Card padding="none">
                  <CardHeader className="px-5 pt-5 pb-4">
                    <CardTitle>Top Items by Revenue</CardTitle>
                  </CardHeader>
                  {(data?.topItems ?? []).length === 0 ? (
                    <p className="text-sm text-[#aba8a4] text-center py-8">No sales data</p>
                  ) : (
                    <div className="px-4 pb-5 h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.topItems} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2b2f2b" horizontal={false} />
                          <XAxis type="number" tick={{ fill: '#aba8a4', fontSize: 10 }} tickLine={false} axisLine={false}
                            tickFormatter={v => `₵${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
                          <YAxis type="category" dataKey="name" width={100}
                            tick={{ fill: '#aba8a4', fontSize: 10 }} tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="revenue" fill="#349f2d" radius={[0, 4, 4, 0]} name="revenue" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>

                {/* Payment mix pie */}
                <Card padding="none">
                  <CardHeader className="px-5 pt-5 pb-2">
                    <CardTitle>Payment Mix</CardTitle>
                  </CardHeader>
                  {paymentData.length === 0 ? (
                    <p className="text-sm text-[#aba8a4] text-center py-8">No data</p>
                  ) : (
                    <div className="px-4 pb-4">
                      <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={paymentData} cx="50%" cy="50%" innerRadius={40} outerRadius={60}
                              dataKey="value" paddingAngle={3}>
                              {paymentData.map((entry, i) => (
                                <Cell key={i} fill={PAYMENT_COLORS[entry.name] ?? '#6b7280'} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v: any) => formatCurrency(v)}
                              contentStyle={{ background: '#191c19', border: '1px solid #2b2f2b', borderRadius: 12, fontSize: 11 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-1.5 mt-1">
                        {paymentData.map(d => (
                          <div key={d.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: PAYMENT_COLORS[d.name] ?? '#6b7280' }} />
                              <span className="text-[#aba8a4]">{PAYMENT_LABELS[d.name] ?? d.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[#aba8a4]">
                                {paymentTotal > 0 ? `${((d.value / paymentTotal) * 100).toFixed(0)}%` : '—'}
                              </span>
                              <span className="text-[#f4efeb] font-medium">{formatCurrency(d.value)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              {/* Orders by day bar chart */}
              <Card padding="none">
                <CardHeader className="px-5 pt-5 pb-4">
                  <CardTitle>Order Volume by Day</CardTitle>
                </CardHeader>
                <div className="px-4 pb-5 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.dailySales ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2b2f2b" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#aba8a4', fontSize: 10 }}
                        tickLine={false} axisLine={false}
                        interval={Math.max(Math.floor((data?.dailySales?.length ?? 30) / 8), 1)} />
                      <YAxis tick={{ fill: '#aba8a4', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="orders" fill="#60a5fa" radius={[4, 4, 0, 0]} name="orders" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </>
          )}

          {/* ─── SESSIONS TAB ─── */}
          {tab === 'sessions' && (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Shifts" value={String(data?.sessions.length ?? 0)}
                  icon={<Clock size={16} className="text-purple-400" />} iconBg="bg-purple-500/20" />
                <StatCard title="Closed Shifts" value={String(data?.sessions.filter(s => s.status === 'CLOSED').length ?? 0)}
                  icon={<CheckCircle2 size={16} className="text-[#5ecf4f]" />} />
                <StatCard title="Total Discrepancies"
                  value={formatCurrency(
                    Math.abs(
                      (data?.sessions ?? [])
                        .filter(s => s.discrepancy !== undefined && s.discrepancy !== null)
                        .reduce((sum, s) => sum + (s.discrepancy ?? 0), 0)
                    )
                  )}
                  icon={<AlertTriangle size={16} className="text-yellow-400" />} iconBg="bg-yellow-500/20"
                  valueColor="text-yellow-400" />
                <StatCard title="Cashiers Active"
                  value={String(new Set((data?.sessions ?? []).map(s => s.openedBy)).size)}
                  icon={<Users size={16} className="text-blue-400" />} iconBg="bg-blue-500/20" />
              </div>

              {/* Sessions list */}
              {(data?.sessions ?? []).length === 0 ? (
                <Card>
                  <div className="text-center py-12">
                    <Clock size={28} className="text-[#2b2f2b] mx-auto mb-3" />
                    <p className="text-sm text-[#aba8a4]">No shift sessions recorded this month</p>
                  </div>
                </Card>
              ) : (
                <div className="space-y-3">
                  {(data?.sessions ?? []).map(s => {
                    const hasDiscrepancy = s.discrepancy !== null && s.discrepancy !== undefined;
                    const discrepancyAmt = s.discrepancy ?? 0;
                    const discrepancyClass = Math.abs(discrepancyAmt) < 0.01
                      ? 'text-[#5ecf4f]'
                      : discrepancyAmt > 0 ? 'text-blue-400' : 'text-red-400';
                    const discrepancyLabel = Math.abs(discrepancyAmt) < 0.01
                      ? 'Balanced'
                      : discrepancyAmt > 0 ? `+${formatCurrency(discrepancyAmt)} over` : `${formatCurrency(discrepancyAmt)} short`;

                    return (
                      <div key={s.id} className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-5">
                        {/* Header row */}
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                                s.status === 'OPEN'
                                  ? 'bg-[#349f2d]/15 text-[#5ecf4f] border border-[#349f2d]/30'
                                  : 'bg-[#2b2f2b] text-[#aba8a4]'
                              }`}>
                                {s.status === 'OPEN' ? <><span className="w-1.5 h-1.5 bg-[#5ecf4f] rounded-full animate-pulse" /> Live</> : 'Closed'}
                              </span>
                              <span className="text-xs text-[#aba8a4]">
                                {s.durationHours !== null && s.durationHours !== undefined
                                  ? `${s.durationHours.toFixed(1)}h shift`
                                  : 'In progress'}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-[#f4efeb]">
                              {s.openedBy}
                              {s.closedBy && s.closedBy !== s.openedBy && ` → closed by ${s.closedBy}`}
                            </p>
                            <p className="text-xs text-[#aba8a4] mt-0.5">
                              {formatDateTime(s.openedAt)}
                              {s.closedAt && <> — {formatDateTime(s.closedAt)}</>}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-[#f4efeb]">{formatCurrency(s.sessionRevenue)}</p>
                            <p className="text-xs text-[#aba8a4]">{s.orderCount} order{s.orderCount !== 1 ? 's' : ''}</p>
                          </div>
                        </div>

                        {/* Financial grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: 'Opening Float', value: formatCurrency(s.openingFloat), color: 'text-[#f4efeb]' },
                            { label: 'Cash Sales', value: formatCurrency(s.cashRevenue), color: 'text-[#f4efeb]' },
                            { label: 'Expected Cash', value: formatCurrency(s.expectedCash), color: 'text-[#f4efeb]' },
                            {
                              label: 'Cash Counted',
                              value: s.closingCash !== null && s.closingCash !== undefined
                                ? formatCurrency(s.closingCash)
                                : '—',
                              color: 'text-[#f4efeb]',
                            },
                          ].map(item => (
                            <div key={item.label} className="bg-[#111311] rounded-xl p-3">
                              <p className="text-[10px] text-[#aba8a4] mb-1">{item.label}</p>
                              <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Discrepancy row */}
                        {hasDiscrepancy && (
                          <div className={`mt-3 flex items-center justify-between px-4 py-2.5 rounded-xl border ${
                            Math.abs(discrepancyAmt) < 0.01
                              ? 'bg-[#349f2d]/5 border-[#349f2d]/20'
                              : discrepancyAmt > 0
                                ? 'bg-blue-500/5 border-blue-500/20'
                                : 'bg-red-500/5 border-red-500/20'
                          }`}>
                            <span className="text-xs text-[#aba8a4]">Cash Discrepancy</span>
                            <span className={`text-sm font-bold ${discrepancyClass}`}>{discrepancyLabel}</span>
                          </div>
                        )}

                        {/* Notes */}
                        {(s as any).notes && (
                          <p className="mt-2 text-xs text-[#aba8a4] italic">{(s as any).notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
