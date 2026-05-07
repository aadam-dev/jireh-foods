'use client';

import { useEffect, useState } from 'react';
import {
  ShoppingBag, TrendingUp, AlertTriangle, DollarSign, Package,
  ArrowRight, BarChart3, ArrowUpRight, ArrowDownRight, Unlock, Lock,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import Link from 'next/link';
import { formatCurrency, formatTime } from '@/src/lib/utils';
import { OrderStatusBadge, PaymentBadge } from '@/src/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/src/components/ui/Card';

interface DashboardData {
  today: { revenue: number; orders: number; revenueTrend: number };
  month: { revenue: number; orders: number };
  paymentMix: Record<string, number>;
  trendChart: { date: string; revenue: number }[];
  recentOrders: any[];
  lowStockAlerts: any[];
  activeSession: any;
  topItems: { name: string; qty: number; revenue: number }[];
  stockValue: number;
}

const PAYMENT_COLORS: Record<string, string> = {
  CASH: '#5ecf4f', MOMO: '#f59e0b', BOLT_FOOD: '#60a5fa', CARD: '#a78bfa', BANK_TRANSFER: '#c084fc', UNPAID: '#6b7280',
};

function StatCard({ title, value, sub, trend, icon, iconBg = 'bg-[#349f2d]/20' }: {
  title: string; value: string; sub?: string; trend?: number; icon: React.ReactNode; iconBg?: string;
}) {
  return (
    <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-[#aba8a4]">{title}</p>
        <div className={`w-8 h-8 rounded-xl ${iconBg} border border-white/5 flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-[#f4efeb]">{value}</p>
      {sub && <p className="text-xs text-[#aba8a4] mt-1">{sub}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-[#5ecf4f]' : 'text-red-400'}`}>
          {trend >= 0 ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
          {Math.abs(trend).toFixed(1)}% vs yesterday
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-[#aba8a4] mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">{formatCurrency(p.value)}</p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-96">
      <div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const paymentPieData = Object.entries(data?.paymentMix ?? {}).map(([method, value]) => ({ name: method, value }));
  const trendData = (data?.trendChart ?? []).map(d => ({ ...d, date: d.date.slice(5) })); // MM-DD

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Dashboard</h1>
          <p className="text-sm text-[#aba8a4] mt-0.5">
            {new Date().toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {/* Session status pill */}
        {data?.activeSession ? (
          <Link href="/pos" className="flex items-center gap-2 px-4 py-2 bg-[#349f2d]/10 border border-[#349f2d]/30 rounded-xl text-sm text-[#5ecf4f] hover:bg-[#349f2d]/20 transition-colors">
            <Unlock size={14}/> Shift Open · {data.activeSession.openedByUser?.name}
          </Link>
        ) : (
          <Link href="/pos" className="flex items-center gap-2 px-4 py-2 bg-[#191c19] border border-[#2b2f2b] rounded-xl text-sm text-[#aba8a4] hover:border-[#404540] transition-colors">
            <Lock size={14}/> No Active Shift
          </Link>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Revenue" value={formatCurrency(data?.today.revenue ?? 0)}
          trend={data?.today.revenueTrend} icon={<DollarSign size={16} className="text-[#5ecf4f]"/>} />
        <StatCard title="Today's Orders" value={String(data?.today.orders ?? 0)}
          icon={<ShoppingBag size={16} className="text-blue-400"/>} iconBg="bg-blue-500/20" />
        <StatCard title="Month Revenue" value={formatCurrency(data?.month.revenue ?? 0)}
          sub={`${data?.month.orders ?? 0} orders`}
          icon={<TrendingUp size={16} className="text-purple-400"/>} iconBg="bg-purple-500/20" />
        <StatCard title="Stock Value" value={formatCurrency(data?.stockValue ?? 0)}
          icon={<Package size={16} className="text-orange-400"/>} iconBg="bg-orange-500/20" />
      </div>

      {/* Revenue trend chart */}
      <Card padding="none">
        <CardHeader className="px-5 pt-5 pb-4">
          <CardTitle>30-Day Revenue Trend</CardTitle>
        </CardHeader>
        <div className="px-4 pb-5 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#349f2d" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#349f2d" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2b2f2b" vertical={false}/>
              <XAxis dataKey="date" tick={{ fill: '#aba8a4', fontSize: 10 }} tickLine={false} axisLine={false}
                interval={Math.floor(trendData.length / 6)}/>
              <YAxis tick={{ fill: '#aba8a4', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => `₵${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="revenue" stroke="#349f2d" strokeWidth={2}
                fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: '#5ecf4f' }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <CardHeader className="px-5 pt-5 pb-0">
              <CardTitle>Recent Orders</CardTitle>
              <Link href="/admin/orders" className="text-xs text-[#349f2d] hover:text-[#5ecf4f] flex items-center gap-1 transition-colors">
                View all <ArrowRight size={12}/>
              </Link>
            </CardHeader>
            <div className="divide-y divide-[#2b2f2b]">
              {(data?.recentOrders ?? []).length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-[#aba8a4]">No orders yet today</div>
              ) : data?.recentOrders.map(order => (
                <div key={order.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-[#f4efeb]">{order.orderNumber}</span>
                      <OrderStatusBadge status={order.status}/>
                    </div>
                    <p className="text-xs text-[#aba8a4] truncate">
                      {order.items?.map((i: any) => `${i.quantity}× ${i.menuItem?.name ?? i.name}`).join(', ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[#f4efeb]">{formatCurrency(order.total)}</p>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <PaymentBadge method={order.paymentMethod}/>
                      <span className="text-xs text-[#aba8a4]">{formatTime(order.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Payment mix */}
          {paymentPieData.length > 0 && (
            <Card padding="none">
              <CardHeader className="px-5 pt-5 pb-2">
                <CardTitle>Today's Payment Mix</CardTitle>
              </CardHeader>
              <div className="px-4 pb-4">
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                        dataKey="value" paddingAngle={3}>
                        {paymentPieData.map((entry, i) => (
                          <Cell key={i} fill={PAYMENT_COLORS[entry.name] ?? '#6b7280'}/>
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ background: '#191c19', border: '1px solid #2b2f2b', borderRadius: 12, fontSize: 11 }}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1 mt-1">
                  {paymentPieData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: PAYMENT_COLORS[d.name] ?? '#6b7280' }}/>
                        <span className="text-[#aba8a4]">{d.name}</span>
                      </div>
                      <span className="text-[#f4efeb] font-medium">{formatCurrency(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Low stock */}
          <Card padding="none">
            <CardHeader className="px-5 pt-5 pb-0">
              <CardTitle>Low Stock</CardTitle>
              <Link href="/admin/inventory" className="text-xs text-[#349f2d] hover:text-[#5ecf4f] flex items-center gap-1">
                Inventory <ArrowRight size={12}/>
              </Link>
            </CardHeader>
            <div className="divide-y divide-[#2b2f2b]">
              {(data?.lowStockAlerts ?? []).length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <Package size={20} className="text-[#349f2d] mx-auto mb-1.5"/>
                  <p className="text-xs text-[#aba8a4]">All stock OK</p>
                </div>
              ) : data?.lowStockAlerts.slice(0, 5).map(item => (
                <div key={item.id} className="px-5 py-2.5 flex items-center gap-3">
                  <AlertTriangle size={13} className="text-yellow-400 shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#f4efeb] truncate">{item.name}</p>
                    <p className="text-[10px] text-[#aba8a4]">{Number(item.quantity).toFixed(1)} {item.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Top items bar chart */}
      {(data?.topItems ?? []).length > 0 && (
        <Card padding="none">
          <CardHeader className="px-5 pt-5 pb-4">
            <CardTitle>Top Items This Month</CardTitle>
            <span className="text-xs text-[#aba8a4]">by quantity sold</span>
          </CardHeader>
          <div className="px-4 pb-5 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.topItems} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2b2f2b" horizontal={false}/>
                <XAxis type="number" tick={{ fill: '#aba8a4', fontSize: 10 }} tickLine={false} axisLine={false}/>
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#aba8a4', fontSize: 10 }} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{ background: '#191c19', border: '1px solid #2b2f2b', borderRadius: 12, fontSize: 11 }}/>
                <Bar dataKey="qty" fill="#349f2d" radius={[0, 4, 4, 0]} name="Sold"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
