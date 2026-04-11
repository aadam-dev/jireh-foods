'use client';

import { useEffect, useState } from 'react';
import {
  ShoppingBag, TrendingUp, Clock, AlertTriangle,
  DollarSign, Users, Package, ArrowRight,
} from 'lucide-react';
import { StatCard } from '@/src/components/ui/StatCard';
import { Card, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Badge, OrderStatusBadge, PaymentBadge } from '@/src/components/ui/Badge';
import { formatCurrency, formatTime } from '@/src/lib/utils';
import Link from 'next/link';

interface DashboardData {
  today: { revenue: number; orders: number; pending: number; revenueTrend: number };
  month: { revenue: number; orders: number };
  recentOrders: any[];
  lowStockAlerts: any[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Dashboard</h1>
        <p className="text-sm text-[#aba8a4] mt-0.5">
          {new Date().toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(data?.today.revenue ?? 0)}
          trend={data?.today.revenueTrend}
          trendLabel="vs yesterday"
          icon={<DollarSign size={16} className="text-[#5ecf4f]" />}
        />
        <StatCard
          title="Today's Orders"
          value={String(data?.today.orders ?? 0)}
          icon={<ShoppingBag size={16} className="text-blue-400" />}
          iconBg="bg-blue-500/20"
        />
        <StatCard
          title="Pending Orders"
          value={String(data?.today.pending ?? 0)}
          icon={<Clock size={16} className="text-yellow-400" />}
          iconBg="bg-yellow-500/20"
        />
        <StatCard
          title="Month Revenue"
          value={formatCurrency(data?.month.revenue ?? 0)}
          subValue={`${data?.month.orders ?? 0} orders`}
          icon={<TrendingUp size={16} className="text-purple-400" />}
          iconBg="bg-purple-500/20"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <CardHeader className="px-5 pt-5 pb-0">
              <CardTitle>Recent Orders</CardTitle>
              <Link href="/admin/orders" className="text-xs text-[#349f2d] hover:text-[#5ecf4f] flex items-center gap-1 transition-colors">
                View all <ArrowRight size={12} />
              </Link>
            </CardHeader>
            <div className="divide-y divide-[#2b2f2b]">
              {(data?.recentOrders ?? []).length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-[#aba8a4]">No orders yet today</div>
              ) : (
                data?.recentOrders.map((order) => (
                  <div key={order.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-[#f4efeb]">{order.orderNumber}</span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <p className="text-xs text-[#aba8a4] truncate">
                        {order.items.map((i: any) => `${i.quantity}× ${i.menuItem?.name ?? i.name}`).join(', ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-[#f4efeb]">{formatCurrency(order.total)}</p>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <PaymentBadge method={order.paymentMethod} />
                        <span className="text-xs text-[#aba8a4]">{formatTime(order.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Low stock alerts */}
        <div>
          <Card padding="none">
            <CardHeader className="px-5 pt-5 pb-0">
              <CardTitle>Low Stock Alerts</CardTitle>
              <Link href="/admin/inventory" className="text-xs text-[#349f2d] hover:text-[#5ecf4f] flex items-center gap-1 transition-colors">
                Inventory <ArrowRight size={12} />
              </Link>
            </CardHeader>
            <div className="divide-y divide-[#2b2f2b]">
              {(data?.lowStockAlerts ?? []).length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Package size={24} className="text-[#349f2d] mx-auto mb-2" />
                  <p className="text-sm text-[#aba8a4]">All stock levels OK</p>
                </div>
              ) : (
                data?.lowStockAlerts.map((item) => (
                  <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                    <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#f4efeb] truncate">{item.name}</p>
                      <p className="text-xs text-[#aba8a4]">
                        {Number(item.quantity).toFixed(1)} {item.unit} left
                      </p>
                    </div>
                    <Badge variant="yellow" size="sm">Low</Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
