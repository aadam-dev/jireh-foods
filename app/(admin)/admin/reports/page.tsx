'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Card, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { StatCard } from '@/src/components/ui/StatCard';
import { formatCurrency } from '@/src/lib/utils';

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
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2 text-xs">
      <p className="text-[#aba8a4] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name === 'revenue' ? formatCurrency(p.value) : `${p.value} orders`}
        </p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const monthStr = format(month, 'yyyy-MM');
      const res = await fetch(`/api/admin/reports?month=${monthStr}`);
      setData(await res.json());
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, [month]);

  const s = data?.summary;
  const isProfit = (s?.netProfit ?? 0) >= 0;

  const paymentData = Object.entries(data?.paymentBreakdown ?? {}).map(([name, value]) => ({ name, value }));
  const expenseData = Object.entries(data?.expenseByCategory ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({ name: name.split(' ')[0], value, full: name }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Financial Reports</h1>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => setMonth(subMonths(month, 1))} className="text-[#aba8a4] hover:text-[#f4efeb] p-1 rounded-lg hover:bg-white/5">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-[#aba8a4]">{format(month, 'MMMM yyyy')}</span>
            <button onClick={() => setMonth(addMonths(month, 1))} className="text-[#aba8a4] hover:text-[#f4efeb] p-1 rounded-lg hover:bg-white/5">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* P&L Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Revenue" value={formatCurrency(s?.totalRevenue ?? 0)} subValue={`${s?.totalOrders} orders`} icon={<TrendingUp size={16} className="text-[#5ecf4f]" />} />
            <StatCard title="Gross Profit" value={formatCurrency(s?.grossProfit ?? 0)} subValue={`${(s?.grossMargin ?? 0).toFixed(1)}% margin`} icon={<TrendingUp size={16} className="text-blue-400" />} iconBg="bg-blue-500/20" />
            <StatCard title="Total Expenses" value={formatCurrency((s?.totalExpenses ?? 0) + (s?.totalPayroll ?? 0))} icon={<TrendingDown size={16} className="text-red-400" />} iconBg="bg-red-500/20" />
            <StatCard
              title="Net Profit"
              value={formatCurrency(s?.netProfit ?? 0)}
              icon={isProfit ? <TrendingUp size={16} className="text-[#5ecf4f]" /> : <TrendingDown size={16} className="text-red-400" />}
              iconBg={isProfit ? 'bg-[#349f2d]/20' : 'bg-red-500/20'}
            />
          </div>

          {/* P&L Breakdown card */}
          <Card>
            <CardHeader>
              <CardTitle>Profit & Loss Statement</CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {[
                { label: 'Revenue', value: s?.totalRevenue ?? 0, color: 'text-[#f4efeb]', bold: true },
                { label: 'Cost of Goods Sold (COGS)', value: -(s?.cogs ?? 0), color: 'text-red-400' },
                { label: 'Gross Profit', value: s?.grossProfit ?? 0, color: 'text-[#5ecf4f]', bold: true, border: true },
                { label: 'Operating Expenses', value: -(s?.totalExpenses ?? 0), color: 'text-red-400' },
                { label: 'Payroll', value: -(s?.totalPayroll ?? 0), color: 'text-red-400' },
                { label: 'Net Profit', value: s?.netProfit ?? 0, color: isProfit ? 'text-[#5ecf4f]' : 'text-red-400', bold: true, border: true },
              ].map(row => (
                <div key={row.label} className={`flex justify-between items-center py-2 ${row.border ? 'border-t border-[#2b2f2b] mt-1' : ''}`}>
                  <span className={`text-sm ${row.bold ? 'font-semibold text-[#f4efeb]' : 'text-[#aba8a4]'}`}>{row.label}</span>
                  <span className={`text-sm font-${row.bold ? 'bold' : 'medium'} ${row.color}`}>
                    {row.value < 0 ? `(${formatCurrency(Math.abs(row.value))})` : formatCurrency(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Daily sales chart */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Sales</CardTitle>
            </CardHeader>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.dailySales ?? []} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2b2f2b" />
                <XAxis dataKey="date" tick={{ fill: '#aba8a4', fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fill: '#aba8a4', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₵${v}`} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" fill="#349f2d" radius={[4, 4, 0, 0]} name="revenue" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment breakdown */}
            <Card>
              <CardHeader><CardTitle>Revenue by Payment Method</CardTitle></CardHeader>
              {paymentData.length === 0 ? (
                <p className="text-sm text-[#aba8a4] text-center py-8">No data</p>
              ) : (
                <div className="space-y-3">
                  {[...paymentData].sort((a, b) => b.value - a.value).map(({ name, value }) => {
                    const total = paymentData.reduce((s, d) => s + d.value, 0);
                    const pct = total > 0 ? (value / total) * 100 : 0;
                    const labels: Record<string, string> = { CASH: 'Cash', MOMO: 'Mobile Money', CARD: 'Card', BANK_TRANSFER: 'Bank Transfer', UNPAID: 'Unpaid' };
                    return (
                      <div key={name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-[#aba8a4]">{labels[name] ?? name}</span>
                          <span className="text-[#f4efeb] font-medium">{formatCurrency(value)}</span>
                        </div>
                        <div className="h-1.5 bg-[#2b2f2b] rounded-full overflow-hidden">
                          <div className="h-full bg-[#349f2d] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Expense breakdown */}
            <Card>
              <CardHeader><CardTitle>Expenses by Category</CardTitle></CardHeader>
              {expenseData.length === 0 ? (
                <p className="text-sm text-[#aba8a4] text-center py-8">No expenses this month</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={expenseData} layout="vertical" margin={{ left: 0, right: 10 }}>
                    <XAxis type="number" tick={{ fill: '#aba8a4', fontSize: 10 }} tickFormatter={v => `₵${v}`} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#aba8a4', fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill="#5ecf4f" radius={[0, 4, 4, 0]} name="revenue" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
