'use client';

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, X, LogOut,
  LayoutDashboard, ChevronRight, Banknote, Smartphone, CreditCard,
  Building2, CheckCircle2, Printer, RotateCcw, Clock, AlertCircle,
  Lock, Unlock, Receipt, ChevronDown, Pencil, Zap,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { formatCurrency, formatTime } from '@/src/lib/utils';
import { enqueueOrder, getPendingOrders, syncPendingOrders } from '@/src/lib/offlineQueue';
import { businessDateKey, classifyRegisterSession } from '@/src/lib/session-utils';
import {
  defaultModifiers, defaultOptionByGroup,
  type ChosenModifier, type ModifierGroup,
} from '@/src/lib/modifiers';
import { Combobox, type ComboboxOption } from '@/src/components/ui/Combobox';
import { cleanName, customerLabel } from '@/src/lib/customer';
import { computeOrderTotals, changeDue } from '@/src/lib/money';
import { DEVELOPER_CREDIT, RECEIPT_CREDIT_LINES } from '@/src/lib/developer-credit';

/* ─── Types ─────────────────────────────────────────────────────────── */
/* One cart line. Keyed by lineId, not menuItemId: the same dish ordered two
   ways ("Jollof, grilled" and "Jollof, fried") has to stay two lines. */
interface CartItem {
  lineId: string;
  menuItemId: string;
  name: string;
  /** Menu price before extras — kept so the sheet can re-price on edit. */
  basePrice: number;
  /** basePrice + the chosen deltas; this is what the line charges. */
  price: number;
  quantity: number;
  notes?: string;
  modifiers: ChosenModifier[];
}
interface MenuItem {
  id: string; name: string; price: number; description?: string;
  isPopular: boolean; image?: string | null; isAvailable: boolean;
  modifierGroups?: ModifierGroup[];
}
interface MenuCategory { id: string; name: string; items: MenuItem[] }

/** Same dish + same choices = same line. Sorted so order of tapping is irrelevant. */
function cartLineId(menuItemId: string, optionIds: string[]) {
  return optionIds.length ? `${menuItemId}|${[...optionIds].sort().join(',')}` : menuItemId;
}
interface PosSession { id: string; openedByUser: { id?: string; name: string }; openedAt: string; openingFloat: number; status: string }
interface SessionStats { revenue: number; cashRevenue: number; momoRevenue: number; boltRevenue: number }
type RegisterGate = 'checking' | 'continue' | 'stale' | 'open_new' | 'active';

const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Cash', icon: Banknote },
  { id: 'MOMO', label: 'MoMo', icon: Smartphone },
  { id: 'BOLT_FOOD', label: 'Bolt Food', icon: Zap },
];
const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash', MOMO: 'Mobile Money', BOLT_FOOD: 'Bolt Food',
  CARD: 'Card', BANK_TRANSFER: 'Bank Transfer', UNPAID: 'Unpaid',
  SPLIT: 'Split Payment',
};
const DELIVERY_TYPES = [
  { id: 'DINE_IN', label: 'Dine In' },
  { id: 'TAKEAWAY', label: 'Takeaway' },
  { id: 'DELIVERY', label: 'Delivery' },
];

function cartStorageKey(userId?: string) {
  return userId ? `jireh_pos_cart_${userId}` : 'jireh_pos_cart_pending';
}

/* ─── Shift acknowledgement ──────────────────────────────────────────
   Which shift this cashier has already said "yes, I'm on it" to. Once
   acknowledged, refreshing the tab or relaunching the PWA mid-shift drops
   straight back into selling instead of re-asking — a register that
   re-interrogates its cashier between sales is the classic POS annoyance.

   Scoped per user so a handover still shows the new cashier whose drawer
   they are on, and stamped with the business day so a till left open
   overnight surfaces the stale-shift warning once the next morning. */
function shiftAckKey(userId?: string) {
  return userId ? `jireh_pos_shift_ack_${userId}` : 'jireh_pos_shift_ack_pending';
}

function readShiftAck(userId?: string): string | null {
  try {
    const raw = localStorage.getItem(shiftAckKey(userId));
    if (!raw) return null;
    const { id, day } = JSON.parse(raw) as { id?: string; day?: string };
    if (!id || day !== businessDateKey()) return null;
    return id;
  } catch { return null; }
}

function writeShiftAck(sessionId: string, userId?: string) {
  try {
    localStorage.setItem(shiftAckKey(userId), JSON.stringify({ id: sessionId, day: businessDateKey() }));
  } catch {}
}

function clearShiftAck(userId?: string) {
  try { localStorage.removeItem(shiftAckKey(userId)); } catch {}
}

/* ─── Tile artwork ───────────────────────────────────────────────────
   Items without a photo (meat pie, buns, millet, brukina…) used to render a
   30%-opacity plate emoji on a short tile — invisible during a rush and it
   made the grid ragged. Give every photo-less item a solid, colour-coded
   glyph tile at the same height as a photo so staff can still tap by sight. */
const TILE_ART: { match: RegExp; glyph: string; tint: string }[] = [
  { match: /pie|buns|bread|pastry|cake|doughnut|spring roll/i, glyph: '🥧', tint: '#8a5a1f' },
  { match: /sobolo|brukina|millet|yoghurt|smoothie|juice|drink|water|malt|soda|coke|fanta|sprite/i, glyph: '🥤', tint: '#1f5a6b' },
  { match: /jollof|rice|fried rice/i, glyph: '🍚', tint: '#7a4a1a' },
  { match: /fufu|banku|kenkey|tuo|soup|stew/i, glyph: '🍲', tint: '#6b3f1f' },
  { match: /chicken|fries|grill|kebab|meat|fish|tilapia/i, glyph: '🍗', tint: '#7a3a2a' },
];

function tileArt(name: string) {
  return (
    TILE_ART.find(a => a.match.test(name)) ?? { glyph: '🍽', tint: '#2b3a2b' }
  );
}

/* ─── Numpad Component ───────────────────────────────────────────────── */
function Numpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const press = (k: string) => {
    if (k === '⌫') { onChange(value.slice(0, -1) || '0'); return; }
    if (k === '.' && value.includes('.')) return;
    if (value === '0' && k !== '.') { onChange(k); return; }
    onChange(value + k);
  };
  const keys = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {keys.map(k => (
        <button key={k} onClick={() => press(k)}
          className="py-3 rounded-xl bg-[#191c19] border border-[#2b2f2b] text-[#f4efeb] font-semibold text-lg hover:bg-[#232623] active:scale-95 transition">
          {k}
        </button>
      ))}
    </div>
  );
}

/* Customer capture. One component, mounted on both the cart panel and the
   payment screen against the same state, so wherever the cashier thinks to
   add a name, the field is there. Empty is a walk-in — nothing is stored. */
function CustomerFields({
  name, onName, phone, onPhone, matches,
}: {
  name: string;
  onName: (v: string) => void;
  phone: string;
  onPhone: (v: string) => void;
  matches: ComboboxOption[];
}) {
  return (
    <div className="space-y-2">
      <Combobox
        value={name}
        onChange={onName}
        // Picking a known customer brings their number along, so a regular is
        // one tap rather than two fields.
        onPick={opt => { if (opt.sub) onPhone(opt.sub); }}
        options={matches}
        placeholder="Customer name — leave empty for walk-in"
      />
      {/* The phone only earns its space once there is a name to attach it to. */}
      {name.trim() && (
        <input
          value={phone}
          onChange={e => onPhone(e.target.value)}
          placeholder="Phone (optional)"
          inputMode="tel"
          className="w-full rounded-xl border border-[#2b2f2b] bg-[#111311] px-3 py-2.5 text-sm text-[#f4efeb] placeholder:text-[#5f635f] focus:border-[#349f2d] focus:outline-none"
        />
      )}
    </div>
  );
}

/* ─── Modifier sheet ─────────────────────────────────────────────────
   Bottom sheet on tile tap for dishes that have choices. Big targets, one
   screenful, and a required group blocks Add until it's answered — during a
   rush the cashier should never have to think about what's missing. */
