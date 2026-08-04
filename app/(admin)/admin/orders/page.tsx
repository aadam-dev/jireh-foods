'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Search, RefreshCw, XCircle, AlertTriangle, Clock, History } from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Badge, OrderStatusBadge, PaymentBadge } from '@/src/components/ui/Badge';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Modal } from '@/src/components/ui/Modal';
import { formatCurrency, formatDateTime } from '@/src/lib/utils';
import { ShoppingBag } from 'lucide-react';
import {
  ORDER_EVENT_LABELS,
  VOID_INVENTORY_LABELS,
  VOID_REASON_LABELS,
  type TransactionSnapshot,
} from '@/src/lib/order-events';

const STATUSES = ['ALL', 'PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
const VOID_REASONS = Object.keys(VOID_REASON_LABELS);
const INVENTORY_ACTIONS = Object.keys(VOID_INVENTORY_LABELS);

function defaultInventoryAction(voidReason: string): string {
  if (voidReason === 'NO_SHOW' || voidReason === 'QUALITY_ISSUE') return 'WASTE';
  if (voidReason === 'WRONG_ORDER' || voidReason === 'DUPLICATE') return 'NONE';
  return 'RESTOCK';
}

function formatSessionLabel(session: any) {
  if (!session) return 'Unknown shift';
  const opened = formatDateTime(session.openedAt);
  const opener = session.openedByUser?.name ?? 'Staff';
  const status = session.status === 'OPEN' ? 'Open' : 'Closed';
  return `${opened} — ${opener} (${status})`;
}

function renderEventDetail(event: any) {
  const p = event.payload ?? {};
  switch (event.type) {
    case 'STATUS_CHANGED':
      return `${p.from} → ${p.to}`;
    case 'VOIDED':
      return [
        event.reason,
        p.inventoryAction ? `Inventory: ${VOID_INVENTORY_LABELS[p.inventoryAction] ?? p.inventoryAction}` : null,
      ].filter(Boolean).join(' · ');
    case 'PAYMENT_UPDATED':
      return `${p.from} → ${p.to}`;
    case 'NOTE_ADDED':
      return p.notes ? `"${p.notes}"` : null;
    case 'CREATED':
      return p.source ? `Source: ${p.source}` : null;
    default:
      return event.reason ?? null;
  }
}

export default function OrdersPage() {
  const { data: authSession } = useSession();
  const userRole = (authSession?.user as any)?.role ?? '';
  const canVoid = ['OWNER', 'MANAGER'].includes(userRole);
  const canUpdateStatus = canVoid;

  const [orders, setOrders] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [sessionFilter, setSessionFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [updating, setUpdating] = useState(false);

  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReasonCode, setVoidReasonCode] = useState('CUSTOMER_CANCELLED');
  const [voidReasonDetail, setVoidReasonDetail] = useState('');
  const [voidInventoryAction, setVoidInventoryAction] = useState('RESTOCK');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    const res = await fetch('/api/admin/sessions?limit=50');
    const data = await res.json();
    setSessions(data.sessions ?? []);
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
      if (sessionFilter !== 'ALL') params.set('sessionId', sessionFilter);
      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter, sessionFilter]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filtered = orders.filter(o =>
    !search ||
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    (o.customerName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openOrderDetail = async (order: any) => {
    setSelected(order);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`);
      if (res.ok) {
        const detail = await res.json();
        setSelected(detail);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await fetchOrders();
        await openOrderDetail({ id });
      }
    } finally {
      setUpdating(false);
    }
  };

  const openVoidModal = () => {
    setVoidReasonCode('CUSTOMER_CANCELLED');
    setVoidReasonDetail('');
    setVoidInventoryAction('RESTOCK');
    setVoidError(null);
    setVoidOpen(true);
  };

  const onVoidReasonChange = (code: string) => {
    setVoidReasonCode(code);
    setVoidInventoryAction(defaultInventoryAction(code));
    setVoidError(null);
  };

  const submitVoid = async () => {
    if (!selected) return;
    if (voidReasonCode === 'OTHER' && voidReasonDetail.trim().length < 3) {
      setVoidError('Please provide details when reason is Other (at least 3 characters).');
      return;
    }
    setVoiding(true);
    setVoidError(null);
    try {
      const res = await fetch(`/api/admin/orders/${selected.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voidReason: voidReasonCode,
          reasonDetail: voidReasonDetail.trim() || undefined,
          inventoryAction: voidInventoryAction,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVoidError(data.error ?? 'Failed to void order.');
        return;
      }
      setVoidOpen(false);
      setSelected(null);
      await fetchOrders();
    } catch {
      setVoidError('Network error — please try again.');
    } finally {
      setVoiding(false);
    }
  };

  const snapshot = (selected?.transactionSnapshot ?? null) as TransactionSnapshot | null;
  const displayItems = snapshot?.items ?? selected?.items ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Orders</h1>
          <p className="text-sm text-[#aba8a4]">{total} total orders</p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={fetchOrders} loading={loading}>
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'px-3 py-1.5 rounded-xl text-xs font-medium transition border',
                statusFilter === s
                  ? 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40'
                  : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540] hover:text-[#f4efeb]',
              ].join(' ')}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <select
          value={sessionFilter}
          onChange={e => setSessionFilter(e.target.value)}
          className="bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-1.5 text-xs text-[#f4efeb] focus:outline-none focus:border-[#349f2d]/60 max-w-[280px]"
        >
          <option value="ALL">All shifts</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              {formatSessionLabel(s)} ({s._count?.orders ?? 0} order{(s._count?.orders ?? 0) === 1 ? '' : 's'})
            </option>
          ))}
        </select>

        <div className="ml-auto w-64">
          <Input
            placeholder="Search order or customer…"
            icon={<Search size={14} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

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
                  {['Order #', 'Time', 'Items', 'Cashier', 'Payment', 'Total', 'Status', ''].map(h => (
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
                    <td className="px-4 py-3 text-[#aba8a4]">{order.staff?.name || '—'}</td>
                    <td className="px-4 py-3"><PaymentBadge method={order.paymentMethod} /></td>
                    <td className="px-4 py-3 font-semibold text-[#f4efeb] whitespace-nowrap">{formatCurrency(order.total)}</td>
                    <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="xs" onClick={() => openOrderDetail(order)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Order ${selected?.orderNumber}`} size="lg">
        {selected && (
          <div className="space-y-5">
            {detailLoading && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Status', value: <OrderStatusBadge status={selected.status} /> },
                { label: 'Payment', value: <PaymentBadge method={selected.paymentMethod} /> },
                { label: 'Source', value: <Badge>{selected.source}</Badge> },
                { label: 'Type', value: <Badge>{selected.deliveryType}</Badge> },
                { label: 'Cashier', value: selected.staff?.name || '—' },
                { label: 'Shift', value: selected.session ? formatSessionLabel(selected.session) : '—' },
                { label: 'Customer', value: selected.customerName || '—' },
                { label: 'Time', value: formatDateTime(selected.createdAt) },
              ].map(row => (
                <div key={row.label}>
                  <p className="text-xs text-[#aba8a4] mb-1">{row.label}</p>
                  <div className="text-sm text-[#f4efeb]">{row.value}</div>
                </div>
              ))}
            </div>

            {/* As transacted snapshot */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} className="text-[#5ecf4f]" />
                <p className="text-xs font-semibold text-[#aba8a4] uppercase tracking-wider">
                  As transacted {snapshot ? `(captured ${formatDateTime(snapshot.capturedAt)})` : ''}
                </p>
              </div>
              {!snapshot && (
                <p className="text-[10px] text-[#aba8a4] mb-2">
                  No snapshot on file — showing current order lines (older orders before audit rollout).
                </p>
              )}
              <div className="space-y-2 bg-[#111311] rounded-xl p-3 border border-[#2b2f2b]">
                {displayItems.map((item: any, idx: number) => (
                  <div key={item.id ?? idx} className="flex justify-between py-1.5 border-b border-[#2b2f2b] last:border-0">
                    <span className="text-sm text-[#f4efeb]">
                      {item.quantity}× {item.name}
                      {item.notes && <span className="text-[#aba8a4] text-xs ml-1">({item.notes})</span>}
                    </span>
                    <span className="text-sm font-medium text-[#f4efeb]">
                      {formatCurrency(item.subtotal ?? Number(item.price) * item.quantity)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-[#2b2f2b]">
                  <span className="text-sm text-[#aba8a4]">Subtotal</span>
                  <span className="text-sm text-[#f4efeb]">{formatCurrency(snapshot?.subtotal ?? selected.subtotal)}</span>
                </div>
                {(snapshot?.discountAmount ?? Number(selected.discountAmount)) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-[#aba8a4]">Discount</span>
                    <span className="text-sm text-red-400">−{formatCurrency(snapshot?.discountAmount ?? selected.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-[#f4efeb]">Total</span>
                  <span className="text-sm font-bold text-[#5ecf4f]">{formatCurrency(snapshot?.total ?? selected.total)}</span>
                </div>
                {snapshot?.tenderedAmount != null && (
                  <div className="flex justify-between text-xs text-[#aba8a4]">
                    <span>Tendered / Change</span>
                    <span>{formatCurrency(snapshot.tenderedAmount)} / {formatCurrency(snapshot.changeAmount ?? 0)}</span>
                  </div>
                )}
                {snapshot?.splitPayments && Array.isArray(snapshot.splitPayments) && (
                  <div className="pt-1 space-y-1">
                    {(snapshot.splitPayments as any[]).map((leg, i) => (
                      <div key={i} className="flex justify-between text-xs text-[#aba8a4]">
                        <span>{leg.method}</span>
                        <span>{formatCurrency(leg.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <History size={14} className="text-[#5ecf4f]" />
                <p className="text-xs font-semibold text-[#aba8a4] uppercase tracking-wider">Timeline</p>
              </div>
              {selected.events?.length ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selected.events.map((event: any) => (
                    <div key={event.id} className="flex gap-3 text-xs border-l-2 border-[#349f2d]/30 pl-3 py-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-[#f4efeb] font-medium">
                          {ORDER_EVENT_LABELS[event.type as keyof typeof ORDER_EVENT_LABELS] ?? event.type}
                        </p>
                        {renderEventDetail(event) && (
                          <p className="text-[#aba8a4] mt-0.5">{renderEventDetail(event)}</p>
                        )}
                        <p className="text-[#aba8a4]/70 mt-0.5">
                          {event.actor?.name ?? 'System'} · {formatDateTime(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#aba8a4]">No events recorded yet.</p>
              )}
            </div>

            {canUpdateStatus && selected.status !== 'COMPLETED' && selected.status !== 'CANCELLED' && (
              <div>
                <p className="text-xs font-semibold text-[#aba8a4] uppercase tracking-wider mb-2">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {['PREPARING', 'READY', 'COMPLETED'].map(s => (
                    <Button
                      key={s}
                      variant={s === 'COMPLETED' ? 'success' : 'secondary'}
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

            {canVoid && selected.status !== 'CANCELLED' && (
              <div className="border-t border-[#2b2f2b] pt-4">
                <p className="text-xs font-semibold text-[#aba8a4] uppercase tracking-wider mb-2">Manager Actions</p>
                <Button variant="danger" size="sm" icon={<XCircle size={14} />} onClick={openVoidModal}>
                  Void / Refund Order
                </Button>
                <p className="text-[10px] text-[#aba8a4] mt-1.5">
                  Requires a reason and inventory action. Recorded on the order timeline and audit log.
                </p>
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

      <Modal
        open={voidOpen}
        onClose={() => { if (!voiding) setVoidOpen(false); }}
        title="Void / Refund Order"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setVoidOpen(false)} disabled={voiding}>Cancel</Button>
            <Button variant="danger" onClick={submitVoid} loading={voiding} icon={<XCircle size={14} />}>
              Confirm Void
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 leading-relaxed">
              This will mark order <strong className="text-red-200">{selected?.orderNumber}</strong> as
              cancelled ({formatCurrency(selected?.total)}). Immutable snapshot is preserved; action is logged.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#aba8a4] mb-1.5">
              Void reason <span className="text-red-400">*</span>
            </label>
            <select
              value={voidReasonCode}
              onChange={e => onVoidReasonChange(e.target.value)}
              className="w-full bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] focus:outline-none focus:border-[#349f2d]/60"
            >
              {VOID_REASONS.map(code => (
                <option key={code} value={code}>{VOID_REASON_LABELS[code]}</option>
              ))}
            </select>
          </div>

          {voidReasonCode === 'OTHER' && (
            <div>
              <label className="block text-xs font-medium text-[#aba8a4] mb-1.5">Details <span className="text-red-400">*</span></label>
              <textarea
                value={voidReasonDetail}
                onChange={e => { setVoidReasonDetail(e.target.value); setVoidError(null); }}
                placeholder="Describe what happened…"
                rows={2}
                className="w-full bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] placeholder:text-[#aba8a4]/50 focus:outline-none focus:border-[#349f2d]/60 resize-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#aba8a4] mb-2">Inventory action</label>
            <div className="space-y-2">
              {INVENTORY_ACTIONS.map(action => (
                <label key={action} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="inventoryAction"
                    checked={voidInventoryAction === action}
                    onChange={() => setVoidInventoryAction(action)}
                    className="mt-1 accent-[#349f2d]"
                  />
                  <div>
                    <p className="text-sm text-[#f4efeb]">{VOID_INVENTORY_LABELS[action]}</p>
                    {action === 'RESTOCK' && (
                      <p className="text-[10px] text-[#aba8a4]">Use when food was not prepared — ingredients go back to stock.</p>
                    )}
                    {action === 'WASTE' && (
                      <p className="text-[10px] text-[#aba8a4]">Use for no-show or prepared orders — logs waste, does not restore stock.</p>
                    )}
                    {action === 'NONE' && (
                      <p className="text-[10px] text-[#aba8a4]">Use for wrong order / duplicate — no inventory adjustment.</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {voidError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertTriangle size={13} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-300">{voidError}</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
