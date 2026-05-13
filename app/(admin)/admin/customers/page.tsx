'use client';

import { useState } from 'react';
import { Search, Phone, User, ShoppingBag, TrendingUp, Clock } from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { formatCurrency, formatDate } from '@/src/lib/utils';

interface CustomerOrder {
  id: string;
  orderNumber: string;
  total: string | number;
  paymentMethod: string;
  createdAt: string;
  status: string;
  items: { name: string; quantity: number }[];
}

interface CustomerProfile {
  key: string;
  name: string | null;
  phone: string | null;
  orderCount: number;
  totalSpend: number;
  lastOrder: string;
  orders: CustomerOrder[];
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash', MOMO: 'MoMo', BOLT_FOOD: 'Bolt Food',
  CARD: 'Card', BANK_TRANSFER: 'Bank', UNPAID: 'Unpaid',
};

export default function CustomersPage() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const search = async () => {
    if (!phone.trim() && !name.trim()) return;
    setLoading(true);
    setSearched(false);
    try {
      const params = new URLSearchParams();
      if (phone.trim()) params.set('phone', phone.trim());
      if (name.trim()) params.set('name', name.trim());
      const res = await fetch(`/api/admin/customers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers ?? []);
      }
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') search(); };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Customer Lookup</h1>
        <p className="text-sm text-[#aba8a4] mt-0.5">Search orders by customer phone or name</p>
      </div>

      {/* Search bar */}
      <Card padding="md">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              label="Phone number"
              placeholder="+233 or 024…"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={handleKey}
            />
          </div>
          <div className="flex-1">
            <Input
              label="Customer name"
              placeholder="Full or partial name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKey}
            />
          </div>
          <div className="flex items-end">
            <Button
              icon={<Search size={14} />}
              onClick={search}
              loading={loading}
              disabled={!phone.trim() && !name.trim()}
            >
              Search
            </Button>
          </div>
        </div>
      </Card>

      {/* Results */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && searched && customers.length === 0 && (
        <Card padding="md">
          <div className="text-center py-8">
            <Search size={28} className="text-[#2b2f2b] mx-auto mb-3" />
            <p className="text-sm text-[#aba8a4]">No customers found for that search</p>
          </div>
        </Card>
      )}

      {!loading && customers.length > 0 && (
        <div className="space-y-3">
          {customers.map(c => (
            <Card key={c.key} padding="md">
              {/* Profile row */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#349f2d]/20 border border-[#349f2d]/30 flex items-center justify-center shrink-0">
                    <User size={16} className="text-[#5ecf4f]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#f4efeb]">
                      {c.name ?? <span className="text-[#aba8a4] italic">No name</span>}
                    </p>
                    {c.phone && (
                      <p className="text-xs text-[#aba8a4] flex items-center gap-1 mt-0.5">
                        <Phone size={10} /> {c.phone}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setExpanded(expanded === c.key ? null : c.key)}
                  className="text-xs text-[#aba8a4] hover:text-[#5ecf4f] transition-colors"
                >
                  {expanded === c.key ? 'Hide orders' : `Show ${c.orders.length} order${c.orders.length !== 1 ? 's' : ''}`}
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { icon: <ShoppingBag size={13} />, label: 'Orders', value: c.orderCount },
                  { icon: <TrendingUp size={13} />, label: 'Total Spend', value: formatCurrency(c.totalSpend) },
                  { icon: <Clock size={13} />, label: 'Last Order', value: formatDate(c.lastOrder) },
                ].map(stat => (
                  <div key={stat.label} className="bg-[#111311] rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[#aba8a4] mb-1">
                      {stat.icon}
                      <span className="text-[10px]">{stat.label}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#f4efeb]">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Expanded order list */}
              {expanded === c.key && (
                <div className="border-t border-[#2b2f2b] pt-3 space-y-2">
                  {c.orders.map(order => (
                    <div key={order.id} className="flex items-start justify-between py-2 px-3 bg-[#111311] rounded-xl text-xs">
                      <div>
                        <p className="font-medium text-[#f4efeb]">#{order.orderNumber}</p>
                        <p className="text-[#aba8a4] mt-0.5">
                          {order.items.map(i => `${i.name} ×${i.quantity}`).join(', ')}
                        </p>
                        <p className="text-[#aba8a4] mt-0.5">{formatDate(order.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-semibold text-[#5ecf4f]">{formatCurrency(Number(order.total))}</p>
                        <p className="text-[#aba8a4]">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
                        <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full ${
                          order.status === 'COMPLETED' ? 'bg-[#349f2d]/20 text-[#5ecf4f]' :
                          order.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