function ModifierSheet({
  item,
  onCancel,
  onConfirm,
}: {
  item: MenuItem;
  onCancel: () => void;
  onConfirm: (mods: ChosenModifier[]) => void;
}) {
  const groups = item.modifierGroups ?? [];
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    // Pre-select the first option of each required single-choice group — the
    // same seed quick-sale mode applies, kept in one place so the two paths
    // cannot drift apart.
    const init: Record<string, string[]> = {};
    for (const [groupId, option] of Object.entries(defaultOptionByGroup(item))) {
      init[groupId] = [option.id];
    }
    return init;
  });

  const toggle = (group: ModifierGroup, optionId: string) => {
    setSelected(prev => {
      const current = prev[group.id] ?? [];
      if (group.selection === 'SINGLE') {
        // Tapping the chosen option again clears it, unless the group is required.
        if (current[0] === optionId) return group.isRequired ? prev : { ...prev, [group.id]: [] };
        return { ...prev, [group.id]: [optionId] };
      }
      return {
        ...prev,
        [group.id]: current.includes(optionId)
          ? current.filter(id => id !== optionId)
          : [...current, optionId],
      };
    });
  };

  const chosen: ChosenModifier[] = groups.flatMap(g =>
    (selected[g.id] ?? []).map(id => {
      const o = g.options.find(x => x.id === id)!;
      return { optionId: o.id, groupName: g.name, name: o.name, priceDelta: o.priceDelta };
    }),
  );

  const missing = groups.filter(g => g.isRequired && (selected[g.id] ?? []).length === 0);
  const linePrice = item.price + chosen.reduce((s, m) => s + m.priceDelta, 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative flex max-h-[88vh] w-full flex-col rounded-t-3xl border-t border-[#2b2f2b] bg-[#191c19] sm:max-w-md sm:rounded-3xl sm:border">
        <div className="shrink-0 border-b border-[#2b2f2b] px-5 py-4">
          <p className="text-base font-bold text-[#f4efeb]">{item.name}</p>
          <p className="mt-0.5 text-xs text-[#aba8a4]">{formatCurrency(item.price)} base</p>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {groups.map(group => (
            <div key={group.id}>
              <div className="mb-2 flex items-baseline gap-2">
                <p className="text-sm font-semibold text-[#f4efeb]">{group.name}</p>
                {group.isRequired ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-yellow-400">Required</span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wide text-[#aba8a4]">
                    {group.selection === 'MULTI' ? 'Choose any' : 'Optional'}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {group.options.map(option => {
                  const on = (selected[group.id] ?? []).includes(option.id);
                  return (
                    <button
                      key={option.id}
                      onClick={() => toggle(group, option.id)}
                      className={`min-h-[56px] rounded-xl border px-3 py-2 text-left transition active:scale-[0.97] ${
                        on
                          ? 'border-[#349f2d]/60 bg-[#349f2d]/20'
                          : 'border-[#2b2f2b] bg-[#111311] hover:border-[#404540]'
                      }`}
                    >
                      <span className={`block text-sm font-medium ${on ? 'text-[#5ecf4f]' : 'text-[#f4efeb]'}`}>
                        {option.name}
                      </span>
                      {option.priceDelta !== 0 && (
                        <span className="mt-0.5 block font-mono text-xs text-[#aba8a4]">
                          {option.priceDelta > 0 ? '+' : '−'}{formatCurrency(Math.abs(option.priceDelta))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="shrink-0 space-y-2 border-t border-[#2b2f2b] px-5 py-4">
          <button
            onClick={() => onConfirm(chosen)}
            disabled={missing.length > 0}
            className="w-full min-h-[54px] rounded-2xl bg-[#349f2d] font-bold text-white transition-colors hover:bg-[#287e22] disabled:opacity-40"
          >
            {missing.length > 0
              ? `Choose ${missing[0].name.toLowerCase()}`
              : `Add · ${formatCurrency(linePrice)}`}
          </button>
          <button
            onClick={onCancel}
            className="w-full min-h-[46px] rounded-2xl border border-[#2b2f2b] text-sm text-[#aba8a4] transition-colors hover:text-[#f4efeb]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Header clock ───────────────────────────────────────────────────
   Isolated on purpose. This ticks once a second; when the state lived in the
   page component every tick re-rendered the whole register — menu grid, tiles,
   cart and all — which is exactly the jank you feel on a cheap tablet mid-rush.
   Keeping it here means one <span> repaints instead of the screen. */
function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // null until mounted so server and client markup agree
  if (!now) return <span className="hidden md:block w-[68px]" />;

  return (
    <span className="text-xs font-mono text-[#aba8a4] hidden md:block tabular-nums">
      {now.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

/* ─── Denomination counter ───────────────────────────────────────────
   Counting a drawer by typing one total invites fat-finger errors and gives
   no way to recheck. Count the notes and coins instead — the total is derived,
   and the breakdown is stored with the shift so a difference can be traced. */
const GHS_DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1];

const denomLabel = (d: number) => (d >= 1 ? `GH₵${d}` : `${Math.round(d * 100)}p`);

function DenominationCounter({
  counts,
  onChange,
}: {
  counts: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  const bump = (d: number, delta: number) => {
    const key = String(d);
    const next = Math.max(0, (counts[key] ?? 0) + delta);
    const updated = { ...counts };
    if (next === 0) delete updated[key];
    else updated[key] = next;
    onChange(updated);
  };

  return (
    <div className="space-y-1.5">
      {GHS_DENOMINATIONS.map(d => {
        const qty = counts[String(d)] ?? 0;
        const line = qty * d;
        return (
          <div
            key={d}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
              qty > 0 ? 'bg-[#349f2d]/10 border-[#349f2d]/30' : 'bg-[#111311] border-[#2b2f2b]'
            }`}
          >
            <span className="w-16 shrink-0 font-mono text-sm font-semibold text-[#f4efeb]">
              {denomLabel(d)}
            </span>
            <button
              onClick={() => bump(d, -1)}
              disabled={qty === 0}
              aria-label={`One less ${denomLabel(d)}`}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#2b2f2b] text-[#aba8a4] transition-colors hover:text-[#f4efeb] active:scale-95 disabled:opacity-30"
            >
              <Minus size={14} />
            </button>
            <span className="w-8 shrink-0 text-center font-mono text-base font-bold tabular-nums text-[#f4efeb]">
              {qty}
            </span>
            <button
              onClick={() => bump(d, 1)}
              aria-label={`One more ${denomLabel(d)}`}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#2b2f2b] text-[#aba8a4] transition-colors hover:text-[#f4efeb] active:scale-95"
            >
              <Plus size={14} />
            </button>
            <span className="ml-auto font-mono text-sm tabular-nums text-[#aba8a4]">
              {line > 0 ? formatCurrency(line) : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function denominationTotal(counts: Record<string, number>) {
  return Object.entries(counts).reduce((s, [d, q]) => s + Number(d) * q, 0);
}

/* ─── Receipt Component ─────────────────────────────────────────────── */
const DELIVERY_LABELS: Record<string, string> = {
  DINE_IN: 'Dine In', TAKEAWAY: 'Takeaway', DELIVERY: 'Delivery',
};

function Receipt80mm({
  order,
  businessName = 'JIREH NATURAL FOODS',
  businessPhone = '055 113 3481',
  businessAddress = 'Adenta Housing Down, Accra',
  receiptHeader = 'Fresh & Healthy — Always',
  receiptFooter = 'Thank you for your patronage!',
  preview = false,
}: {
  order: any;
  businessName?: string;
  businessPhone?: string;
  businessAddress?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  /** Render on screen as paper instead of as the hidden print element. */
  preview?: boolean;
}) {
  // Kitchen/pickup "call number" — last numeric block of the order number (e.g. JNF-20260601-1234 → 1234)
  const callNumber = (order.orderNumber?.split('-').pop()) || order.orderNumber;
  // Subtotal: prefer server value, else derive from line items
  const subtotal = Number(
    order.subtotal ?? order.items?.reduce((s: number, i: any) => s + (i.subtotal ?? i.price * i.quantity), 0) ?? order.total
  );
  const discount = Number(order.discountAmount ?? 0);
  const tax = Number(order.taxAmount ?? 0);
  const dash = 'border-t border-dashed border-black';

  return (
    /* Two modes, one component, so what the cashier checks on screen is
       literally the same markup that goes to the printer — a preview built
       separately would drift from the paper the customer is handed. */
    <div
      id={preview ? undefined : 'receipt-print'}
      className={
        preview
          ? 'print:hidden font-mono text-[11px] leading-tight w-[72mm] mx-auto text-black bg-white rounded-lg px-3 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.45)]'
          : 'hidden print:block font-mono text-[11px] leading-tight w-[72mm] mx-auto text-black'
      }
    >

      {/* ── Brand header ── */}
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/jireh/logo.jpg"
          alt={businessName}
          className="mx-auto mb-1 w-16 h-16 object-contain rounded-full"
          style={{ filter: 'grayscale(100%) contrast(1.4)' }}
        />
        <div className="font-bold text-[15px] tracking-wide">{businessName.toUpperCase()}</div>
        {receiptHeader && <div className="text-[10px]">{receiptHeader}</div>}
        {businessAddress && <div className="text-[10px]">{businessAddress}</div>}
        <div className="text-[10px]">Tel: {businessPhone}</div>
      </div>

      {/* ── Order meta ── */}
      <div className={`${dash} mt-2 pt-1.5 space-y-0.5`}>
        <div className="flex justify-between"><span>Date</span><span>{new Date(order.createdAt).toLocaleString('en-GH', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
        <div className="flex justify-between"><span>Ticket</span><span>{order.orderNumber}</span></div>
        {/* Only printed when a real name was given — a receipt that says
            "Walk-in" tells the customer nothing they don't know. */}
        {cleanName(order.customerName) && (
          <div className="flex justify-between"><span>Customer</span><span>{cleanName(order.customerName)}</span></div>
        )}
        {order.staff?.name && <div className="flex justify-between"><span>Served by</span><span>{order.staff.name}</span></div>}
        {order.deliveryType && <div className="flex justify-between"><span>Type</span><span>{DELIVERY_LABELS[order.deliveryType] ?? order.deliveryType}</span></div>}
      </div>

      {/* ── Big call number ── */}
      <div className="text-center my-2">
        <div className="text-[9px] uppercase tracking-widest text-gray-600">Order No.</div>
        <div className="font-bold text-[34px] leading-none">{callNumber}</div>
      </div>

      {/* ── Line items ── */}
      <div className={`${dash} pt-1.5 space-y-1`}>
        {order.items.map((item: any, i: number) => {
          const lineTotal = item.subtotal ?? item.price * item.quantity;
          return (
            <div key={i}>
              <div className="flex justify-between">
                <span className="pr-2">{item.quantity}× {item.name}</span>
                <span className="whitespace-nowrap">{formatCurrency(lineTotal)}</span>
              </div>
              {/* The chosen extras are why the line costs what it costs. Without
                  them a customer querying the price has nothing to point at. */}
              {item.modifiers?.length > 0 && (
                <div className="pl-3 text-[9px] text-gray-700">
                  {item.modifiers.map((m: any) => m.name).join(' · ')}
                </div>
              )}
              {item.quantity > 1 && (
                <div className="text-[9px] text-gray-600 pl-3">@ {formatCurrency(item.price)} each</div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Totals ── */}
      <div className={`${dash} mt-1.5 pt-1.5 space-y-0.5`}>
        <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
        {discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(discount)}</span></div>}
        {tax > 0 && <div className="flex justify-between"><span>Tax (GCL)</span><span>{formatCurrency(tax)}</span></div>}
        <div className="flex justify-between font-bold text-[14px] pt-0.5">
          <span>TOTAL</span><span>{formatCurrency(order.total)}</span>
        </div>
      </div>

      {/* ── Payment (method · tendered · change retained) ── */}
      <div className={`${dash} mt-1.5 pt-1.5 space-y-0.5`}>
        {order.paymentMethod === 'SPLIT' && Array.isArray(order.splitPayments) ? (
          <>
            <div className="font-semibold">Split Payment</div>
            {order.splitPayments.map((leg: any, i: number) => (
              <div key={i} className="flex justify-between pl-2">
                <span>{PAYMENT_LABELS[leg.method] ?? leg.method}{leg.ref ? ` (${leg.ref})` : ''}</span>
                <span>{formatCurrency(leg.amount)}</span>
              </div>
            ))}
          </>
        ) : (
          <div className="flex justify-between">
            <span>Paid · {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        )}
        {order.tenderedAmount != null && Number(order.tenderedAmount) > 0 && (
          <div className="flex justify-between"><span>Tendered</span><span>{formatCurrency(order.tenderedAmount)}</span></div>
        )}
        {Number(order.changeAmount) > 0 && (
          <div className="flex justify-between font-bold"><span>Change</span><span>{formatCurrency(order.changeAmount)}</span></div>
        )}
        {order.paymentRef && <div className="flex justify-between"><span>Ref</span><span>{order.paymentRef}</span></div>}
      </div>

      {/* ── Footer ── */}
      <div className={`${dash} mt-2 pt-1.5 text-center`}>
        {receiptFooter.split('\n').map((line, i) => <div key={i}>{line}</div>)}
      </div>

      {/* ── Developer credit ──
          One line, last, below the client's own footer. See developer-credit.ts
          for why it stays this small. */}
      {DEVELOPER_CREDIT.enabled && (
        <div className={`${dash} mt-2 pt-1 text-center text-[8px] text-gray-500`}>
          {RECEIPT_CREDIT_LINES.map(line => <div key={line}>{line}</div>)}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
export default function POSPage() {
  const { data: authSession, status: authStatus } = useSession();
  const user = authSession?.user as any;
  const isItAdmin = (user?.email ?? '').toLowerCase() === 'it@jireh.com';

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [activeCat, setActiveCat] = useState('');
  /** Showing the 86'd dishes instead of a category, to put them back on. */
  const [showOffMenu, setShowOffMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [receiptSettings, setReceiptSettings] = useState({
    businessName: 'Jireh Natural Foods',
    businessPhone: '055 113 3481',
    businessAddress: 'Adenta Housing Down, Accra',
    receiptHeader: 'Fresh & Healthy — Always',
    receiptFooter: 'Thank you for your patronage!',
  });
  /* Quick-sale mode is the default: a tap puts the dish straight on the
     ticket. Owner flips this on in Settings when special requests become
     common enough to justify a sheet on every tap. */
  const [modifiersEnabled, setModifiersEnabled] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [deliveryType, setDeliveryType] = useState('TAKEAWAY');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  /** Suggestions for the customer field — names this shop has served before. */
  const [customerMatches, setCustomerMatches] = useState<ComboboxOption[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Payment flow
  const [view, setView] = useState<'register'|'payment'|'orders'|'session'>('register');
  const [tenderedStr, setTenderedStr] = useState('0');
  const [momoAmountStr, setMomoAmountStr] = useState('0');  // amount customer paid via MoMo
  const [paymentRef, setPaymentRef] = useState('');

  // Split payment
  const [isSplit, setIsSplit] = useState(false);
  // Active leg being edited in split mode: 'CASH' | 'MOMO' | 'BOLT_FOOD'
  const [splitActiveLeg, setSplitActiveLeg] = useState<'CASH'|'MOMO'|'BOLT_FOOD'>('CASH');
  const [splitCashStr, setSplitCashStr]     = useState('0');
  const [splitMomoStr, setSplitMomoStr]     = useState('0');
  const [splitBoltStr, setSplitBoltStr]     = useState('0');
  const [splitMomoRef, setSplitMomoRef]     = useState('');
  const [splitBoltRef, setSplitBoltRef]     = useState('');

  // Mobile tab: 'menu' | 'cart' (only used on small screens)
  const [mobileTab, setMobileTab] = useState<'menu'|'cart'>('menu');

  // Session
  const [posSession, setPosSession] = useState<PosSession | null>(null);
  /* fetchSession is called from callbacks captured on earlier renders, so it
     reads the live shift through a ref rather than a stale closure. */
  const posSessionRef = useRef<PosSession | null>(null);
  const [pendingSession, setPendingSession] = useState<PosSession | null>(null);
  const [registerGate, setRegisterGate] = useState<RegisterGate>('checking');
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>({ revenue: 0, cashRevenue: 0, momoRevenue: 0, boltRevenue: 0 });
  const checkoutClientRef = useRef<string | null>(null);
  const [openingFloatStr, setOpeningFloatStr] = useState('0');
  const [closingCashStr, setClosingCashStr] = useState('0');
  const [closingMomoStr, setClosingMomoStr] = useState('0');
  const [closingBoltStr, setClosingBoltStr] = useState('0');
  /** Levy rate from Settings; 0 unless an owner sets one. */
  const [taxRate, setTaxRate] = useState(0);
  /** Open tickets — sent to the kitchen, not yet paid. */
  const [openTickets, setOpenTickets] = useState<any[]>([]);
  const [settling, setSettling] = useState<any>(null);
  /** Dish awaiting modifier choices before it can join the ticket. */
  const [modifierTarget, setModifierTarget] = useState<MenuItem | null>(null);
  /** 86 board — the item a long-press opened the availability sheet for. */
  const [eightySixTarget, setEightySixTarget] = useState<MenuItem | null>(null);
  const [eightySixSaving, setEightySixSaving] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  /** Drawer count by denomination — the source of truth for closing cash. */
  const [cashCounts, setCashCounts] = useState<Record<string, number>>({});
  const [countMode, setCountMode] = useState<'notes' | 'total'>('notes');
  const [sessionLoading, setSessionLoading] = useState(false);
  const [closingSummary, setClosingSummary] = useState<any>(null);

  // Orders
  const [todayOrders, setTodayOrders] = useState<any[]>([]);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [placing, setPlacing] = useState(false);

  // Offline / sync state
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedSyncCount, setFailedSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const userId = user?.id as string | undefined;
  const cartKey = cartStorageKey(userId);


  // ── Online / offline detection ────────────────────────────────────────────
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update(); // set initial state
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  // ── Offline queue: check pending count on mount ────────────────────────────
  useEffect(() => {
    getPendingOrders().then(q => setPendingCount(q.length)).catch(() => {});
  }, []);

  const refreshQueueCounts = useCallback(async () => {
    const [pending, failedMod] = await Promise.all([
      getPendingOrders().catch(() => []),
      import('@/src/lib/offlineQueue').then(m => m.getFailedOrders().catch(() => [])),
    ]);
    setPendingCount(pending.length);
    setFailedSyncCount(failedMod.length);
  }, []);

  // ── Auto-sync when connection is restored ─────────────────────────────────
  useEffect(() => {
    if (!isOnline) return;
    let alive = true;
    (async () => {
      const pending = await getPendingOrders().catch(() => []);
      if (!alive || pending.length === 0) return;
      setSyncing(true);
      try {
        const result = await syncPendingOrders();
        if (!alive) return;
        await refreshQueueCounts();
        if (result.authFailed) {
          alert('Session expired — please sign in again to sync offline orders.');
        }
        if (result.synced > 0) { fetchOrders(); fetchSession(); }
      } finally { if (alive) setSyncing(false); }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Hydrate cart from localStorage once we know the signed-in user
  useEffect(() => {
    if (!userId) return;
    try {
      const saved = localStorage.getItem(cartKey);
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p.cart) && p.cart.length > 0) setCart(p.cart);
        if (p.deliveryType) setDeliveryType(p.deliveryType);
        if (p.customerName) setCustomerName(p.customerName);
        if (p.customerPhone) setCustomerPhone(p.customerPhone);
        if (p.orderNotes) setOrderNotes(p.orderNotes);
        if (typeof p.discountAmount === 'number') setDiscountAmount(p.discountAmount);
      } else {
        setCart([]);
      }
    } catch {}
  }, [userId, cartKey]);

  // Persist cart scoped to the current user
  useEffect(() => {
    if (!userId) return;
    try {
      if (cart.length > 0 || customerName || customerPhone || orderNotes || discountAmount) {
        localStorage.setItem(cartKey, JSON.stringify({ cart, deliveryType, customerName, customerPhone, orderNotes, discountAmount }));
      } else {
        localStorage.removeItem(cartKey);
      }
    } catch {}
  }, [cart, deliveryType, customerName, customerPhone, orderNotes, discountAmount, userId, cartKey]);

  const fetchMenu = async () => {
    const res = await fetch('/api/pos/menu');
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) {
      setCategories(data);
      if (data.length > 0) setActiveCat(data[0].id);
    }
  };

  /* Refresh shift + revenue figures from the server.
     This runs after every sale, every ticket settlement and every offline
     sync, so it must never take a live register away from the cashier. Only
     three things send someone back through the gate: they have not
     acknowledged a shift yet, the shift changed underneath them, or the till
     was closed on another device. A plain figures refresh is never one of
     them. */
  const fetchSession = async (opts?: { activate?: boolean }) => {
    const res = await fetch('/api/pos/sessions');
    if (res.ok) {
      const data = await res.json();
      setSessionStats({
        revenue: data.revenue,
        cashRevenue: data.cashRevenue,
        momoRevenue: data.momoRevenue ?? 0,
        boltRevenue: data.boltRevenue ?? 0,
      });
      // IT admin runs in demo mode and never holds a shift — refreshing the
      // figures must not pull the register out from under it either.
      if (isItAdmin) { setSessionChecked(true); return; }
      if (data.session) {
        setPendingSession(data.session);
        const stale = data.isStale ?? classifyRegisterSession(data.session.openedAt) === 'stale';
        // In-memory check covers this page load; the stored ack survives a
        // reload or PWA relaunch mid-shift.
        const acknowledged =
          posSessionRef.current?.id === data.session.id ||
          readShiftAck(userId) === data.session.id;
        if (opts?.activate || acknowledged) {
          writeShiftAck(data.session.id, userId);
          setPosSession(data.session);
          setRegisterGate('active');
        } else {
          setPosSession(null);
          setRegisterGate(stale ? 'stale' : 'continue');
        }
      } else {
        // Till closed — here or on another device. Dropping the register is
        // correct; clear the ack so the next shift is acknowledged afresh.
        clearShiftAck(userId);
        setPendingSession(null);
        setPosSession(null);
        setRegisterGate('open_new');
      }
    }
    setSessionChecked(true);
  };

  const activateRegister = () => {
    if (!pendingSession) return;
    writeShiftAck(pendingSession.id, userId);
    setPosSession(pendingSession);
    setRegisterGate('active');
    setView('register');
  };

  const fetchOrders = async () => {
    const url = posSession ? `/api/pos/orders?sessionId=${posSession.id}` : '/api/pos/orders';
    const res = await fetch(url);
    if (res.ok) setTodayOrders(await res.json());
  };

  // Load menu and receipt settings after auth resolves
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    fetchMenu();
    fetch('/api/pos/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setReceiptSettings({
          businessName: data.business_name || 'Jireh Natural Foods',
          businessPhone: data.business_phone || '055 113 3481',
          businessAddress: data.business_address || 'Adenta Housing Down, Accra',
          receiptHeader: data.receipt_header || 'Fresh & Healthy — Always',
          receiptFooter: data.receipt_footer || 'Thank you for your patronage!',
        });
        // Keep the register's arithmetic identical to the server's.
        setTaxRate(Number(data.tax_rate ?? 0) || 0);
        setModifiersEnabled(data.pos_modifiers_enabled === true);
      })
      .catch(() => {});
  }, [authStatus]);

  // Session check — reactive on auth resolution.
  // IT admin gets an instant fast-path (demo mode, no shift ever needed).
  // Everyone else fetches /api/pos/sessions from the DB.
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    if (isItAdmin) {
      setSessionChecked(true);
      setRegisterGate('active');
    } else {
      fetchSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, isItAdmin]);

  useEffect(() => { posSessionRef.current = posSession; }, [posSession]);

  /* Customer suggestions. Debounced so a fast typist does not fire a request
     per keystroke, and aborted on change so a slow earlier response can never
     overwrite the list for what is now in the box. A failure is silent — the
     cashier types the name either way. */
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pos/customers?q=${encodeURIComponent(customerName)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;
        setCustomerMatches(
          data.map((c: any) => ({ id: c.id, label: c.name, sub: c.phone })),
        );
      } catch { /* aborted or offline — suggestions are optional */ }
    }, 180);
    return () => { clearTimeout(t); controller.abort(); };
  }, [customerName, authStatus]);

  useEffect(() => {
    if (sessionChecked && authSession?.user && registerGate === 'active') { fetchOrders(); fetchOpenTickets(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionChecked, registerGate, posSession?.id]);

  // Cart helpers
  const addToCart = useCallback((item: MenuItem, modifiers: ChosenModifier[] = []) => {
    const lineId = cartLineId(item.id, modifiers.map(m => m.optionId));
    const price = item.price + modifiers.reduce((s, m) => s + m.priceDelta, 0);
    setCart(prev => {
      const ex = prev.find(c => c.lineId === lineId);
      if (ex) return prev.map(c => c.lineId === lineId ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, {
        lineId, menuItemId: item.id, name: item.name,
        basePrice: item.price, price, quantity: 1, modifiers,
      }];
    });
  }, []);
  const updateQty = (lineId: string, delta: number) => setCart(prev => prev.map(c => c.lineId === lineId ? { ...c, quantity: c.quantity + delta } : c).filter(c => c.quantity > 0));
  const removeFromCart = (lineId: string) => setCart(prev => prev.filter(c => c.lineId !== lineId));
  const setItemNote = (lineId: string, note: string) => setCart(prev => prev.map(c => c.lineId === lineId ? { ...c, notes: note } : c));
  const clearCart = () => {
    setCart([]); setCustomerName(''); setCustomerPhone(''); setOrderNotes('');
    setDiscountAmount(0); setTenderedStr('0'); setMomoAmountStr('0'); setPaymentRef('');
    setIsSplit(false); setSplitCashStr('0'); setSplitMomoStr('0'); setSplitBoltStr('0');
    setSplitMomoRef(''); setSplitBoltRef('');
    try { localStorage.removeItem(cartKey); } catch {}
    checkoutClientRef.current = null;
  };

  /* Same function the API uses, so the amount on the Charge button is always
     the amount charged — including any levy set in Settings. */
  const { subtotal, taxAmount, total } = computeOrderTotals({
    lines: cart.map(c => ({ price: c.price, quantity: c.quantity })),
    discountAmount,
    taxRate,
  });
  const tendered = parseFloat(tenderedStr) || 0;
  const momoAmount = parseFloat(momoAmountStr) || 0;
  const change = paymentMethod === 'CASH' ? changeDue(tendered, total) : 0;
  // Split totals
  const splitCash = parseFloat(splitCashStr) || 0;
  const splitMomo = parseFloat(splitMomoStr) || 0;
  const splitBolt = parseFloat(splitBoltStr) || 0;
  const splitSum  = splitCash + splitMomo + splitBolt;
  const splitOk   = isSplit && Math.abs(splitSum - total) < 0.01 && splitSum > 0;

  const goToPayment = () => {
    checkoutClientRef.current = null;
    setView('payment');
  };

  const canCharge = cart.length > 0 && (
    isSplit
      ? splitOk
      : (paymentMethod !== 'CASH' || tendered >= total)
        && (paymentMethod !== 'MOMO' || momoAmount > 0)
  );

  /* Send to kitchen: same order, no money taken yet. Becomes an open ticket on
     the rail until someone settles it. */
  const placeOrder = async (opts: { unpaid?: boolean } = {}) => {
    const unpaid = opts.unpaid === true;
    if (cart.length === 0 || placing) return;
    setPlacing(true);

    if (!checkoutClientRef.current) {
      checkoutClientRef.current = globalThis.crypto?.randomUUID?.()
        ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    const splitLegs = isSplit ? [
      splitCash > 0 ? { method: 'CASH',      amount: splitCash } : null,
      splitMomo > 0 ? { method: 'MOMO',      amount: splitMomo, ref: splitMomoRef || undefined } : null,
      splitBolt > 0 ? { method: 'BOLT_FOOD', amount: splitBolt, ref: splitBoltRef || undefined } : null,
    ].filter(Boolean) : null;

    const orderPayload = {
      clientRef: checkoutClientRef.current,
      items: cart.map(c => ({
        menuItemId: c.menuItemId,
        name: c.name,
        // Base price only: the server re-adds verified modifier deltas.
        price: c.basePrice,
        quantity: c.quantity,
        notes: c.notes,
        modifierOptionIds: c.modifiers.map(m => m.optionId),
      })),
      paymentMethod: unpaid ? 'UNPAID' : (isSplit ? 'SPLIT' : paymentMethod),
      deliveryType,
      paymentRef: unpaid || isSplit ? undefined : (paymentRef || undefined),
      tenderedAmount: unpaid || isSplit
        ? undefined
        : (paymentMethod === 'CASH' ? tendered : paymentMethod === 'MOMO' ? momoAmount : undefined),
      splitPayments: unpaid ? undefined : (splitLegs ?? undefined),
      discountAmount,
      sessionId: posSession?.id,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      notes: orderNotes || undefined,
    };

    try {
      const res = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Order failed: ${err.error || res.statusText || 'Unknown error'}`);
        return;
      }
      const order = await res.json();
      if (!order?.orderNumber) { alert('Order failed: invalid response from server'); return; }
      setLastOrder({ ...order, createdAt: new Date().toISOString() });
      clearCart();
      setView('register');
      fetchOrders();
      fetchSession();
      // Auto-trigger print dialog after a short delay
      if (!unpaid) setTimeout(() => { try { window.print(); } catch {} }, 600);
    } catch {
      // ── Offline fallback — save to IndexedDB queue, never lose the order ───
      try {
        await enqueueOrder(orderPayload, {
          createdByUserId: userId,
          sessionId: posSession?.id,
        });
        const remaining = await getPendingOrders();
        setPendingCount(remaining.length);
        // Show a receipt-like confirmation screen with offline flag
        setLastOrder({
          orderNumber: `OFF-${Date.now()}`,
          items: cart,
          total,
          paymentMethod,
          deliveryType,
          changeAmount: change,
          createdAt: new Date().toISOString(),
          _offline: true,           // UI flag: suppress print, show sync warning
        });
        clearCart();
        setView('register');
      } catch {
        alert('Order could not be saved. Please check your device storage and try again.');
      }
    } finally {
      setPlacing(false);
    }
  };

  // Session actions
  const openSession = async (forceCloseStale = false) => {
    setSessionLoading(true);
    try {
      const res = await fetch('/api/pos/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openingFloat: parseFloat(openingFloatStr),
          forceCloseStale,
        }),
      });
      if (res.ok) {
        await fetchSession({ activate: true });
        setView('register');
      } else {
        const e = await res.json();
        alert(e.error || 'Could not open shift');
      }
    } finally { setSessionLoading(false); }
  };

  const closeSession = async (skipConfirm = false) => {
    const active = posSession ?? pendingSession;
    if (!active) return;

    const countedCash = countMode === 'notes'
      ? denominationTotal(cashCounts)
      : (parseFloat(closingCashStr) || 0);

    if (!skipConfirm) {
      const expectedCash = Number(active.openingFloat) + sessionStats.cashRevenue;
      const cashDisc  = countedCash - expectedCash;
      const momoDisc  = (parseFloat(closingMomoStr) || 0) - sessionStats.momoRevenue;
      const boltDisc  = (parseFloat(closingBoltStr) || 0) - sessionStats.boltRevenue;
      const hasDisc   = Math.abs(cashDisc) > 0.01 || Math.abs(momoDisc) > 0.01 || Math.abs(boltDisc) > 0.01;
      if (hasDisc) {
        const lines = [];
        if (Math.abs(cashDisc) > 0.01)  lines.push(`Cash: ${cashDisc > 0 ? '+' : ''}GH₵${cashDisc.toFixed(2)}`);
        if (Math.abs(momoDisc) > 0.01)  lines.push(`MoMo: ${momoDisc > 0 ? '+' : ''}GH₵${momoDisc.toFixed(2)}`);
        if (Math.abs(boltDisc) > 0.01)  lines.push(`Bolt: ${boltDisc > 0 ? '+' : ''}GH₵${boltDisc.toFixed(2)}`);
        const confirmed = window.confirm(
          `⚠ Discrepancy detected:\n${lines.join('\n')}\n\nDouble-check your counts, or tap OK to close anyway.`
        );
        if (!confirmed) return;
      }
    }

    setSessionLoading(true);
    try {
      const res = await fetch('/api/pos/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: active.id,
          closingCash: countedCash,
          closingMomo: parseFloat(closingMomoStr) || 0,
          closingBolt: parseFloat(closingBoltStr) || 0,
          cashCount: countMode === 'notes' && Object.keys(cashCounts).length > 0 ? cashCounts : null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setClosingSummary(data.summary);
        clearShiftAck(userId);
        setPosSession(null);
        setPendingSession(null);
        setRegisterGate('open_new');
        setSessionStats({ revenue: 0, cashRevenue: 0, momoRevenue: 0, boltRevenue: 0 });
        setCashCounts({});
        setClosingCashStr('0');
        setClosingMomoStr('0');
        setClosingBoltStr('0');
      } else {
        const e = await res.json().catch(() => ({}));
        alert(e.error || 'Could not close shift');
      }
    } finally { setSessionLoading(false); }
  };

  /* An 86'd dish is off the register, not greyed on it. Leaving sold-out tiles
     in the grid during a rush means the cashier reads and rejects them on
     every sale. They collect behind the "Off menu" chip instead, which is
     also where they are put back on — so nothing is lost, it is just out of
     the way of selling. */
  const sellable = (items: MenuItem[]) => items.filter(i => i.isAvailable !== false);
  const offMenuItems = categories.flatMap(c => c.items).filter(i => i.isAvailable === false);
  /* Falls back on its own once the last dish is restored, so the chip can
     never leave the cashier staring at an empty grid. */
  const viewingOffMenu = showOffMenu && offMenuItems.length > 0;

  const filteredItems = search.trim()
    ? sellable(categories.flatMap(c => c.items)).filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : viewingOffMenu
      ? offMenuItems
      : sellable(categories.find(c => c.id === activeCat)?.items ?? []);

  /* ─── 86 board ────────────────────────────────────────────────────────
     Long-press a tile to take a dish off the menu the moment the kitchen runs
     out. Flips the register, the menu manager and the public website at once. */
  const LONG_PRESS_MS = 550;

  const startLongPress = (item: MenuItem) => {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(18);
      setEightySixTarget(item);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const fetchOpenTickets = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/orders?open=1');
      if (res.ok) setOpenTickets(await res.json());
    } catch {
      // Offline: the rail just shows what it last knew.
    }
  }, []);

  const settleTicket = async (ticket: any, method: string, ref?: string, tenderedAmount?: number) => {
    try {
      const res = await fetch('/api/pos/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: ticket.id, paymentMethod: method, paymentRef: ref, tenderedAmount }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || 'Could not settle this ticket.');
        return;
      }
      const paid = await res.json();
      setSettling(null);
      await fetchOpenTickets();
      fetchOrders();
      fetchSession();
      setLastOrder({ ...paid, createdAt: paid.createdAt ?? new Date().toISOString() });
    } catch {
      alert('Could not reach the server. Try again when you are back online.');
    }
  };

  const setAvailability = async (item: MenuItem, isAvailable: boolean) => {
    setEightySixSaving(true);
    // Optimistic — during a rush the tile must grey out instantly.
    setCategories(prev =>
      prev.map(c => ({ ...c, items: c.items.map(i => (i.id === item.id ? { ...i, isAvailable } : i)) })),
    );
    try {
      const res = await fetch('/api/pos/menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, isAvailable }),
      });
      if (!res.ok) throw new Error('failed');
      if (!isAvailable) {
        // An 86'd item must not stay in a half-built ticket.
        setCart(prev => prev.filter(c => c.menuItemId !== item.id));
      }
      setEightySixTarget(null);
    } catch {
      // Roll back so the register never lies about what it can sell.
      setCategories(prev =>
        prev.map(c => ({
          ...c,
          items: c.items.map(i => (i.id === item.id ? { ...i, isAvailable: !isAvailable } : i)),
        })),
      );
      alert('Could not update availability. Check your connection and try again.');
    } finally {
      setEightySixSaving(false);
    }
  };

  /* ─── Post-order success / print screen ─────────────────────────── */
  if (lastOrder) {
    const isOfflineOrder = !!lastOrder._offline;
    const isUnpaidTicket = lastOrder.paymentMethod === 'UNPAID' || lastOrder.paymentStatus === 'PENDING';
    return (
      <div className="h-screen bg-[#111311] flex items-center justify-center p-4">
        {/* screen-only success UI — hidden when printing so only the receipt shows */}
        <div className="text-center max-w-sm w-full print:hidden">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isOfflineOrder
              ? 'bg-yellow-400/20 border border-yellow-400/40'
              : 'bg-[#349f2d]/20 border border-[#349f2d]/40'
          }`}>
            {isOfflineOrder
              ? <AlertCircle size={28} className="text-yellow-400" />
              : <CheckCircle2 size={28} className="text-[#5ecf4f]" />}
          </div>

          {isOfflineOrder ? (
            <>
              <h2 className="text-xl font-bold text-[#f4efeb] font-serif mb-1">Saved Offline</h2>
              <p className="text-sm text-yellow-400 mb-2">No internet — order queued locally</p>
              <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-2xl px-4 py-3 mb-4 text-xs text-yellow-300 text-left space-y-1">
                <p>✓ Order is saved on this device</p>
                <p>✓ Will sync automatically when connected</p>
                <p>✓ No order will be lost</p>
              </div>
            </>
          ) : (
            <>
              {/* An unpaid ticket has been cooked, not paid for. Saying
                  "Order Complete" there invites a cashier to let the customer
                  walk without collecting. */}
              <h2 className="text-xl font-bold text-[#f4efeb] font-serif mb-1">
                {isUnpaidTicket ? 'Sent to Kitchen' : 'Order Complete!'}
              </h2>
              {isUnpaidTicket && (
                <p className="mb-2 text-sm text-yellow-400">
                  Not paid yet — settle it from the tickets rail before they leave.
                </p>
              )}
              {isItAdmin && (
                <span className="inline-block mb-2 px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-400 text-[10px] font-bold tracking-wide">
                  DEMO — not counted in sales
                </span>
              )}
            </>
          )}

          <p className="text-sm text-[#aba8a4] mb-2">{lastOrder.orderNumber}</p>
          <p className="text-3xl font-bold text-[#5ecf4f] mb-1">{formatCurrency(lastOrder.total)}</p>
          {lastOrder.changeAmount > 0 && (
            <p className="text-lg text-yellow-400 mb-4">Change: {formatCurrency(lastOrder.changeAmount)}</p>
          )}
          {/* The actual receipt, so the cashier can check it before tearing it
              off. Offline orders have no server-assigned number yet, so they
              keep the simple list. */}
          {isOfflineOrder ? (
            <div className="space-y-1 mb-6 text-sm text-[#aba8a4] bg-[#191c19] rounded-2xl p-4">
              {lastOrder.items?.map((item: any) => (
                <div key={item.menuItemId ?? item.id} className="flex justify-between">
                  <span>{item.quantity}× {item.name}</span>
                  <span className="text-[#f4efeb]">{formatCurrency(item.subtotal ?? item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t border-[#2b2f2b] pt-2 mt-2 flex justify-between font-semibold text-[#f4efeb]">
                <span>Total</span><span>{formatCurrency(lastOrder.total)}</span>
              </div>
            </div>
          ) : (
            <div className="mb-6 max-h-[46vh] overflow-y-auto rounded-lg">
              <Receipt80mm
                preview
                order={lastOrder}
                businessName={receiptSettings.businessName}
                businessPhone={receiptSettings.businessPhone}
                businessAddress={receiptSettings.businessAddress}
                receiptHeader={receiptSettings.receiptHeader}
                receiptFooter={receiptSettings.receiptFooter}
              />
            </div>
          )}
          <div className="flex gap-2">
            {!isOfflineOrder && (
              <button onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 bg-[#191c19] hover:bg-[#232623] border border-[#2b2f2b] text-[#f4efeb] rounded-2xl py-3 text-sm font-medium transition-colors">
                <Printer size={15} /> Print Receipt
              </button>
            )}
            <button onClick={() => setLastOrder(null)}
              className="flex-1 bg-[#349f2d] hover:bg-[#287e22] text-white rounded-2xl py-3 font-semibold text-sm transition-colors">
              New Sale
            </button>
          </div>
        </div>
        {/* Only render receipt for online orders (offline orders have no server-assigned orderNumber) */}
        {!isOfflineOrder && (
          <Receipt80mm
            order={lastOrder}
            businessName={receiptSettings.businessName}
            businessPhone={receiptSettings.businessPhone}
            businessAddress={receiptSettings.businessAddress}
            receiptHeader={receiptSettings.receiptHeader}
            receiptFooter={receiptSettings.receiptFooter}
          />
        )}
      </div>
    );
  }

  /* ─── Session closing summary ────────────────────────────────────── */
  if (closingSummary) {
    const { cash, momo, bolt } = closingSummary;
    const discColor = (d: number) => Math.abs(d) < 0.01 ? 'text-[#5ecf4f]' : d > 0 ? 'text-blue-400' : 'text-red-400';
    const discLabel = (d: number) => Math.abs(d) < 0.01 ? '✓ Exact' : `${d > 0 ? '+' : ''}GH₵${Math.abs(d).toFixed(2)} ${d > 0 ? 'over' : 'short'}`;
    return (
      <div className="h-screen bg-[#111311] flex items-center justify-center p-4 overflow-y-auto">
        <div className="max-w-sm w-full bg-[#191c19] border border-[#2b2f2b] rounded-3xl p-6 my-4">
          <h2 className="text-xl font-bold text-[#f4efeb] mb-1 text-center">Shift Closed</h2>
          <p className="text-center text-sm text-[#aba8a4] mb-4">{closingSummary.orderCount} orders · {formatCurrency(closingSummary.totalRevenue)} total</p>

          {/* Per-method reconciliation */}
          <div className="space-y-2 mb-4">
            {/* Cash */}
            {cash && (
              <div className="bg-[#111311] rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#f4efeb]">💵 Cash</span>
                  <span className={`text-xs font-bold ${discColor(cash.discrepancy)}`}>{discLabel(cash.discrepancy)}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-[#aba8a4]">
                  <span>Expected</span><span className="text-right text-[#f4efeb]">{formatCurrency(cash.expected)}</span>
                  <span>Counted</span><span className="text-right text-[#f4efeb]">{formatCurrency(cash.actual)}</span>
                </div>
              </div>
            )}
            {/* MoMo */}
            {momo && momo.expected > 0 && (
              <div className="bg-[#111311] rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#f4efeb]">📱 MoMo</span>
                  <span className={`text-xs font-bold ${discColor(momo.discrepancy)}`}>{discLabel(momo.discrepancy)}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-[#aba8a4]">
                  <span>Expected</span><span className="text-right text-[#f4efeb]">{formatCurrency(momo.expected)}</span>
                  <span>Received</span><span className="text-right text-[#f4efeb]">{formatCurrency(momo.actual)}</span>
                </div>
              </div>
            )}
            {/* Bolt */}
            {bolt && bolt.expected > 0 && (
              <div className="bg-[#111311] rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#f4efeb]">⚡ Bolt Food</span>
                  <span className={`text-xs font-bold ${discColor(bolt.discrepancy)}`}>{discLabel(bolt.discrepancy)}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-[#aba8a4]">
                  <span>Expected</span><span className="text-right text-[#f4efeb]">{formatCurrency(bolt.expected)}</span>
                  <span>Received</span><span className="text-right text-[#f4efeb]">{formatCurrency(bolt.actual)}</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-6">
            <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-1 bg-[#191c19] border border-[#2b2f2b] text-[#f4efeb] rounded-xl py-2.5 text-sm hover:bg-[#232623] transition-colors">
              <Printer size={13}/> Print
            </button>
            <button onClick={() => setClosingSummary(null)} className="flex-1 bg-[#349f2d] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#287e22] transition-colors">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Auth gate ──────────────────────────────────────────────────── */
  if (authStatus !== 'authenticated') {
    return (
      <div className="h-screen bg-[#111311] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-[#349f2d] border-t-transparent animate-spin mx-auto mb-3"/>
          <p className="text-sm text-[#aba8a4]">Loading POS…</p>
        </div>
      </div>
    );
  }

  const isAdminRole = ['OWNER', 'MANAGER', 'ACCOUNTANT'].includes(user?.role ?? '');
  /* Mirrors ANY_POS_USER_MAY_CLOSE_ANY_SHIFT in app/api/pos/sessions/route.ts —
     the whole team shares one register, so anyone at the POS can resolve a
     shift left open from a previous day. Keep both flags in step. */
  const canManageStale = true;

  const registerGateShell = (children: ReactNode) => (
    <div className="h-screen bg-[#111311] flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between px-4 py-3 bg-[#0a0b0a] border-b border-[#2b2f2b]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden border border-[#349f2d]/40 bg-white flex-shrink-0">
            <Image src="/jireh/logo.jpg" alt="Jireh Natural Foods" width={28} height={28} className="object-contain w-full h-full" />
          </div>
          <span className="text-sm font-semibold text-[#f4efeb]">Jireh POS</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isAdminRole && (
            <Link href="/admin" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#aba8a4] border border-[#2b2f2b] hover:border-[#404540] hover:text-[#f4efeb] transition">
              <LayoutDashboard size={12}/> Admin Panel
            </Link>
          )}
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-[#aba8a4] border border-[#2b2f2b] hover:text-red-400 hover:border-red-500/40 transition">
            <LogOut size={12}/>
          </button>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center p-6">{children}</div>
    </div>
  );

  if (!isItAdmin && registerGate !== 'active' && view !== 'session') {
    if (registerGate === 'checking' || !sessionChecked) {
      return registerGateShell(
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-[#349f2d] border-t-transparent animate-spin mx-auto mb-3"/>
          <p className="text-sm text-[#aba8a4]">Checking register…</p>
        </div>
      );
    }

    if (registerGate === 'continue' && pendingSession) {
      return registerGateShell(
        <div className="w-full max-w-sm bg-[#191c19] border border-[#2b2f2b] rounded-3xl p-6 space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#349f2d]/10 border border-[#349f2d]/30 flex items-center justify-center mx-auto mb-3">
              <Unlock size={24} className="text-[#5ecf4f]"/>
            </div>
            <h2 className="text-lg font-bold text-[#f4efeb] font-serif">Register Already Open</h2>
            <p className="text-xs text-[#aba8a4] mt-2">
              Opened by <strong className="text-[#f4efeb]">{pendingSession.openedByUser?.name}</strong>
              {' '}since {new Date(pendingSession.openedAt).toLocaleString('en-GH')}
            </p>
            <p className="text-xs text-[#aba8a4] mt-1">{sessionStats.revenue > 0 ? `${formatCurrency(sessionStats.revenue)} in sales so far` : 'No sales recorded yet'}</p>
          </div>
          <button onClick={activateRegister}
            className="w-full bg-[#349f2d] hover:bg-[#287e22] text-white rounded-2xl py-3.5 font-bold text-sm transition active:scale-[0.98]">
            Continue Selling
          </button>
          <button onClick={() => setView('session')}
            className="w-full bg-[#191c19] border border-[#2b2f2b] text-[#aba8a4] rounded-2xl py-3 text-sm hover:text-[#f4efeb] transition-colors">
            View Shift Details
          </button>
        </div>
      );
    }

    if (registerGate === 'stale' && pendingSession) {
      return registerGateShell(
        <div className="w-full max-w-sm bg-[#191c19] border border-yellow-500/30 rounded-3xl p-6 space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={24} className="text-yellow-400"/>
            </div>
            <h2 className="text-lg font-bold text-[#f4efeb] font-serif">Stale Shift Needs Review</h2>
            <p className="text-xs text-yellow-300 mt-2">
              Shift opened {new Date(pendingSession.openedAt).toLocaleString('en-GH')} by {pendingSession.openedByUser?.name} was never closed.
            </p>
          </div>
          <button onClick={activateRegister}
            className="w-full bg-[#349f2d] hover:bg-[#287e22] text-white rounded-2xl py-3.5 font-bold text-sm transition">
            Continue on Existing Shift
          </button>
          {canManageStale ? (
            <>
              <button onClick={() => setView('session')}
                className="w-full bg-[#191c19] border border-[#2b2f2b] text-[#f4efeb] rounded-2xl py-3 text-sm">
                Close Stale Shift
              </button>
              <button onClick={() => openSession(true)} disabled={sessionLoading}
                className="w-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 rounded-2xl py-3 text-sm disabled:opacity-40">
                {sessionLoading ? 'Opening…' : 'Close Stale & Open New Shift'}
              </button>
            </>
          ) : (
            <p className="text-xs text-center text-[#aba8a4]">Ask a manager to close this shift before opening a new one.</p>
          )}
        </div>
      );
    }

    return registerGateShell(
      <div className="w-full max-w-sm bg-[#191c19] border border-[#2b2f2b] rounded-3xl p-6 space-y-5">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#349f2d]/10 border border-[#349f2d]/30 flex items-center justify-center mx-auto mb-3">
            <Lock size={24} className="text-[#5ecf4f]"/>
          </div>
          <h2 className="text-lg font-bold text-[#f4efeb] font-serif">Open Today&apos;s Shift</h2>
          <p className="text-xs text-[#aba8a4] mt-1">Enter the cash float in the drawer to begin. Required for accounting.</p>
        </div>
        <div>
          <p className="text-xs text-[#aba8a4] mb-2">Opening Cash Float (GH₵)</p>
          <p className="text-2xl font-bold text-[#5ecf4f] font-mono text-center mb-3">{formatCurrency(parseFloat(openingFloatStr) || 0)}</p>
          <Numpad value={openingFloatStr} onChange={setOpeningFloatStr}/>
        </div>
        <button onClick={() => openSession()} disabled={sessionLoading}
          className="w-full bg-[#349f2d] hover:bg-[#287e22] disabled:opacity-40 text-white rounded-2xl py-3.5 font-bold text-sm transition active:scale-[0.98] shadow-[0_0_20px_rgba(52,159,45,0.3)]">
          {sessionLoading ? 'Opening…' : 'Open Shift & Start Selling'}
        </button>
      </div>
    );
  }

  /* ─── Payment screen ─────────────────────────────────────────────── */
  if (view === 'payment') {
    return (
      <div className="h-screen bg-[#111311] flex flex-col overflow-hidden">
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-[#0a0b0a] border-b border-[#2b2f2b]">
          <button onClick={() => setView('register')} className="p-2 rounded-xl text-[#aba8a4] hover:text-[#f4efeb] border border-[#2b2f2b] hover:border-[#404540] transition">
            <X size={16}/>
          </button>
          <span className="text-sm font-semibold text-[#f4efeb]">Payment — {formatCurrency(total)}</span>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-md mx-auto w-full">
          {/* Order summary */}
          <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4 space-y-1">
            {cart.map(item => (
              <div key={item.menuItemId} className="flex justify-between text-sm">
                <span className="text-[#aba8a4]">{item.quantity}× {item.name}</span>
                <span className="text-[#f4efeb]">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm border-t border-[#2b2f2b] pt-1">
                <span className="text-[#aba8a4]">Discount</span>
                <span className="text-green-400">-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-[#2b2f2b] pt-2 mt-1">
              <span className="font-bold text-[#f4efeb]">Total</span>
              <span className="text-2xl font-black text-[#5ecf4f] tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Discount input */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#aba8a4] w-20 shrink-0">Discount (GH₵)</label>
            <input type="number" min="0" max={subtotal} value={discountAmount || ''} onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
              className="flex-1 bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2 text-sm text-[#f4efeb] focus:outline-none focus:border-[#349f2d]" placeholder="0" />
          </div>

          {/* Payment method row + Split toggle */}
          <div className="flex gap-1.5">
            <div className={`grid gap-1.5 flex-1 ${isSplit ? 'grid-cols-3' : 'grid-cols-3'}`}>
              {PAYMENT_METHODS.map(pm => {
                const Icon = pm.icon;
                const active = !isSplit && paymentMethod === pm.id;
                return (
                  <button key={pm.id} onClick={() => { setIsSplit(false); setPaymentMethod(pm.id); }}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-medium transition border ${active ? 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40' : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540]'}`}>
                    <Icon size={18}/>{pm.label}
                  </button>
                );
              })}
            </div>
            {/* Split toggle */}
            <button onClick={() => setIsSplit(s => !s)}
              className={`flex flex-col items-center justify-center gap-1 px-3 rounded-xl text-[10px] font-bold transition border shrink-0 ${isSplit ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540]'}`}>
              <span className="text-base leading-none">⊕</span>Split
            </button>
          </div>

          {/* ── Single-method panels ─────────────────────────────────── */}
          {!isSplit && paymentMethod === 'CASH' && (
            <div className="space-y-3">
              <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4">
                <p className="text-xs text-[#aba8a4] mb-1">Amount Tendered</p>
                <p className="text-3xl font-bold text-[#f4efeb] tabular-nums">{formatCurrency(tendered)}</p>
                {tendered >= total && <p className="text-lg font-semibold text-[#5ecf4f] mt-1">Change: {formatCurrency(change)}</p>}
              </div>
              <Numpad value={tenderedStr} onChange={setTenderedStr}/>
              <div className="grid grid-cols-3 gap-1.5">
                {[total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50].map(amt => (
                  <button key={amt} onClick={() => setTenderedStr(amt.toFixed(2))}
                    className="py-2 rounded-xl bg-[#349f2d]/10 border border-[#349f2d]/30 text-[#5ecf4f] text-xs font-medium hover:bg-[#349f2d]/20 transition-colors">
                    Exact {formatCurrency(amt)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isSplit && paymentMethod === 'MOMO' && (
            <div className="space-y-3">
              <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4">
                <p className="text-xs text-[#aba8a4] mb-1">Amount Sent via MoMo</p>
                <p className="text-3xl font-black text-[#f4efeb] tabular-nums">{formatCurrency(momoAmount)}</p>
                <p className="text-xs text-[#aba8a4] mt-1">Order total: <strong className="text-[#5ecf4f]">{formatCurrency(total)}</strong></p>
              </div>
              <Numpad value={momoAmountStr} onChange={setMomoAmountStr}/>
              <div className="grid grid-cols-2 gap-1.5">
                {[total, Math.ceil(total / 5) * 5].map(amt => (
                  <button key={amt} onClick={() => setMomoAmountStr(amt.toFixed(2))}
                    className="py-2 rounded-xl bg-[#349f2d]/10 border border-[#349f2d]/30 text-[#5ecf4f] text-xs font-medium hover:bg-[#349f2d]/20 transition-colors">
                    Exact {formatCurrency(amt)}
                  </button>
                ))}
              </div>
              <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="MoMo reference (optional)"
                className="w-full bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] placeholder:text-[#aba8a4]/50 focus:outline-none focus:border-[#349f2d] transition-colors"/>
            </div>
          )}

          {!isSplit && paymentMethod === 'BOLT_FOOD' && (
            <div className="bg-[#191c19] border border-[#60a5fa]/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2"><Zap size={14} className="text-[#60a5fa]"/><p className="text-sm font-medium text-[#f4efeb]">Bolt Food Reference</p></div>
              <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Enter Bolt order number / reference"
                className="w-full bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] placeholder:text-[#aba8a4]/50 focus:outline-none focus:border-[#60a5fa] transition-colors"/>
              <p className="text-xs text-[#aba8a4]">Payment collected by Bolt · Amount: <strong className="text-[#60a5fa]">{formatCurrency(total)}</strong></p>
            </div>
          )}

          {/* ── Split payment panel ──────────────────────────────────── */}
          {isSplit && (() => {
            const remaining = total - splitSum;
            const legs = [
              { id: 'CASH'      as const, label: 'Cash',      icon: '💵', val: splitCashStr, set: setSplitCashStr, amt: splitCash },
              { id: 'MOMO'      as const, label: 'MoMo',      icon: '📱', val: splitMomoStr, set: setSplitMomoStr, amt: splitMomo },
              { id: 'BOLT_FOOD' as const, label: 'Bolt',      icon: '⚡', val: splitBoltStr, set: setSplitBoltStr, amt: splitBolt },
            ];
            const activeLeg = legs.find(l => l.id === splitActiveLeg)!;
            return (
              <div className="space-y-3">
                {/* Progress bar */}
                <div className="bg-[#191c19] border border-purple-500/30 rounded-2xl p-4">
                  <div className="flex justify-between text-xs text-[#aba8a4] mb-2">
                    <span>Split total</span>
                    <span className={Math.abs(remaining) < 0.01 ? 'text-[#5ecf4f] font-bold' : remaining > 0 ? 'text-yellow-400' : 'text-red-400'}>
                      {formatCurrency(splitSum)} / {formatCurrency(total)}
                      {Math.abs(remaining) > 0.01 && ` · ${remaining > 0 ? formatCurrency(remaining) + ' left' : 'over by ' + formatCurrency(-remaining)}`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#2b2f2b] rounded-full overflow-hidden">
                    <div className="h-full bg-[#5ecf4f] transition-[width] duration-300 rounded-full" style={{ width: `${Math.min(100, (splitSum / total) * 100)}%` }}/>
                  </div>
                </div>

                {/* Leg tabs */}
                <div className="grid grid-cols-3 gap-1.5">
                  {legs.map(leg => (
                    <button key={leg.id} onClick={() => setSplitActiveLeg(leg.id)}
                      className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl border text-xs font-medium transition ${splitActiveLeg === leg.id ? 'bg-purple-500/20 border-purple-400/40 text-purple-200' : leg.amt > 0 ? 'bg-[#191c19] border-[#349f2d]/30 text-[#5ecf4f]' : 'border-[#2b2f2b] text-[#aba8a4]'}`}>
                      <span className="text-base leading-none">{leg.icon}</span>
                      <span>{leg.label}</span>
                      {leg.amt > 0 && <span className="font-bold">{formatCurrency(leg.amt)}</span>}
                    </button>
                  ))}
                </div>

                {/* Active leg numpad */}
                <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-3">
                  <p className="text-xs text-[#aba8a4] mb-1">{activeLeg.icon} {activeLeg.label} amount</p>
                  <p className="text-2xl font-black text-[#f4efeb] tabular-nums mb-2">{formatCurrency(activeLeg.amt)}</p>
                  {/* Quick-fill remaining button */}
                  {remaining > 0.01 && (
                    <button onClick={() => activeLeg.set(remaining.toFixed(2))}
                      className="text-xs text-[#5ecf4f] bg-[#349f2d]/10 border border-[#349f2d]/30 rounded-lg px-2 py-1 mb-2 hover:bg-[#349f2d]/20 transition-colors">
                      Fill remaining {formatCurrency(remaining)}
                    </button>
                  )}
                </div>
                <Numpad value={activeLeg.val} onChange={activeLeg.set}/>

                {/* MoMo / Bolt reference fields */}
                {splitActiveLeg === 'MOMO' && (
                  <input value={splitMomoRef} onChange={e => setSplitMomoRef(e.target.value)} placeholder="MoMo reference (optional)"
                    className="w-full bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] placeholder:text-[#aba8a4]/50 focus:outline-none focus:border-[#349f2d] transition-colors"/>
                )}
                {splitActiveLeg === 'BOLT_FOOD' && (
                  <input value={splitBoltRef} onChange={e => setSplitBoltRef(e.target.value)} placeholder="Bolt reference (optional)"
                    className="w-full bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] placeholder:text-[#aba8a4]/50 focus:outline-none focus:border-[#60a5fa] transition-colors"/>
                )}
              </div>
            );
          })()}

          {/* Customer — same bound state as the cart panel, so a name attached
              before charging is still here, and can still be added now. */}
          <CustomerFields
            name={customerName} onName={setCustomerName}
            phone={customerPhone} onPhone={setCustomerPhone}
            matches={customerMatches}
          />
        </div>

        <div className="shrink-0 p-4 border-t border-[#2b2f2b] bg-[#0a0b0a]">
          <button onClick={() => placeOrder()} disabled={!canCharge || placing}
            className="w-full bg-[#349f2d] hover:bg-[#287e22] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl py-4 font-bold text-base transition active:scale-[0.98] shadow-[0_0_20px_rgba(52,159,45,0.3)]">
            {placing ? 'Processing…' : `Confirm Payment — ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    );
  }

  /* ─── Session management view ──────────────────────────────────────── */
  if (view === 'session') {
    const shiftSession = posSession ?? pendingSession;
    return (
      <div className="h-screen bg-[#111311] flex flex-col overflow-hidden">
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-[#0a0b0a] border-b border-[#2b2f2b]">
          <button onClick={() => setView('register')} className="p-2 rounded-xl text-[#aba8a4] hover:text-[#f4efeb] border border-[#2b2f2b] transition">
            <X size={16}/>
          </button>
          <span className="text-sm font-semibold text-[#f4efeb]">Shift / Session</span>
        </header>
        <div className="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full space-y-4">
          {shiftSession ? (
            /* Close session */
            <div className="space-y-4">
              <div className="bg-[#191c19] border border-[#349f2d]/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-[#5ecf4f] mb-1"><Unlock size={16}/><span className="font-semibold text-sm">Session Open</span></div>
                <div className="text-xs text-[#aba8a4]">Opened by <strong className="text-[#f4efeb]">{shiftSession.openedByUser?.name}</strong></div>
                <div className="text-xs text-[#aba8a4]">Since {new Date(shiftSession.openedAt).toLocaleString('en-GH')}</div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="bg-[#111311] rounded-xl p-3 text-center">
                    <p className="text-xs text-[#aba8a4]">Session Revenue</p>
                    <p className="text-lg font-bold text-[#5ecf4f]">{formatCurrency(sessionStats.revenue)}</p>
                  </div>
                  <div className="bg-[#111311] rounded-xl p-3 text-center">
                    <p className="text-xs text-[#aba8a4]">Cash Revenue</p>
                    <p className="text-lg font-bold text-[#f4efeb]">{formatCurrency(sessionStats.cashRevenue)}</p>
                  </div>
                </div>
              </div>
              {/* Shift reconciliation — one section per payment method */}
              {(() => {
                const expectedCash = Number(shiftSession.openingFloat) + sessionStats.cashRevenue;
                const countedCash = countMode === 'notes'
                  ? denominationTotal(cashCounts)
                  : (parseFloat(closingCashStr) || 0);
                const cashDisc = countedCash - expectedCash;
                const momoDisc = (parseFloat(closingMomoStr) || 0) - sessionStats.momoRevenue;
                const boltDisc = (parseFloat(closingBoltStr) || 0) - sessionStats.boltRevenue;
                const discColor = (d: number) => Math.abs(d) < 0.01 ? 'text-[#5ecf4f]' : d > 0 ? 'text-blue-400' : 'text-red-400';
                const discLabel = (d: number) => Math.abs(d) < 0.01 ? 'Exact ✓' : `${d > 0 ? '+' : ''}GH₵${Math.abs(d).toFixed(2)} ${d > 0 ? 'over' : 'short'}`;
                return (
                  <div className="space-y-3">
                    {/* Summary row */}
                    <div className="bg-[#111311] rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
                      <div><p className="text-[10px] text-[#aba8a4] uppercase tracking-wide">Cash sales</p><p className="text-sm font-bold text-[#f4efeb]">{formatCurrency(sessionStats.cashRevenue)}</p></div>
                      <div><p className="text-[10px] text-[#aba8a4] uppercase tracking-wide">MoMo sales</p><p className="text-sm font-bold text-[#f4efeb]">{formatCurrency(sessionStats.momoRevenue)}</p></div>
                      <div><p className="text-[10px] text-[#aba8a4] uppercase tracking-wide">Bolt sales</p><p className="text-sm font-bold text-[#f4efeb]">{formatCurrency(sessionStats.boltRevenue)}</p></div>
                    </div>

                    {/* Cash — count the drawer by denomination, or type a total */}
                    <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#f4efeb]">💵 Count the drawer</p>
                        <div className="flex rounded-lg border border-[#2b2f2b] p-0.5">
                          {(['notes', 'total'] as const).map(m => (
                            <button
                              key={m}
                              onClick={() => setCountMode(m)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                countMode === m ? 'bg-[#349f2d] text-white' : 'text-[#aba8a4]'
                              }`}
                            >
                              {m === 'notes' ? 'Count notes' : 'Type total'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#111311] p-3 text-center">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-[#aba8a4]">Expected in drawer</p>
                          <p className="font-mono text-sm font-bold tabular-nums text-[#f4efeb]">{formatCurrency(expectedCash)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-[#aba8a4]">Counted</p>
                          <p className="font-mono text-sm font-bold tabular-nums text-[#f4efeb]">{formatCurrency(countedCash)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-[#aba8a4]">Difference</p>
                          <p className={`font-mono text-sm font-bold tabular-nums ${discColor(cashDisc)}`}>
                            {Math.abs(cashDisc) < 0.01 ? 'Exact' : `${cashDisc > 0 ? '+' : '−'}${formatCurrency(Math.abs(cashDisc))}`}
                          </p>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#aba8a4]">
                        Float {formatCurrency(shiftSession.openingFloat)} + {formatCurrency(sessionStats.cashRevenue)} cash sales
                      </p>

                      {countMode === 'notes' ? (
                        <DenominationCounter counts={cashCounts} onChange={setCashCounts} />
                      ) : (
                        <>
                          <p className="text-2xl font-black tabular-nums text-[#f4efeb]">{formatCurrency(parseFloat(closingCashStr) || 0)}</p>
                          <Numpad value={closingCashStr} onChange={setClosingCashStr}/>
                        </>
                      )}
                    </div>

                    {/* MoMo */}
                    {sessionStats.momoRevenue > 0 && (
                      <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-[#f4efeb]">📱 MoMo Received</p>
                          <span className={`text-xs font-bold ${discColor(momoDisc)}`}>{discLabel(momoDisc)}</span>
                        </div>
                        <p className="text-xs text-[#aba8a4]">Expected: {formatCurrency(sessionStats.momoRevenue)}</p>
                        <p className="text-2xl font-black text-[#f4efeb] tabular-nums">{formatCurrency(parseFloat(closingMomoStr) || 0)}</p>
                        <Numpad value={closingMomoStr} onChange={setClosingMomoStr}/>
                      </div>
                    )}

                    {/* Bolt */}
                    {sessionStats.boltRevenue > 0 && (
                      <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-[#f4efeb]">⚡ Bolt Received</p>
                          <span className={`text-xs font-bold ${discColor(boltDisc)}`}>{discLabel(boltDisc)}</span>
                        </div>
                        <p className="text-xs text-[#aba8a4]">Expected: {formatCurrency(sessionStats.boltRevenue)}</p>
                        <p className="text-2xl font-black text-[#f4efeb] tabular-nums">{formatCurrency(parseFloat(closingBoltStr) || 0)}</p>
                        <Numpad value={closingBoltStr} onChange={setClosingBoltStr}/>
                      </div>
                    )}

                    <button onClick={() => closeSession()} disabled={sessionLoading}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl py-3 font-semibold text-sm transition-colors">
                      {sessionLoading ? 'Closing…' : 'Close Shift'}
                    </button>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* No active session — all authenticated users can open a new shift */
            <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-[#aba8a4]"><Lock size={16}/><span className="font-semibold text-sm text-[#f4efeb]">No Active Session</span></div>
              <p className="text-xs text-[#aba8a4]">Open a new shift to start taking orders.</p>
              <div>
                <p className="text-xs text-[#aba8a4] mb-2">Opening Cash Float</p>
                <p className="text-2xl font-bold text-[#5ecf4f] font-mono mb-3">{formatCurrency(parseFloat(openingFloatStr) || 0)}</p>
                <Numpad value={openingFloatStr} onChange={setOpeningFloatStr}/>
              </div>
              <button onClick={() => openSession()} disabled={sessionLoading}
                className="w-full bg-[#349f2d] hover:bg-[#287e22] disabled:opacity-40 text-white rounded-xl py-3 font-semibold text-sm transition-colors">
                {sessionLoading ? 'Opening…' : 'Open Shift'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─── Orders history view ────────────────────────────────────────── */
  if (view === 'orders') {
    return (
      <div className="h-screen bg-[#111311] flex flex-col overflow-hidden">
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-[#0a0b0a] border-b border-[#2b2f2b]">
          <button onClick={() => setView('register')} className="p-2 rounded-xl text-[#aba8a4] hover:text-[#f4efeb] border border-[#2b2f2b] transition">
            <X size={16}/>
          </button>
          <span className="text-sm font-semibold text-[#f4efeb]">Today&apos;s Orders ({todayOrders.length})</span>
        </header>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {todayOrders.length === 0 ? (
            <div className="text-center py-16 text-[#aba8a4] text-sm">No orders yet</div>
          ) : todayOrders.map(order => (
            <div key={order.id} className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#f4efeb]">
                  {order.orderNumber}
                  <span className="ml-2 font-normal text-xs text-[#aba8a4]">{customerLabel(order)}</span>
                </p>
                <p className="text-xs text-[#aba8a4] mt-0.5 truncate">{order.items?.map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}</p>
                <p className="text-xs text-[#aba8a4]">{formatTime(order.createdAt)} · {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="text-right">
                  <p className="text-sm font-bold text-[#5ecf4f]">{formatCurrency(order.total)}</p>
                  {order.changeAmount > 0 && <p className="text-xs text-yellow-400">Chg: {formatCurrency(order.changeAmount)}</p>}
                </div>
                {/* Customers ask for a copy often enough that hunting for it
                    should not be part of the job. Reopens the same receipt. */}
                <button
                  onClick={() => { setLastOrder(order); setView('register'); }}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#2b2f2b] px-3 text-xs font-medium text-[#aba8a4] transition-colors hover:border-[#404540] hover:text-[#f4efeb]"
                >
                  <Printer size={12} /> Receipt
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ─── Main Register View ─────────────────────────────────────────── */
  return (
    <div className="h-screen flex flex-col bg-[#111311] overflow-hidden">

      {/* ── Offline / sync banner — shown when device has no internet or pending orders ── */}
      {(!isOnline || pendingCount > 0 || failedSyncCount > 0) && (
        <div className={`shrink-0 flex items-center justify-between px-3 py-1.5 text-xs font-medium ${
          !isOnline
            ? 'bg-yellow-400/15 border-b border-yellow-400/30 text-yellow-300'
            : failedSyncCount > 0
              ? 'bg-red-400/10 border-b border-red-400/30 text-red-300'
              : 'bg-blue-400/10 border-b border-blue-400/20 text-blue-300'
        }`}>
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <><AlertCircle size={12}/> No internet — orders will be saved locally until reconnected</>
            ) : failedSyncCount > 0 ? (
              <><AlertCircle size={12}/> {failedSyncCount} order{failedSyncCount !== 1 ? 's' : ''} failed to sync — ask a manager</>
            ) : (
              <><Clock size={12}/> {pendingCount} offline order{pendingCount !== 1 ? 's' : ''} waiting to sync</>
            )}
          </div>
          {isOnline && pendingCount > 0 && (
            <button
              onClick={async () => {
                setSyncing(true);
                try {
                  const result = await syncPendingOrders();
                  await refreshQueueCounts();
                  if (result.authFailed) alert('Session expired — please sign in again to sync offline orders.');
                  fetchOrders(); fetchSession();
                } finally { setSyncing(false); }
              }}
              disabled={syncing}
              className="underline underline-offset-2 hover:opacity-80 disabled:opacity-50 transition-opacity">
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          )}
        </div>
      )}

      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-3 py-2.5 bg-[#0a0b0a] border-b border-[#2b2f2b]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden border border-[#349f2d]/40 bg-white flex-shrink-0">
            <Image src="/jireh/logo.jpg" alt="Jireh Natural Foods" width={28} height={28} className="object-contain w-full h-full" />
          </div>
          <span className="text-sm font-semibold text-[#f4efeb]">Jireh POS</span>
          <span className="text-xs text-[#aba8a4] hidden sm:block">· {user?.name}</span>
          {isItAdmin && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-400 text-[10px] font-bold tracking-wide">
              DEMO MODE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <HeaderClock />
          {/* Session pill — hidden on mobile (shift is in bottom nav) */}
          <button onClick={() => setView('session')}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition ${posSession ? 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40' : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540]'}`}>
            {posSession ? <><Unlock size={12}/> Shift Open</> : <><Lock size={12}/> No Shift</>}
          </button>
          {/* Orders — hidden on mobile (orders is in bottom nav) */}
          <button onClick={() => { setView('orders'); fetchOrders(); }}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#aba8a4] border border-[#2b2f2b] hover:border-[#404540] transition">
            <Clock size={12}/> Orders
          </button>
          {user && ['OWNER', 'MANAGER'].includes(user.role) && (
            <Link href="/admin" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#aba8a4] border border-[#2b2f2b] hover:border-[#404540] transition">
              <LayoutDashboard size={12}/> <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-[#aba8a4] border border-[#2b2f2b] hover:text-red-400 hover:border-red-500/40 transition">
            <LogOut size={12}/>
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: menu — full on desktop; on mobile shown only when mobileTab=menu */}
        <div className={`${mobileTab === 'cart' ? 'hidden' : 'flex'} md:flex flex-col flex-1 min-w-0 md:border-r border-[#2b2f2b]`}>
          <div className="shrink-0 px-3 pt-3 pb-0 space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aba8a4]"/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu…"
                className="w-full bg-[#191c19] border border-[#2b2f2b] rounded-xl pl-9 pr-4 py-2 text-sm text-[#f4efeb] placeholder:text-[#aba8a4]/60 focus:outline-none focus:border-[#349f2d] transition-colors"/>
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aba8a4]"><X size={12}/></button>}
            </div>
            {/* Open tickets rail — dine-in tables waiting to settle */}
            {openTickets.length > 0 && !search && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {openTickets.map(t => {
                  const mins = Math.max(0, Math.round((Date.now() - new Date(t.createdAt).getTime()) / 60000));
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSettling(t)}
                      className="shrink-0 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-left transition-colors hover:bg-yellow-500/20"
                    >
                      {/* The name is what a cashier calls out, so it leads;
                          the ticket number is the fallback for a walk-in. */}
                      <span className="block max-w-[9rem] truncate font-mono text-[11px] font-bold text-yellow-300">
                        {cleanName(t.customerName) || t.orderNumber}
                      </span>
                      <span className="block text-[11px] text-[#aba8a4]">
                        {formatCurrency(Number(t.total))} · {mins}m
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {!search && (
              <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => { setActiveCat(cat.id); setShowOffMenu(false); }}
                    className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition border ${cat.id === activeCat && !viewingOffMenu ? 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40' : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540] hover:text-[#f4efeb]'}`}>
                    {cat.name} <span className="opacity-50">({sellable(cat.items).length})</span>
                  </button>
                ))}
                {/* Only appears when something is actually off, so the row
                    stays clean on a normal day. */}
                {offMenuItems.length > 0 && (
                  <button onClick={() => setShowOffMenu(v => !v)}
                    className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition border ${viewingOffMenu ? 'bg-yellow-400/15 text-yellow-300 border-yellow-400/40' : 'text-[#aba8a4] border-[#2b2f2b] hover:border-yellow-400/40 hover:text-yellow-300'}`}>
                    Off menu <span className="opacity-50">({offMenuItems.length})</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredItems.map(item => {
                const inCartQty = cart.filter(c => c.menuItemId === item.id).reduce((n, c) => n + c.quantity, 0);
                const inCart = inCartQty > 0;
                const off = item.isAvailable === false;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      // Suppress the click that follows a long-press.
                      if (longPressFired.current) { longPressFired.current = false; return; }
                      if (off) { setEightySixTarget(item); return; }
                      if (modifiersEnabled && item.modifierGroups && item.modifierGroups.length > 0) {
                        setModifierTarget(item);
                        return;
                      }
                      // Quick-sale mode: straight onto the ticket, carrying
                      // the defaults any required group would have supplied.
                      addToCart(item, defaultModifiers(item));
                    }}
                    onPointerDown={() => startLongPress(item)}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onContextMenu={e => { e.preventDefault(); setEightySixTarget(item); }}
                    aria-label={off ? `${item.name} — unavailable, tap to put back on` : item.name}
                    className={`relative text-left rounded-2xl overflow-hidden border transition active:scale-[0.97] select-none ${
                      off
                        ? 'bg-[#141714] border-[#2b2f2b] opacity-45'
                        : inCart
                          ? 'bg-[#349f2d]/20 border-[#349f2d]/50'
                          : 'bg-[#191c19] border-[#2b2f2b] hover:border-[#404540] hover:bg-[#1b1e1b]'
                    }`}
                    style={{ WebkitTouchCallout: 'none' }}
                  >
                    {/* 86'd badge */}
                    {off && (
                      <span className="absolute top-2 left-2 z-10 rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                        86&apos;d
                      </span>
                    )}
                    {/* Quantity badge */}
                    {inCart && !off && (
                      <span className="absolute top-2 right-2 z-10 w-6 h-6 bg-[#349f2d] rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg">
                        {inCartQty}
                      </span>
                    )}
                    {/* Popular badge */}
                    {item.isPopular && !inCart && (
                      <span className="absolute top-2 right-2 z-10 text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full border border-yellow-400/30">★</span>
                    )}
                    {/* Item image */}
                    {item.image ? (
                      <div className="w-full h-20 bg-[#141714] overflow-hidden">
                        <Image
                          src={item.image}
                          alt={item.name}
                          width={200}
                          height={80}
                          className="w-full h-full object-cover opacity-90"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-full h-20 flex items-center justify-center"
                        style={{
                          background: `linear-gradient(160deg, ${tileArt(item.name).tint}55, ${tileArt(item.name).tint}22)`,
                        }}
                      >
                        <span className="text-3xl drop-shadow-sm" aria-hidden>
                          {tileArt(item.name).glyph}
                        </span>
                      </div>
                    )}
                    {/* Text */}
                    <div className="p-3">
                      <p className="text-[13px] font-semibold text-[#f4efeb] leading-snug mb-1">{item.name}</p>
                      <p className="text-sm font-bold text-[#5ecf4f]">{formatCurrency(item.price)}</p>
                    </div>
                  </button>
                );
              })}
              {filteredItems.length === 0 && (
                <div className="col-span-full text-center py-10 text-sm text-[#aba8a4]">
                  {search.trim() ? 'No items found' : 'Nothing on in this category'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: cart — fixed-width panel on desktop; full-width on mobile when mobileTab=cart */}
        <div className={`${mobileTab === 'cart' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 xl:w-80 shrink-0 bg-[#0a0b0a]`}>
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#2b2f2b]">
            <div className="flex items-center gap-2">
              <ShoppingCart size={15} className="text-[#5ecf4f]"/>
              <span className="text-sm font-semibold text-[#f4efeb]">Order</span>
              {cart.length > 0 && (
                <span className="bg-[#349f2d] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {cart.reduce((s, c) => s + c.quantity, 0)}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-[#aba8a4] hover:text-red-400 text-xs flex items-center gap-1 transition-colors">
                <RotateCcw size={11}/> Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <ShoppingCart size={22} className="text-[#2b2f2b] mb-2"/>
                <p className="text-sm text-[#aba8a4]">Tap items to add</p>
              </div>
            ) : cart.map(item => (
              <div key={item.lineId} className="bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#f4efeb] leading-tight">{item.name}</p>
                    {item.modifiers.length > 0 && (
                      <p className="mt-0.5 text-[11px] leading-snug text-[#5ecf4f]">
                        {item.modifiers.map(m => m.name).join(' · ')}
                      </p>
                    )}
                  </div>
                  <button onClick={() => removeFromCart(item.lineId)} className="text-[#aba8a4] hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={14}/>
                  </button>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.lineId, -1)} className="w-8 h-8 rounded-lg bg-[#2b2f2b] hover:bg-[#404540] flex items-center justify-center transition-colors active:scale-95">
                      <Minus size={14} className="text-[#f4efeb]"/>
                    </button>
                    <span className="text-sm font-bold text-[#f4efeb] w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.lineId, 1)} className="w-8 h-8 rounded-lg bg-[#349f2d] hover:bg-[#287e22] flex items-center justify-center transition-colors active:scale-95">
                      <Plus size={14} className="text-white"/>
                    </button>
                  </div>
                  <span className="text-sm font-bold text-[#5ecf4f]">{formatCurrency(item.price * item.quantity)}</span>
                </div>
                {/* Per-line note */}
                {editingNoteId === item.lineId ? (
                  <input autoFocus value={item.notes ?? ''} onChange={e => setItemNote(item.lineId, e.target.value)}
                    onBlur={() => setEditingNoteId(null)}
                    placeholder="Add note…"
                    className="w-full text-[10px] bg-[#111311] border border-[#349f2d]/40 rounded-lg px-2 py-1 text-[#f4efeb] placeholder:text-[#aba8a4]/50 focus:outline-none"/>
                ) : (
                  <button onClick={() => setEditingNoteId(item.lineId)}
                    className="text-[10px] text-[#aba8a4] hover:text-[#5ecf4f] flex items-center gap-1 transition-colors">
                    <Pencil size={9}/> {item.notes || 'Add note'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Checkout footer */}
          <div className="shrink-0 border-t border-[#2b2f2b] p-3 space-y-2.5">
            {/* Shift status with quick-open for cashiers */}
            {posSession ? (
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-[#5ecf4f]">
                  <Unlock size={10}/> Shift open · {posSession.openedByUser?.name}
                </div>
                <button onClick={() => setView('session')} className="text-[10px] text-[#aba8a4] hover:text-[#f4efeb] underline">
                  Manage
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] text-yellow-400">
                  <AlertCircle size={10}/> No shift open
                </div>
                <button onClick={() => setView('session')} className="text-[10px] font-semibold text-[#5ecf4f] hover:text-[#4cb33d] underline">
                  Open Shift →
                </button>
              </div>
            )}

            {/* Customer — on the cart, not buried in the payment screen, so a
                name can be attached to a "send to kitchen" ticket too. */}
            <CustomerFields
              name={customerName} onName={setCustomerName}
              phone={customerPhone} onPhone={setCustomerPhone}
              matches={customerMatches}
            />

            {/* Delivery type — chosen at order entry, before payment */}
            <div className="flex gap-1.5">
              {DELIVERY_TYPES.map(dt => (
                <button key={dt.id} onClick={() => setDeliveryType(dt.id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition border active:scale-95 ${deliveryType === dt.id ? 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40' : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540]'}`}>
                  {dt.label}
                </button>
              ))}
            </div>

            <div className="space-y-1 bg-[#191c19] rounded-xl px-4 py-3">
              {/* Only shown when an owner has set a levy — otherwise the total
                  is the subtotal and an extra line is just noise. */}
              {taxAmount > 0 && (
                <>
                  <div className="flex justify-between text-xs text-[#aba8a4]">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#aba8a4]">
                    <span>Levy ({(taxRate * 100).toFixed(1)}%)</span>
                    <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-[#aba8a4] uppercase tracking-wide">Total</span>
                <span className="text-2xl font-black text-[#5ecf4f] tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>
            <button onClick={goToPayment} disabled={cart.length === 0}
              className="w-full bg-[#349f2d] hover:bg-[#287e22] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl py-5 font-bold text-base transition active:scale-[0.98] shadow-[0_0_24px_rgba(52,159,45,0.4)]">
              <Receipt size={14} className="inline mr-1.5 -mt-0.5"/>
              Charge {cart.length > 0 ? formatCurrency(total) : ''}
            </button>
            {/* Dine-in: fire the food now, take the money when they leave. */}
            <button
              onClick={() => placeOrder({ unpaid: true })}
              disabled={cart.length === 0 || placing}
              className="mt-2 w-full min-h-[52px] rounded-2xl border border-[#2b2f2b] text-sm font-semibold text-[#aba8a4] transition-colors hover:border-[#404540] hover:text-[#f4efeb] disabled:opacity-40"
            >
              {placing ? 'Saving…' : 'Send to kitchen · pay later'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile bottom tab nav — only visible on small screens, replaces header session/orders buttons */}
      <nav className="md:hidden shrink-0 flex border-t border-[#2b2f2b] bg-[#0a0b0a]">
        <button
          onClick={() => setMobileTab('menu')}
          className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${mobileTab === 'menu' ? 'text-[#5ecf4f]' : 'text-[#aba8a4]'}`}>
          <Search size={20}/>
          <span className="text-[10px] font-medium">Menu</span>
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${mobileTab === 'cart' ? 'text-[#5ecf4f]' : 'text-[#aba8a4]'}`}>
          <div className="relative">
            <ShoppingCart size={20}/>
            {cart.reduce((s, c) => s + c.quantity, 0) > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-[#349f2d] text-white text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1">
                {cart.reduce((s, c) => s + c.quantity, 0)}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Cart</span>
        </button>
        <button
          onClick={() => { setView('orders'); fetchOrders(); }}
          className="flex-1 flex flex-col items-center py-3 gap-1 text-[#aba8a4] transition-colors">
          <Clock size={20}/>
          <span className="text-[10px] font-medium">Orders</span>
        </button>
        <button
          onClick={() => setView('session')}
          className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${posSession ? 'text-[#5ecf4f]' : 'text-yellow-400'}`}>
          {posSession ? <Unlock size={20}/> : <Lock size={20}/>}
          <span className="text-[10px] font-medium">Shift</span>
        </button>
      </nav>

      {/* Settle an open ticket */}
      {settling && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSettling(null)} />
          <div className="relative w-full space-y-4 rounded-t-3xl border-t border-[#2b2f2b] bg-[#191c19] p-5 sm:max-w-sm sm:rounded-3xl sm:border">
            <div>
              <p className="font-mono text-sm font-bold text-[#f4efeb]">{settling.orderNumber}</p>
              <p className="mt-0.5 text-xs text-[#aba8a4]">
                {settling.items?.length ?? 0} item{(settling.items?.length ?? 0) === 1 ? '' : 's'} ·{' '}
                {DELIVERY_LABELS[settling.deliveryType] ?? settling.deliveryType}
              </p>
              <p className="mt-3 text-3xl font-black tabular-nums text-[#5ecf4f]">
                {formatCurrency(Number(settling.total))}
              </p>
            </div>

            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-[#111311] p-3">
              {(settling.items ?? []).map((li: any) => (
                <li key={li.id} className="flex justify-between gap-3 text-xs text-[#aba8a4]">
                  <span>
                    {li.quantity}× {li.name}
                    {li.modifiers?.length > 0 && (
                      <span className="block text-[10px] text-[#5ecf4f]">
                        {li.modifiers.map((m: any) => m.name).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className="font-mono shrink-0">{formatCurrency(Number(li.subtotal))}</span>
                </li>
              ))}
            </ul>

            <div>
              <p className="mb-2 text-xs text-[#aba8a4]">How did they pay?</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(pm => (
                  <button
                    key={pm.id}
                    onClick={() => settleTicket(settling, pm.id, undefined, pm.id === 'CASH' ? Number(settling.total) : undefined)}
                    className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-[#2b2f2b] bg-[#111311] text-xs font-semibold text-[#f4efeb] transition-colors hover:border-[#349f2d]/50 active:scale-95"
                  >
                    <pm.icon size={18} className="text-[#5ecf4f]" />
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSettling(null)}
              className="w-full min-h-[46px] rounded-2xl border border-[#2b2f2b] text-sm text-[#aba8a4] transition-colors hover:text-[#f4efeb]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Modifier sheet — protein, spice, extras */}
      {modifierTarget && (
        <ModifierSheet
          item={modifierTarget}
          onCancel={() => setModifierTarget(null)}
          onConfirm={mods => { addToCart(modifierTarget, mods); setModifierTarget(null); }}
        />
      )}

      {/* 86 board sheet — long-press a tile to take a dish off, or put it back */}
      {eightySixTarget && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !eightySixSaving && setEightySixTarget(null)}
          />
          <div className="relative w-full sm:max-w-sm bg-[#191c19] border-t sm:border border-[#2b2f2b] rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
            <div>
              <p className="text-base font-bold text-[#f4efeb]">{eightySixTarget.name}</p>
              <p className="mt-1 text-xs text-[#aba8a4]">
                {eightySixTarget.isAvailable === false
                  ? "Currently 86'd — hidden from the register and the website."
                  : 'Ran out? Take it off until it is back.'}
              </p>
            </div>

            {eightySixTarget.isAvailable === false ? (
              <button
                onClick={() => setAvailability(eightySixTarget, true)}
                disabled={eightySixSaving}
                className="w-full min-h-[52px] rounded-2xl bg-[#349f2d] hover:bg-[#287e22] disabled:opacity-40 text-white font-bold text-sm transition-colors"
              >
                {eightySixSaving ? 'Saving…' : 'Put back on the menu'}
              </button>
            ) : (
              <button
                onClick={() => setAvailability(eightySixTarget, false)}
                disabled={eightySixSaving}
                className="w-full min-h-[52px] rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold text-sm transition-colors"
              >
                {eightySixSaving ? 'Saving…' : "Mark unavailable (86 it)"}
              </button>
            )}

            <button
              onClick={() => setEightySixTarget(null)}
              disabled={eightySixSaving}
              className="w-full min-h-[48px] rounded-2xl border border-[#2b2f2b] text-[#aba8a4] text-sm transition-colors hover:text-[#f4efeb]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Global print style */}
      <style jsx global>{`
        @media print {
          body > *:not(#receipt-print) { display: none !important; }
          #receipt-print { display: block !important; }
        }
      `}</style>
    </div>
  );
}
