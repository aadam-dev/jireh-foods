'use client';

/* Order intake — WhatsApp, phone and walk-up orders taken away from the register.
   ────────────────────────────────────────────────────────────────────────────
   These orders were living in someone's phone and never reaching the system, so
   channel mix and daily totals were always understated. This turns one into a
   real ticket in the same queue as everything else: it appears on the POS open
   tickets rail, gets settled there, and counts in reports.

   Deliberately not a full ordering system — that is a separately scoped
   project. This is the bridge. */

import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Phone, ShoppingBag, Plus, Minus, Trash2, ArrowRight } from 'lucide-react';
import { PageHeader, SectionCard, EmptyState, formatGHS } from '@/src/components/admin/ui';
import { apiGet, errorMessage } from '@/src/lib/api-client';

interface MenuItem { id: string; name: string; price: number; isAvailable: boolean }
interface Category { id: string; name: string; items: MenuItem[] }
interface Line { menuItemId: string; name: string; price: number; quantity: number }

const CHANNELS = [
  { id: 'ONLINE', label: 'WhatsApp', icon: MessageCircle, hint: 'Order came in by message' },
  { id: 'WALK_IN', label: 'Phone', icon: Phone, hint: 'Called the shop' },
  { id: 'BOLT', label: 'Bolt Food', icon: ShoppingBag, hint: 'Placed through Bolt' },
] as const;

