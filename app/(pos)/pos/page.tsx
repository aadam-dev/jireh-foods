'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, X, Leaf, LogOut,
  LayoutDashboard, ChevronRight, Banknote, Smartphone, CreditCard,
  Building2, CheckCircle2, Printer, RotateCcw, Clock, AlertCircle,
  Lock, Unlock, Receipt, ChevronDown, Pencil, Zap,
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency, formatTime } from '@/src/lib/utils';

/* ─── Types ─────────────────────────────────────────────────────────── */
interface CartItem { menuItemId: string; name: string; price: number; quantity: number; notes?: string }
interface MenuCategory { id: string; name: string; items: { id: string; name: string; price: number; description?: string; isPopular: boolean }[] }
interface PosSession { id: string; openedByUser: { name: string }; openedAt: string; openingFloat: number; status: string }
interface SessionStats { revenue: number; cashRevenue: number }

const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Cash', icon: Banknote },
  { id: 'MOMO', label: 'MoMo', icon: Smartphone },
  { id: 'BOLT_FOOD', label: 'Bolt Food', icon: Zap },
];
const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash', MOMO: 'Mobile Money', BOLT_FOOD: 'Bolt Food',
  CARD: 'Card', BANK_TRANSFER: 'Bank Transfer', UNPAID: 'Unpaid',
};
const DELIVERY_TYPES = [
  { id: 'DINE_IN', label: 'Dine In' },
  { id: 'TAKEAWAY', label: 'Takeaway' },
  { id: 'DELIVERY', label: 'Delivery' },
];

const CART_KEY = 'jireh_pos_cart';

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
          className="py-3 rounded-xl bg-[#191c19] border border-[#2b2f2b] text-[#f4efeb] font-semibold text-lg hover:bg-[#232623] active:scale-95 transition-all">
          {k}
        </button>
      ))}
    </div>
  );
}

