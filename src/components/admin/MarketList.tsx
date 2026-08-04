'use client';

/* Market run & waste log.
   ────────────────────────────────────────────────────────────────────────────
   Two things that happen away from a desk. The market list has to survive the
   trip — so it exports as plain WhatsApp text, which is what actually gets sent
   to whoever is going to Makola. The waste log has to be faster than not
   logging it, or nobody logs it and the cost numbers stay fiction. */

import { useMemo, useState } from 'react';
import { ClipboardList, Copy, Check, Trash2, Loader2 } from 'lucide-react';

export interface StockItem {
  id: string;
  name: string;
  unit: string;
  /** Prisma Decimals arrive as strings — always coerce before comparing. */
  quantity: number | string;
  lowStockThreshold: number | string;
  costPerUnit?: number | string | null;
}

interface NormalisedItem {
  id: string; name: string; unit: string;
  quantity: number; lowStockThreshold: number; costPerUnit: number;
}

function normalise(items: StockItem[]): NormalisedItem[] {
  return items.map(i => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    quantity: Number(i.quantity),
    lowStockThreshold: Number(i.lowStockThreshold),
    costPerUnit: Number(i.costPerUnit ?? 0),
  }));
}

const fmt = (n: number) =>
  `GH₵ ${n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/** Restock back to twice the par level — enough cover without tying up cash. */
function suggestedQty(item: NormalisedItem) {
  return Math.max(0, Math.ceil(item.lowStockThreshold * 2 - item.quantity));
}

export function MarketList({ items }: { items: StockItem[] }) {
  const lowStock = useMemo(
    () => normalise(items).filter(i => i.quantity <= i.lowStockThreshold),
    [items],
  );
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  // Default every low item to "buy it" — unticking is rarer than ticking.
  const isChecked = (id: string) => checked[id] ?? true;
  const selected = lowStock.filter(i => isChecked(i.id));
  const estimate = selected.reduce((s, i) => s + suggestedQty(i) * i.costPerUnit, 0);

  const whatsappText = useMemo(() => {
    const date = new Date().toLocaleDateString('en-GH', { day: 'numeric', month: 'long' });
    const lines = selected.map(i => `• ${i.name} — ${suggestedQty(i)} ${i.unit}`);
    const head = `Market run — ${date}`;
    const tail = estimate > 0 ? `\nEstimated: ${fmt(estimate)}` : '';
    return `${head}\n${lines.join('\n')}${tail}`;
  }, [selected, estimate]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions) — the textarea below
      // is still selectable, so the run isn't lost.
    }
  };

  if (lowStock.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#2b2f2b] bg-[#111311] px-5 py-8 text-center">
        <ClipboardList size={20} className="mx-auto mb-2 text-[#349f2d]" />
        <p className="text-sm text-[#f4efeb]">Nothing to buy — every ingredient is above its par level.</p>
        <p className="mt-1 text-xs text-[#aba8a4]">
          Items drop onto this list automatically when they run low.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#f4efeb]">
            Market run — {new Date().toLocaleDateString('en-GH', { day: 'numeric', month: 'long' })}
          </p>
          <p className="text-xs text-[#aba8a4]">
            {selected.length} of {lowStock.length} item{lowStock.length === 1 ? '' : 's'}
            {estimate > 0 && <> · estimated {fmt(estimate)}</>}
          </p>
        </div>
        <button
          onClick={copy}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#349f2d] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#287e22]"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? 'Copied' : 'Copy for WhatsApp'}
        </button>
      </div>

      <ul className="divide-y divide-[#2b2f2b] overflow-hidden rounded-2xl border border-[#2b2f2b] bg-[#191c19]" role="list">
        {lowStock.map(item => {
          const qty = suggestedQty(item);
          const cost = qty * item.costPerUnit;
          return (
            <li key={item.id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[#1b1e1b]">
                <input
                  type="checkbox"
                  checked={isChecked(item.id)}
                  onChange={e => setChecked(prev => ({ ...prev, [item.id]: e.target.checked }))}
                  className="h-5 w-5 shrink-0 accent-[#349f2d]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[#f4efeb]">{item.name}</span>
                  <span className="block font-mono text-[11px] text-[#aba8a4]">
                    {item.quantity} {item.unit} left · par {item.lowStockThreshold} {item.unit}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm font-semibold text-[#f4efeb]">
                    {qty} {item.unit}
                  </span>
                  {cost > 0 && (
                    <span className="block font-mono text-[11px] text-[#aba8a4]">≈ {fmt(cost)}</span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <details className="rounded-xl border border-[#2b2f2b] bg-[#111311] px-4 py-3">
        <summary className="cursor-pointer text-xs text-[#aba8a4]">Preview the WhatsApp message</summary>
        <textarea
          readOnly
          value={whatsappText}
          rows={Math.min(12, selected.length + 3)}
          className="mt-3 w-full resize-none rounded-lg bg-[#0a0b0a] p-3 font-mono text-xs text-[#f4efeb]"
        />
      </details>
    </div>
  );
}

/* ── Waste log ─────────────────────────────────────────────────────────────
   Reasons are fixed rather than free text: four buttons get logged, a text
   box gets skipped. These feed true cost in the reports. */
const WASTE_REASONS = ['Spoiled', 'Burnt', 'Comp', 'Staff meal'] as const;

export function WasteLog({
  items,
  onLogged,
}: {
  items: StockItem[];
  onLogged: () => void;
}) {
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<string>(WASTE_REASONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [justLogged, setJustLogged] = useState('');

  const stock = useMemo(() => normalise(items), [items]);
  const item = stock.find(i => i.id === itemId);
  const quantity = parseFloat(qty);
  const valid = !!item && Number.isFinite(quantity) && quantity > 0;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          type: 'WASTE',
          quantity,
          notes: reason,
          unitCost: item && item.costPerUnit > 0 ? item.costPerUnit : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not log the waste.');
      }
      setJustLogged(`${quantity} ${item!.unit} of ${item!.name} logged as ${reason.toLowerCase()}.`);
      setQty('');
      setItemId('');
      onLogged();
      setTimeout(() => setJustLogged(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log the waste.');
    } finally {
      setSaving(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#2b2f2b] bg-[#111311] px-5 py-8 text-center">
        <Trash2 size={20} className="mx-auto mb-2 text-[#aba8a4]" />
        <p className="text-sm text-[#f4efeb]">Add ingredients first, then you can log what gets wasted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[#2b2f2b] bg-[#191c19] p-4">
      <div>
        <p className="text-sm font-semibold text-[#f4efeb]">Log waste</p>
        <p className="text-xs text-[#aba8a4]">
          Spoiled, burnt or given away — logging it is what makes the cost figures true.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
        <select
          value={itemId}
          onChange={e => setItemId(e.target.value)}
          className="min-h-[46px] rounded-xl border border-[#2b2f2b] bg-[#111311] px-3 text-sm text-[#f4efeb] focus:border-[#349f2d] focus:outline-none"
        >
          <option value="">Choose an ingredient…</option>
          {stock.map(i => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.quantity} {i.unit} left)
            </option>
          ))}
        </select>
        <input
          value={qty}
          onChange={e => setQty(e.target.value)}
          inputMode="decimal"
          placeholder={item ? item.unit : 'Qty'}
          className="min-h-[46px] rounded-xl border border-[#2b2f2b] bg-[#111311] px-3 text-sm text-[#f4efeb] placeholder:text-[#aba8a4]/50 focus:border-[#349f2d] focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {WASTE_REASONS.map(r => (
          <button
            key={r}
            onClick={() => setReason(r)}
            className={`min-h-[40px] rounded-full border px-4 text-sm font-medium transition-colors ${
              reason === r
                ? 'border-[#349f2d]/50 bg-[#349f2d]/20 text-[#5ecf4f]'
                : 'border-[#2b2f2b] text-[#aba8a4] hover:text-[#f4efeb]'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {justLogged && <p className="text-xs text-[#5ecf4f]">{justLogged}</p>}

      <button
        onClick={submit}
        disabled={!valid || saving}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#349f2d] text-sm font-semibold text-white transition-colors hover:bg-[#287e22] disabled:opacity-40"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
        {saving ? 'Logging…' : 'Log waste'}
      </button>
    </div>
  );
}