export default function IntakePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [channel, setChannel] = useState<string>('ONLINE');
  const [lines, setLines] = useState<Line[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryType, setDeliveryType] = useState('DELIVERY');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ orderNumber: string; total: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<Category[]>('/api/admin/menu');
        setCategories(data);
      } catch (err) {
        setLoadError(errorMessage(err, 'Could not load the menu.'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const available = useMemo(
    () => categories.map(c => ({ ...c, items: c.items.filter(i => i.isAvailable) })).filter(c => c.items.length > 0),
    [categories],
  );

  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);

  const add = (item: MenuItem) =>
    setLines(prev => {
      const ex = prev.find(l => l.menuItemId === item.id);
      if (ex) return prev.map(l => (l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { menuItemId: item.id, name: item.name, price: Number(item.price), quantity: 1 }];
    });

  const bump = (id: string, delta: number) =>
    setLines(prev =>
      prev.map(l => (l.menuItemId === id ? { ...l, quantity: l.quantity + delta } : l)).filter(l => l.quantity > 0),
    );

  const submit = async () => {
    if (lines.length === 0 || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map(l => ({
            menuItemId: l.menuItemId, name: l.name, price: l.price, quantity: l.quantity,
          })),
          // Unpaid on purpose — it joins the open tickets rail and is settled
          // at the register when the customer actually pays.
          paymentMethod: 'UNPAID',
          deliveryType,
          source: channel,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not save this order.');
      }
      const order = await res.json();
      setSaved({ orderNumber: order.orderNumber, total: Number(order.total) });
      setLines([]); setCustomerName(''); setCustomerPhone(''); setNotes('');
    } catch (err) {
      setError(errorMessage(err, 'Could not save this order.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-96 items-center justify-center p-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--fl-brand)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Take an order"
        subtitle="WhatsApp, phone and Bolt orders — logged here, settled at the register."
      />

      {loadError && (
        <div className="rounded-xl border border-[rgba(192,57,43,0.3)] bg-[#FBEAE8] px-4 py-3 text-sm text-[var(--fl-bad)]">
          {loadError}
        </div>
      )}

      {saved && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgba(30,92,58,0.28)] bg-[var(--fl-brand-soft)] px-4 py-3">
          <p className="text-sm text-[var(--fl-ink)]">
            <span className="fl-mono font-semibold">{saved.orderNumber}</span> saved for{' '}
            {formatGHS(saved.total)}. It is now on the register&apos;s open tickets rail.
          </p>
          <button
            onClick={() => setSaved(null)}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[var(--fl-line)] px-3.5 text-[13px] font-medium text-[var(--fl-brand)]"
          >
            Take another <ArrowRight size={13} />
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <SectionCard title="What did they order?" explainer="Tap to add. Prices come from the live menu.">
          {available.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Nothing is available to sell right now."
              body="Every item is switched off in the menu manager."
              actionLabel="Open menu manager"
              actionHref="/admin/menu"
            />
          ) : (
            <div className="space-y-5">
              {available.map(cat => (
                <div key={cat.id}>
                  <p className="fl-label mb-2">{cat.name}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {cat.items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => add(item)}
                        className="min-h-[56px] rounded-xl border border-[var(--fl-line)] bg-[var(--fl-surface-2)] px-3 py-2 text-left transition-colors hover:border-[rgba(30,92,58,0.35)] hover:bg-[var(--fl-brand-soft)]"
                      >
                        <span className="block text-[13px] font-medium text-[var(--fl-ink)]">{item.name}</span>
                        <span className="fl-mono block text-xs text-[var(--fl-ink-2)]">
                          {formatGHS(Number(item.price))}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Who is it for?" explainer="The ticket carries this through to the register.">
          <div className="space-y-4">
            <div>
              <p className="fl-label mb-2">Came in by</p>
              <div className="grid grid-cols-3 gap-2">
                {CHANNELS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setChannel(c.id)}
                    title={c.hint}
                    className={`flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition-colors ${
                      channel === c.id
                        ? 'border-[rgba(30,92,58,0.35)] bg-[var(--fl-brand-soft)] text-[var(--fl-brand)]'
                        : 'border-[var(--fl-line)] text-[var(--fl-ink-2)] hover:bg-[var(--fl-surface-2)]'
                    }`}
                  >
                    <c.icon size={16} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Customer name"
                className="min-h-[44px] rounded-xl border border-[var(--fl-line)] bg-[var(--fl-surface-2)] px-3 text-sm text-[var(--fl-ink)] focus:border-[var(--fl-brand)] focus:outline-none"
              />
              <input
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                inputMode="tel"
                placeholder="Phone"
                className="min-h-[44px] rounded-xl border border-[var(--fl-line)] bg-[var(--fl-surface-2)] px-3 text-sm text-[var(--fl-ink)] focus:border-[var(--fl-brand)] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {['DINE_IN', 'TAKEAWAY', 'DELIVERY'].map(d => (
                <button
                  key={d}
                  onClick={() => setDeliveryType(d)}
                  className={`min-h-[40px] rounded-xl border text-xs font-medium transition-colors ${
                    deliveryType === d
                      ? 'border-[rgba(30,92,58,0.35)] bg-[var(--fl-brand-soft)] text-[var(--fl-brand)]'
                      : 'border-[var(--fl-line)] text-[var(--fl-ink-2)]'
                  }`}
                >
                  {d === 'DINE_IN' ? 'Dine in' : d === 'TAKEAWAY' ? 'Takeaway' : 'Delivery'}
                </button>
              ))}
            </div>

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Notes — landmark, delivery instructions…"
              className="w-full resize-none rounded-xl border border-[var(--fl-line)] bg-[var(--fl-surface-2)] px-3 py-2 text-sm text-[var(--fl-ink)] focus:border-[var(--fl-brand)] focus:outline-none"
            />

            <div className="border-t border-[var(--fl-line)] pt-4">
              {lines.length === 0 ? (
                <p className="text-[13px] text-[var(--fl-ink-3)]">No items yet — tap the menu to build the order.</p>
              ) : (
                <ul className="space-y-2" role="list">
                  {lines.map(l => (
                    <li key={l.menuItemId} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--fl-ink)]">{l.name}</span>
                      <button
                        onClick={() => bump(l.menuItemId, -1)}
                        aria-label={`One less ${l.name}`}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--fl-line)] text-[var(--fl-ink-2)]"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="fl-mono w-5 text-center text-sm font-semibold">{l.quantity}</span>
                      <button
                        onClick={() => bump(l.menuItemId, 1)}
                        aria-label={`One more ${l.name}`}
                        className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--fl-brand)] text-white"
                      >
                        <Plus size={13} />
                      </button>
                      <span className="fl-mono w-16 shrink-0 text-right text-[13px]">
                        {formatGHS(l.price * l.quantity)}
                      </span>
                      <button
                        onClick={() => setLines(prev => prev.filter(x => x.menuItemId !== l.menuItemId))}
                        aria-label={`Remove ${l.name}`}
                        className="text-[var(--fl-ink-3)] hover:text-[var(--fl-bad)]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && <p className="text-[13px] text-[var(--fl-bad)]">{error}</p>}

            <button
              onClick={submit}
              disabled={lines.length === 0 || saving}
              className="w-full min-h-[48px] rounded-full bg-[var(--fl-brand)] text-sm font-semibold text-white transition-colors hover:bg-[var(--fl-brand-hover)] disabled:opacity-40"
            >
              {saving ? 'Saving…' : `Send to kitchen · ${formatGHS(subtotal)}`}
            </button>
            <p className="text-center text-[11px] text-[var(--fl-ink-3)]">
              Payment is taken at the register — this ticket stays open until then.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