/* ─── Receipt Component ─────────────────────────────────────────────── */
function Receipt80mm({
  order,
  session: posSession,
  businessName = 'JIREH NATURAL FOODS',
  receiptFooter = 'Thank you for your patronage!',
}: {
  order: any;
  session: PosSession | null;
  businessName?: string;
  receiptFooter?: string;
}) {
  return (
    <div id="receipt-print" className="hidden print:block font-mono text-[11px] w-[72mm] mx-auto">
      <div className="text-center mb-2">
        <div className="font-bold text-[14px]">{businessName.toUpperCase()}</div>
        <div>Fresh &amp; Healthy — Always</div>
        <div>Tel: 055 113 3481</div>
        <div className="border-t border-dashed border-black mt-1 pt-1">
          {new Date(order.createdAt).toLocaleString('en-GH')}
        </div>
        <div>Order: {order.orderNumber}</div>
        {order.staff && <div>Served by: {order.staff.name}</div>}
        {posSession && <div>Session: {posSession.id.slice(0,8)}</div>}
      </div>
      <div className="border-t border-dashed border-black my-1" />
      {order.items.map((item: any, i: number) => (
        <div key={i} className="flex justify-between">
          <span>{item.quantity}× {item.name}</span>
          <span>{formatCurrency(item.subtotal)}</span>
        </div>
      ))}
      <div className="border-t border-dashed border-black my-1" />
      {Number(order.discountAmount) > 0 && (
        <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(order.discountAmount)}</span></div>
      )}
      {Number(order.taxAmount) > 0 && (
        <div className="flex justify-between"><span>Tax (GCL)</span><span>{formatCurrency(order.taxAmount)}</span></div>
      )}
      <div className="flex justify-between font-bold text-[13px]">
        <span>TOTAL</span><span>{formatCurrency(order.total)}</span>
      </div>
      <div className="flex justify-between mt-0.5">
        <span>Payment ({PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod})</span>
        {order.tenderedAmount && <span>Tendered: {formatCurrency(order.tenderedAmount)}</span>}
      </div>
      {order.changeAmount > 0 && (
        <div className="flex justify-between font-bold"><span>Change</span><span>{formatCurrency(order.changeAmount)}</span>
        </div>
      )}
      {order.paymentRef && <div>Ref: {order.paymentRef}</div>}
      <div className="border-t border-dashed border-black my-1" />
      <div className="text-center">
        {receiptFooter.split('\n').map((line, i) => <div key={i}>{line}</div>)}
      </div>
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
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [receiptSettings, setReceiptSettings] = useState({ businessName: 'Jireh Natural Foods', receiptFooter: 'Thank you for your patronage!' });
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [deliveryType, setDeliveryType] = useState('DINE_IN');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Payment flow
  const [view, setView] = useState<'register'|'payment'|'orders'|'session'>('register');
  const [tenderedStr, setTenderedStr] = useState('0');
  const [paymentRef, setPaymentRef] = useState('');

  // Session
  const [posSession, setPosSession] = useState<PosSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>({ revenue: 0, cashRevenue: 0 });
  const [openingFloatStr, setOpeningFloatStr] = useState('0');
  const [closingCashStr, setClosingCashStr] = useState('0');
  const [sessionLoading, setSessionLoading] = useState(false);
  const [closingSummary, setClosingSummary] = useState<any>(null);

  // Orders
  const [todayOrders, setTodayOrders] = useState<any[]>([]);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [placing, setPlacing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);

  // Hydrate cart from localStorage on first render (client-only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p.cart) && p.cart.length > 0) setCart(p.cart);
        if (p.deliveryType) setDeliveryType(p.deliveryType);
        if (p.customerName) setCustomerName(p.customerName);
        if (p.customerPhone) setCustomerPhone(p.customerPhone);
        if (p.orderNotes) setOrderNotes(p.orderNotes);
        if (typeof p.discountAmount === 'number') setDiscountAmount(p.discountAmount);
      }
    } catch {}
  }, []);

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    try {
      if (cart.length > 0 || customerName || customerPhone || orderNotes || discountAmount) {
        localStorage.setItem(CART_KEY, JSON.stringify({ cart, deliveryType, customerName, customerPhone, orderNotes, discountAmount }));
      } else {
        localStorage.removeItem(CART_KEY);
      }
    } catch {}
  }, [cart, deliveryType, customerName, customerPhone, orderNotes, discountAmount]);

  const fetchMenu = async () => {
    const res = await fetch('/api/pos/menu');
    const data = await res.json();
    setCategories(data);
    if (data.length > 0) setActiveCat(data[0].id);
  };

  const fetchSession = async () => {
    const res = await fetch('/api/pos/sessions');
    if (res.ok) {
      const data = await res.json();
      setPosSession(data.session);
      setSessionStats({ revenue: data.revenue, cashRevenue: data.cashRevenue });
    }
    setSessionChecked(true);
  };

  const fetchOrders = async () => {
    const url = posSession ? `/api/pos/orders?sessionId=${posSession.id}` : '/api/pos/orders';
    const res = await fetch(url);
    if (res.ok) setTodayOrders(await res.json());
  };

  useEffect(() => {
    fetchMenu();
    fetchSession();
    // Load receipt-relevant settings (business name + footer)
    fetch('/api/admin/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setReceiptSettings({
          businessName: data.business_name ?? 'Jireh Natural Foods',
          receiptFooter: data.receipt_footer ?? 'Thank you for your patronage!',
        });
      })
      .catch(() => {}); // silently fall back to defaults
  }, []);
  useEffect(() => { if (authSession?.user) fetchOrders(); }, [authSession, posSession]);

  // Cart helpers
  const addToCart = useCallback((item: MenuCategory['items'][0]) => {
    setCart(prev => {
      const ex = prev.find(c => c.menuItemId === item.id);
      if (ex) return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }, []);
  const updateQty = (id: string, delta: number) => setCart(prev => prev.map(c => c.menuItemId === id ? { ...c, quantity: c.quantity + delta } : c).filter(c => c.quantity > 0));
  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.menuItemId !== id));
  const setItemNote = (id: string, note: string) => setCart(prev => prev.map(c => c.menuItemId === id ? { ...c, notes: note } : c));
  const clearCart = () => {
    setCart([]); setCustomerName(''); setCustomerPhone(''); setOrderNotes('');
    setDiscountAmount(0); setTenderedStr('0'); setPaymentRef('');
    try { localStorage.removeItem(CART_KEY); } catch {}
  };

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const total = Math.max(0, subtotal - discountAmount);
  const tendered = parseFloat(tenderedStr) || 0;
  const change = paymentMethod === 'CASH' ? Math.max(0, tendered - total) : 0;
  const canCharge = cart.length > 0 && (paymentMethod !== 'CASH' || tendered >= total);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const res = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          paymentMethod,
          deliveryType,
          paymentRef: paymentRef || undefined,
          tenderedAmount: paymentMethod === 'CASH' ? tendered : undefined,
          discountAmount,
          sessionId: posSession?.id,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          notes: orderNotes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Order failed: ${err.error || res.statusText || 'Unknown error'}`);
        return;
      }
      const order = await res.json();
      if (!order?.orderNumber) {
        alert('Order failed: invalid response from server');
        return;
      }
      setLastOrder({ ...order, createdAt: new Date().toISOString() });
      clearCart();
      setView('register');
      fetchOrders();
      fetchSession();
      // Auto-trigger print dialog after a short delay (lets the success screen render first)
      setTimeout(() => { try { window.print(); } catch {} }, 600);
    } catch (e: any) {
      alert(`Order failed: ${e?.message || 'Network error'}`);
    } finally { setPlacing(false); }
  };

  // Session actions
  const openSession = async () => {
    setSessionLoading(true);
    try {
      const res = await fetch('/api/pos/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingFloat: parseFloat(openingFloatStr) }),
      });
      if (res.ok) { await fetchSession(); setView('register'); }
      else { const e = await res.json(); alert(e.error); }
    } finally { setSessionLoading(false); }
  };

  const closeSession = async () => {
    if (!posSession) return;
    setSessionLoading(true);
    try {
      const res = await fetch('/api/pos/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: posSession.id, closingCash: parseFloat(closingCashStr) }),
      });
      if (res.ok) {
        const data = await res.json();
        setClosingSummary(data.summary);
        setPosSession(null);
        setSessionStats({ revenue: 0, cashRevenue: 0 });
      }
    } finally { setSessionLoading(false); }
  };

  const filteredItems = search.trim()
    ? categories.flatMap(c => c.items).filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : categories.find(c => c.id === activeCat)?.items ?? [];

  /* ─── Post-order success / print screen ─────────────────────────── */
  if (lastOrder) {
    return (
      <div className="h-screen bg-[#111311] flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-[#349f2d]/20 border border-[#349f2d]/40 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-[#5ecf4f]" />
          </div>
          <h2 className="text-xl font-bold text-[#f4efeb] font-serif mb-1">Order Complete!</h2>
          {isItAdmin && (
            <span className="inline-block mb-2 px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-400 text-[10px] font-bold tracking-wide">
              DEMO — not counted in sales
            </span>
          )}
          <p className="text-sm text-[#aba8a4] mb-2">{lastOrder.orderNumber}</p>
          <p className="text-3xl font-bold text-[#5ecf4f] mb-1">{formatCurrency(lastOrder.total)}</p>
          {lastOrder.changeAmount > 0 && (
            <p className="text-lg text-yellow-400 mb-4">Change: {formatCurrency(lastOrder.changeAmount)}</p>
          )}
          <div className="space-y-1 mb-6 text-sm text-[#aba8a4] bg-[#191c19] rounded-2xl p-4">
            {lastOrder.items?.map((item: any) => (
              <div key={item.id} className="flex justify-between">
                <span>{item.quantity}× {item.name}</span>
                <span className="text-[#f4efeb]">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
            <div className="border-t border-[#2b2f2b] pt-2 mt-2 flex justify-between font-semibold text-[#f4efeb]">
              <span>Total</span><span>{formatCurrency(lastOrder.total)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 bg-[#191c19] hover:bg-[#232623] border border-[#2b2f2b] text-[#f4efeb] rounded-2xl py-3 text-sm font-medium transition-colors">
              <Printer size={15} /> Print Receipt
            </button>
            <button onClick={() => setLastOrder(null)}
              className="flex-1 bg-[#349f2d] hover:bg-[#287e22] text-white rounded-2xl py-3 font-semibold text-sm transition-colors">
              New Order
            </button>
          </div>
        </div>
        <Receipt80mm
          order={lastOrder}
          session={posSession}
          businessName={receiptSettings.businessName}
          receiptFooter={receiptSettings.receiptFooter}
        />
      </div>
    );
  }

  /* ─── Session closing summary ────────────────────────────────────── */
  if (closingSummary) {
    const disc = closingSummary.discrepancy;
    return (
      <div className="h-screen bg-[#111311] flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-[#191c19] border border-[#2b2f2b] rounded-3xl p-6">
          <h2 className="text-xl font-bold text-[#f4efeb] font-serif mb-4 text-center">Session Closed</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-[#aba8a4]">Orders</span><span className="text-[#f4efeb] font-semibold">{closingSummary.orderCount}</span></div>
            <div className="flex justify-between"><span className="text-[#aba8a4]">Total Revenue</span><span className="text-[#5ecf4f] font-bold">{formatCurrency(closingSummary.totalRevenue)}</span></div>
            <div className="border-t border-[#2b2f2b] pt-3">
              {Object.entries(closingSummary.revenueByMethod ?? {}).map(([method, amt]) => (
                <div key={method} className="flex justify-between mb-1">
                  <span className="text-[#aba8a4] capitalize">{method}</span>
                  <span className="text-[#f4efeb]">{formatCurrency(amt as number)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-[#2b2f2b] pt-3 space-y-2">
              <div className="flex justify-between"><span className="text-[#aba8a4]">Expected Cash</span><span className="text-[#f4efeb]">{formatCurrency(closingSummary.expectedCash)}</span></div>
              <div className="flex justify-between"><span className="text-[#aba8a4]">Counted Cash</span><span className="text-[#f4efeb]">{formatCurrency(closingSummary.closingCash)}</span></div>
              <div className="flex justify-between font-bold">
                <span className="text-[#aba8a4]">Discrepancy</span>
                <span className={disc === 0 ? 'text-[#5ecf4f]' : disc > 0 ? 'text-blue-400' : 'text-red-400'}>
                  {disc >= 0 ? '+' : ''}{formatCurrency(disc)}
                </span>
              </div>
            </div>
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

  /* ─── Mandatory session gate ─────────────────────────────────────── */
  const canManageShift = !!user; // all authenticated staff can open/close shifts

  // While NextAuth or POS session is still loading, show spinner
  if (!sessionChecked || authStatus === 'loading') {
    return (
      <div className="h-screen bg-[#111311] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-[#349f2d] border-t-transparent animate-spin mx-auto mb-3"/>
          <p className="text-sm text-[#aba8a4]">Loading POS…</p>
        </div>
      </div>
    );
  }

  // No open session and not currently in the session management view → gate
  // IT admin bypasses this gate — they can demo without opening a real shift
  if (!posSession && view !== 'session' && !isItAdmin) {
    return (
      <div className="h-screen bg-[#111311] flex flex-col overflow-hidden">
        <header className="shrink-0 flex items-center justify-between px-4 py-3 bg-[#0a0b0a] border-b border-[#2b2f2b]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#349f2d]/20 border border-[#349f2d]/40 flex items-center justify-center">
              <Leaf size={14} className="text-[#5ecf4f]"/>
            </div>
            <span className="text-sm font-semibold text-[#f4efeb]">Jireh POS</span>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-[#aba8a4] border border-[#2b2f2b] hover:text-red-400 hover:border-red-500/40 transition-all">
            <LogOut size={12}/>
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          {canManageShift ? (
            <div className="w-full max-w-sm bg-[#191c19] border border-[#2b2f2b] rounded-3xl p-6 space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#349f2d]/10 border border-[#349f2d]/30 flex items-center justify-center mx-auto mb-3">
                  <Lock size={24} className="text-[#5ecf4f]"/>
                </div>
                <h2 className="text-lg font-bold text-[#f4efeb] font-serif">Open Today's Shift</h2>
                <p className="text-xs text-[#aba8a4] mt-1">A shift must be open before you can take orders.</p>
              </div>
              <div>
                <p className="text-xs text-[#aba8a4] mb-2">Opening Cash Float</p>
                <p className="text-2xl font-bold text-[#5ecf4f] font-mono text-center mb-3">{formatCurrency(parseFloat(openingFloatStr) || 0)}</p>
                <Numpad value={openingFloatStr} onChange={setOpeningFloatStr}/>
              </div>
              <button onClick={openSession} disabled={sessionLoading}
                className="w-full bg-[#349f2d] hover:bg-[#287e22] disabled:opacity-40 text-white rounded-2xl py-3.5 font-bold text-sm transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(52,159,45,0.3)]">
                {sessionLoading ? 'Opening…' : 'Open Shift & Start Selling'}
              </button>
            </div>
          ) : (
            <div className="text-center py-12">
              <Lock size={40} className="mx-auto mb-4 text-[#2b2f2b]"/>
              <h2 className="text-lg font-bold text-[#f4efeb] mb-2">No Active Shift</h2>
              <p className="text-sm text-[#aba8a4]">Ask your Manager or Owner to open a shift<br/>before orders can be taken.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─── Payment screen ─────────────────────────────────────────────── */
  if (view === 'payment') {
    return (
      <div className="h-screen bg-[#111311] flex flex-col overflow-hidden">
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-[#0a0b0a] border-b border-[#2b2f2b]">
          <button onClick={() => setView('register')} className="p-2 rounded-xl text-[#aba8a4] hover:text-[#f4efeb] border border-[#2b2f2b] hover:border-[#404540] transition-all">
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
            <div className="flex justify-between font-bold text-[#f4efeb] border-t border-[#2b2f2b] pt-2 mt-1">
              <span>Total</span><span className="text-[#5ecf4f] text-xl">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Discount input */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#aba8a4] w-20 shrink-0">Discount (GH₵)</label>
            <input type="number" min="0" max={subtotal} value={discountAmount || ''} onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
              className="flex-1 bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2 text-sm text-[#f4efeb] focus:outline-none focus:border-[#349f2d]" placeholder="0" />
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-4 gap-1.5">
            {PAYMENT_METHODS.map(pm => {
              const Icon = pm.icon;
              return (
                <button key={pm.id} onClick={() => setPaymentMethod(pm.id)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-medium transition-all border ${paymentMethod === pm.id ? 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40' : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540]'}`}>
                  <Icon size={18}/>{pm.label}
                </button>
              );
            })}
          </div>

          {/* Cash numpad */}
          {paymentMethod === 'CASH' && (
            <div className="space-y-3">
              <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4">
                <p className="text-xs text-[#aba8a4] mb-1">Amount Tendered</p>
                <p className="text-3xl font-bold text-[#f4efeb] font-mono">{formatCurrency(parseFloat(tenderedStr) || 0)}</p>
                {tendered >= total && (
                  <p className="text-lg font-semibold text-[#5ecf4f] mt-1">Change: {formatCurrency(change)}</p>
                )}
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

          {/* MoMo reference */}
          {paymentMethod === 'MOMO' && (
            <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4 space-y-3">
              <p className="text-sm font-medium text-[#f4efeb]">MoMo Transaction Reference</p>
              <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)}
                placeholder="Enter MoMo reference number"
                className="w-full bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] placeholder:text-[#aba8a4]/50 focus:outline-none focus:border-[#349f2d] transition-colors"/>
              <p className="text-xs text-[#aba8a4]">Total due: <strong className="text-[#5ecf4f]">{formatCurrency(total)}</strong></p>
            </div>
          )}

          {/* Bolt Food */}
          {paymentMethod === 'BOLT_FOOD' && (
            <div className="bg-[#191c19] border border-[#60a5fa]/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-[#60a5fa]" />
                <p className="text-sm font-medium text-[#f4efeb]">Bolt Food Order Reference</p>
              </div>
              <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)}
                placeholder="Enter Bolt order number / reference"
                className="w-full bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] placeholder:text-[#aba8a4]/50 focus:outline-none focus:border-[#60a5fa] transition-colors"/>
              <p className="text-xs text-[#aba8a4]">
                Payment collected by Bolt · Amount: <strong className="text-[#60a5fa]">{formatCurrency(total)}</strong>
              </p>
            </div>
          )}

          {/* Customer */}
          <div className="grid grid-cols-2 gap-2">
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name"
              className="bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2 text-xs text-[#f4efeb] placeholder:text-[#aba8a4]/60 focus:outline-none focus:border-[#349f2d]" />
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone (optional)"
              className="bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2 text-xs text-[#f4efeb] placeholder:text-[#aba8a4]/60 focus:outline-none focus:border-[#349f2d]" />
          </div>
        </div>

        <div className="shrink-0 p-4 border-t border-[#2b2f2b] bg-[#0a0b0a]">
          <button onClick={placeOrder} disabled={!canCharge || placing}
            className="w-full bg-[#349f2d] hover:bg-[#287e22] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl py-4 font-bold text-base transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(52,159,45,0.3)]">
            {placing ? 'Processing…' : `Confirm Payment — ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    );
  }

  /* ─── Session management view ──────────────────────────────────────── */
  if (view === 'session') {
    return (
      <div className="h-screen bg-[#111311] flex flex-col overflow-hidden">
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-[#0a0b0a] border-b border-[#2b2f2b]">
          <button onClick={() => setView('register')} className="p-2 rounded-xl text-[#aba8a4] hover:text-[#f4efeb] border border-[#2b2f2b] transition-all">
            <X size={16}/>
          </button>
          <span className="text-sm font-semibold text-[#f4efeb]">Shift / Session</span>
        </header>
        <div className="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full space-y-4">
          {posSession ? (
            /* Close session */
            <div className="space-y-4">
              <div className="bg-[#191c19] border border-[#349f2d]/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-[#5ecf4f] mb-1"><Unlock size={16}/><span className="font-semibold text-sm">Session Open</span></div>
                <div className="text-xs text-[#aba8a4]">Opened by <strong className="text-[#f4efeb]">{posSession.openedByUser?.name}</strong></div>
                <div className="text-xs text-[#aba8a4]">Since {new Date(posSession.openedAt).toLocaleString('en-GH')}</div>
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
              {canManageShift && (
                <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-[#f4efeb]">Close Shift — Enter Physical Cash Count</p>
                  <div className="bg-[#111311] rounded-xl p-3">
                    <p className="text-xs text-[#aba8a4] mb-1">Opening Float: {formatCurrency(posSession.openingFloat)}</p>
                    <p className="text-xs text-[#aba8a4]">Expected Cash: {formatCurrency(Number(posSession.openingFloat) + sessionStats.cashRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#aba8a4] mb-2">Counted Cash</p>
                    <p className="text-2xl font-bold text-[#f4efeb] font-mono mb-3">{formatCurrency(parseFloat(closingCashStr) || 0)}</p>
                    <Numpad value={closingCashStr} onChange={setClosingCashStr}/>
                  </div>
                  <button onClick={closeSession} disabled={sessionLoading}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl py-3 font-semibold text-sm transition-colors">
                    {sessionLoading ? 'Closing…' : 'Close Session'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Open session */
            canManageShift ? (
              <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2 text-[#aba8a4]"><Lock size={16}/><span className="font-semibold text-sm text-[#f4efeb]">No Active Session</span></div>
                <p className="text-xs text-[#aba8a4]">Open a new shift to start taking orders.</p>
                <div>
                  <p className="text-xs text-[#aba8a4] mb-2">Opening Cash Float</p>
                  <p className="text-2xl font-bold text-[#5ecf4f] font-mono mb-3">{formatCurrency(parseFloat(openingFloatStr) || 0)}</p>
                  <Numpad value={openingFloatStr} onChange={setOpeningFloatStr}/>
                </div>
                <button onClick={openSession} disabled={sessionLoading}
                  className="w-full bg-[#349f2d] hover:bg-[#287e22] disabled:opacity-40 text-white rounded-xl py-3 font-semibold text-sm transition-colors">
                  {sessionLoading ? 'Opening…' : 'Open Shift'}
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-[#aba8a4] text-sm">
                <Lock size={32} className="mx-auto mb-3 opacity-40"/>
                <p>No active session. Ask the Owner to open a shift.</p>
              </div>
            )
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
          <button onClick={() => setView('register')} className="p-2 rounded-xl text-[#aba8a4] hover:text-[#f4efeb] border border-[#2b2f2b] transition-all">
            <X size={16}/>
          </button>
          <span className="text-sm font-semibold text-[#f4efeb]">Today's Orders ({todayOrders.length})</span>
        </header>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {todayOrders.length === 0 ? (
            <div className="text-center py-16 text-[#aba8a4] text-sm">No orders yet</div>
          ) : todayOrders.map(order => (
            <div key={order.id} className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#f4efeb]">{order.orderNumber}</p>
                <p className="text-xs text-[#aba8a4] mt-0.5 truncate">{order.items?.map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}</p>
                <p className="text-xs text-[#aba8a4]">{formatTime(order.createdAt)} · {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-[#5ecf4f]">{formatCurrency(order.total)}</p>
                {order.changeAmount > 0 && <p className="text-xs text-yellow-400">Chg: {formatCurrency(order.changeAmount)}</p>}
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
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-3 py-2.5 bg-[#0a0b0a] border-b border-[#2b2f2b]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#349f2d]/20 border border-[#349f2d]/40 flex items-center justify-center">
            <Leaf size={14} className="text-[#5ecf4f]"/>
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
          <span className="text-xs font-mono text-[#aba8a4] hidden md:block">
            {currentTime.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          {/* Session pill */}
          <button onClick={() => setView('session')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${posSession ? 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40' : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540]'}`}>
            {posSession ? <><Unlock size={12}/> Shift Open</> : <><Lock size={12}/> No Shift</>}
          </button>
          <button onClick={() => { setView('orders'); fetchOrders(); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#aba8a4] border border-[#2b2f2b] hover:border-[#404540] transition-all">
            <Clock size={12}/> Orders
          </button>
          {user && ['OWNER', 'MANAGER'].includes(user.role) && (
            <Link href="/admin" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#aba8a4] border border-[#2b2f2b] hover:border-[#404540] transition-all">
              <LayoutDashboard size={12}/> Admin
            </Link>
          )}
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-[#aba8a4] border border-[#2b2f2b] hover:text-red-400 hover:border-red-500/40 transition-all">
            <LogOut size={12}/>
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Left: menu */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[#2b2f2b]">
          <div className="shrink-0 px-3 pt-3 pb-0 space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aba8a4]"/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu…"
                className="w-full bg-[#191c19] border border-[#2b2f2b] rounded-xl pl-9 pr-4 py-2 text-sm text-[#f4efeb] placeholder:text-[#aba8a4]/60 focus:outline-none focus:border-[#349f2d] transition-colors"/>
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aba8a4]"><X size={12}/></button>}
            </div>
            {!search && (
              <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                    className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${cat.id === activeCat ? 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40' : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540] hover:text-[#f4efeb]'}`}>
                    {cat.name} <span className="opacity-50">({cat.items.length})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredItems.map(item => {
                const inCart = cart.find(c => c.menuItemId === item.id);
                return (
                  <button key={item.id} onClick={() => addToCart(item)}
                    className={`relative text-left rounded-2xl p-4 min-h-[90px] border transition-all active:scale-[0.97] ${inCart ? 'bg-[#349f2d]/20 border-[#349f2d]/50' : 'bg-[#191c19] border-[#2b2f2b] hover:border-[#404540] hover:bg-[#1b1e1b]'}`}>
                    {inCart && (
                      <span className="absolute top-2.5 right-2.5 w-6 h-6 bg-[#349f2d] rounded-full flex items-center justify-center text-xs font-bold text-white">
                        {inCart.quantity}
                      </span>
                    )}
                    {item.isPopular && !inCart && (
                      <span className="absolute top-2.5 right-2.5 text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full border border-yellow-400/30">★ Popular</span>
                    )}
                    <p className="text-[15px] font-semibold text-[#f4efeb] leading-snug mb-2 pr-6">{item.name}</p>
                    <p className="text-base font-bold text-[#5ecf4f]">{formatCurrency(item.price)}</p>
                  </button>
                );
              })}
              {filteredItems.length === 0 && (
                <div className="col-span-full text-center py-10 text-sm text-[#aba8a4]">No items found</div>
              )}
            </div>
          </div>
        </div>

        {/* Right: cart */}
        <div className="w-72 xl:w-80 shrink-0 flex flex-col bg-[#0a0b0a]">
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
              <div key={item.menuItemId} className="bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-[#f4efeb] flex-1 leading-tight">{item.name}</p>
                  <button onClick={() => removeFromCart(item.menuItemId)} className="text-[#aba8a4] hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={14}/>
                  </button>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.menuItemId, -1)} className="w-8 h-8 rounded-lg bg-[#2b2f2b] hover:bg-[#404540] flex items-center justify-center transition-colors active:scale-95">
                      <Minus size={14} className="text-[#f4efeb]"/>
                    </button>
                    <span className="text-sm font-bold text-[#f4efeb] w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.menuItemId, 1)} className="w-8 h-8 rounded-lg bg-[#349f2d] hover:bg-[#287e22] flex items-center justify-center transition-colors active:scale-95">
                      <Plus size={14} className="text-white"/>
                    </button>
                  </div>
                  <span className="text-sm font-bold text-[#5ecf4f]">{formatCurrency(item.price * item.quantity)}</span>
                </div>
                {/* Per-line note */}
                {editingNoteId === item.menuItemId ? (
                  <input autoFocus value={item.notes ?? ''} onChange={e => setItemNote(item.menuItemId, e.target.value)}
                    onBlur={() => setEditingNoteId(null)}
                    placeholder="Add note…"
                    className="w-full text-[10px] bg-[#111311] border border-[#349f2d]/40 rounded-lg px-2 py-1 text-[#f4efeb] placeholder:text-[#aba8a4]/50 focus:outline-none"/>
                ) : (
                  <button onClick={() => setEditingNoteId(item.menuItemId)}
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

            {/* Delivery type — chosen at order entry, before payment */}
            <div className="flex gap-1.5">
              {DELIVERY_TYPES.map(dt => (
                <button key={dt.id} onClick={() => setDeliveryType(dt.id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border active:scale-95 ${deliveryType === dt.id ? 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40' : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540]'}`}>
                  {dt.label}
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center bg-[#191c19] rounded-xl px-4 py-2.5">
              <span className="text-xs text-[#aba8a4]">Total</span>
              <span className="text-lg font-bold text-[#5ecf4f] font-serif">{formatCurrency(total)}</span>
            </div>
            <button onClick={() => setView('payment')} disabled={cart.length === 0}
              className="w-full bg-[#349f2d] hover:bg-[#287e22] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl py-5 font-bold text-base transition-all active:scale-[0.98] shadow-[0_0_24px_rgba(52,159,45,0.4)]">
              <Receipt size={14} className="inline mr-1.5 -mt-0.5"/>
              Charge {cart.length > 0 ? formatCurrency(total) : ''}
            </button>
          </div>
        </div>
      </div>

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
