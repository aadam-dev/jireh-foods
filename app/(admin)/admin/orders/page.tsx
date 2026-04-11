'use client';

import { useEffect, useState } from 'react';
import { Search, RefreshCw, ChevronDown } from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Badge, OrderStatusBadge, PaymentBadge } from '@/src/components/ui/Badge';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Modal } from '@/src/components/ui/Modal';
import { formatCurrency, formatDateTime } from '@/src/lib/utils';
import { ShoppingBag } from 'lucide-react';

const STATUSES = ['ALL', 'PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
const SOURCES = ['ALL', 'POS', 'ONLINE'];

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500',
  PREPARING: 'bg-blue-500',
  READY: 'bg-purple-500',
  COMPLETED: 'bg-[#349f2d]',
  CANCELLED: 'bg-red-500',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [updating, setUpdating] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [statusFilter, sourceFilter]);

  const filtered = orders.filter(o =>
    !search ||
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    (o.customerName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    try {
      await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await fetchOrders();
      setSelected((prev: any) => prev ? { ...prev, status } : null);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Orders</h1>
          <p className="text-sm text-[#aba8a4]">{total} total orders</p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={fetchOrders} loading={loading}>
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-all border',
                statusFilter === s
                  ? 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40'
                  : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540] hover:text-[#f4efeb]',
              ].join(' ')}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="ml-auto w-64">
          <Input
            placeholder="Search order or customer…"
            icon={<Search size={14} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <Card padding="none">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ShoppingBag size={24} />} title="No orders found" description="Try adjusting your filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2b2f2b]">
                  {['Order #', 'Time', 'Items', 'Customer', 'Payment', 'Total', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#aba8a4] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2f2b]">
                {filtered.map(order => (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-medium text-[#f4efeb] whitespace-nowrap">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-[#aba8a4] whitespace-nowrap">{formatDateTime(order.createdAt)}</td>
                    <td className="px-4 py-3 text-[#aba8a4]">
                      <span className="truncate block max-w-[180px]">
                        {order.items.slice(0, 2).map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}
                        {order.items.length > 2 && ` +${order.items.length - 2}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#aba8a4]">{order.customerName || '—'}</td>
                    <td className="px-4 py-3"><PaymentBadge method={order.paymentMethod} /></td>
                    <td className="px-4 py-3 font-semibold text-[#f4efeb] whitespace-nowrap">{formatCurrency(order.total)}</td>
                    <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="xs" onClick={() => setSelected(order)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Order detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Order ${selected?.orderNumber}`} size="lg">
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Status', value: <OrderStatusBadge status={selected.status} /> },
                { label: 'Payment', value: <PaymentBadge method={selected.paymentMethod} /> },
                { label: 'Source', value: <Badge>{selected.source}</Badge> },
                { label: 'Type', value: <Badge>{selected.deliveryType}</Badge> },
                { label: 'Customer', value: selected.customerName || '—' },
                { label: 'Phone', value: selected.customerPhone || '—' },
                { label: 'Staff', value: selected.staff?.name || '—' },
                { label: 'Time', value: formatDateTime(selected.createdAt) },
              ].map(row => (
                <div key={row.label}>
                  <p className="text-xs text-[#aba8a4] mb-1">{row.label}</p>
                  <div className="text-sm text-[#f4efeb]">{row.value}</div>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold text-[#aba8a4] uppercase tracking-wider mb-2">Items</p>
              <div className="space-y-2">
                {selected.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between py-2 border-b border-[#2b2f2b]">
                    <span className="text-sm text-[#f4efeb]">{item.quantity}× {item.name}</span>
                    <span className="text-sm font-medium text-[#f4efeb]">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1">
                  <span className="text-sm font-bold text-[#f4efeb]">Total</span>
                  <span className="text-sm font-bold text-[#5ecf4f]">{formatCurrency(selected.total)}</span>
                </div>
              </div>
            </div>

            {selected.status !== 'COMPLETED' && selected.status !== 'CANCELLED' && (
              <div>
                <p className="text-xs font-semibold text-[#aba8a4] uppercase tracking-wider mb-2">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {['PREPARING', 'READY', 'COMPLETED', 'CANCELLED'].map(s => (
                    <Button
                      key={s}
                      variant={s === 'CANCELLED' ? 'danger' : s === 'COMPLETED' ? 'success' : 'secondary'}
                      size="sm"
                      onClick={() => updateStatus(selected.id, s)}
                      loading={updating}
                    >
                      Mark {s.charAt(0) + s.slice(1).toLowerCase()}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {selected.notes && (
              <div>
                <p className="text-xs text-[#aba8a4] mb-1">Notes</p>
                <p className="text-sm text-[#f4efeb] bg-[#111311] rounded-xl px-3 py-2">{selected.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
