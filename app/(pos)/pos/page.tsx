'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, X,
  Leaf, LogOut, LayoutDashboard, ChevronRight,
  Banknote, Smartphone, CreditCard, Building2,
  CheckCircle2, Printer, RotateCcw, Clock,
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency, formatTime } from '@/src/lib/utils';

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface MenuCategory {
  id: string;
  name: string;
  items: { id: string; name: string; price: number; description?: string; tags: string[]; isPopular: boolean }[];
}

const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Cash', icon: <Banknote size={16} /> },
  { id: 'MOMO', label: 'MoMo', icon: <Smartphone size={16} /> },
  { id: 'CARD', label: 'Card', icon: <CreditCard size={16} /> },
  { id: 'BANK_TRANSFER', label: 'Bank', icon: <Building2 size={16} /> },
];

const DELIVERY_TYPES = [
  { id: 'DINE_IN', label: 'Dine In' },
  { id: 'TAKEAWAY', label: 'Takeaway' },
  { id: 'DELIVERY', label: 'Delivery' },
];

export default function POSPage() {
  const { data: session } = useSession();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [activeCat, setActiveCat] = useState<string>('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [deliveryType, setDeliveryType] = useState('DINE_IN');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [todayOrders, setTodayOrders] = useState<any[]>([]);
  const [view, setView] = useState<'register' | 'orders'>('register');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchMenu = async () => {
    const res = await fetch('/api/pos/menu');
    const data = await res.json();
    setCategories(data);
    if (data.length > 0) setActiveCat(data[0].id);
  };

  const fetchOrders = async () => {
    const res = await fetch(`/api/pos/orders?staffId=${session?.user?.id}`);
    const data = await res.json();
    setTodayOrders(data);
  };

  useEffect(() => { fetchMenu(); }, []);
  useEffect(() => { if (session?.user?.id) fetchOrders(); }, [session]);

  const addToCart = useCallback((item: MenuCategory['items'][0]) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id);
      if (existing) {
        return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }, []);

  const updateQty = (menuItemId: string, delta: number) => {
    setCart(prev => prev
      .map(c => c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + delta } : c)
      .filter(c => c.quantity > 0)
    );
  };

  const removeFromCart = (menuItemId: string) => setCart(prev => prev.filter(c => c.menuItemId !== menuItemId));
  const clearCart = () => { setCart([]); setCustomerName(''); setCustomerPhone(''); setNotes(''); };

  const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);

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
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          notes: notes || undefined,
        }),
      });
      const order = await res.json();
      setLastOrder(order);
      clearCart();
      fetchOrders();
    } finally { setPlacing(false); }
  };

  const filteredItems = (() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return categories.flatMap(c => c.items).filter(i => i.name.toLowerCase().includes(q));
    }
    return categories.find(c => c.id === activeCat)?.items ?? [];
  })();

  // Success screen
  if (lastOrder) {
    return (
      <div className="h-screen bg-[#111311] flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 rounded-full bg-[#349f2d]/20 border border-[#349f2d]/40 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-[#5ecf4f]" />
          </div>
          <h2 className="text-xl font-bold text-[#f4efeb] font-serif mb-1">Order Placed!</h2>
          <p className="text-sm text-[#aba8a4] mb-2">{lastOrder.orderNumber}</p>
          <p className="text-3xl font-bold text-[#5ecf4f] mb-6">{formatCurrency(lastOrder.total)}</p>
          <div className="space-y-2 mb-6 text-sm text-[#aba8a4] bg-[#191c19] rounded-2xl p-4">
            {lastOrder.items.map((item: any) => (
              <div key={item.id} className="flex justify-between">
                <span>{item.quantity}× {item.name}</span>
                <span className="text-[#f4efeb]">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setLastOrder(null)}
            className="w-full bg-[#349f2d] hover:bg-[#287e22] text-white rounded-2xl py-3 font-semibold text-sm transition-colors"
          >
            New Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#111311] overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-[#0a0b0a] border-b border-[#2b2f2b]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#349f2d]/20 border border-[#349f2d]/40 flex items-center justify-center">
            <Leaf size={14} className="text-[#5ecf4f]" />
          </div>
          <span className="text-sm font-semibold text-[#f4efeb]">Jireh POS</span>
          <span className="text-xs text-[#aba8a4] hidden sm:block">·</span>
          <span className="text-xs text-[#aba8a4] hidden sm:block">{session?.user?.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#aba8a4] font-mono hidden sm:block">
            {currentTime.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            onClick={() => setView(view === 'register' ? 'orders' : 'register')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${view === 'orders' ? 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40' : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540]'}`}
          >
            <Clock size={13} /> Today's Orders
          </button>
          {session?.user && ['OWNER', 'MANAGER'].includes((session.user as any).role) && (
            <Link href="/admin" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#aba8a4] border border-[#2b2f2b] hover:border-[#404540] transition-all">
              <LayoutDashboard size={13} /> Admin
            </Link>
          )}
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-[#aba8a4] border border-[#2b2f2b] hover:text-red-400 hover:border-red-500/40 transition-all">
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </header>

      {view === 'orders' ? (
        /* Today's orders view */
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-lg font-bold text-[#f4efeb] font-serif mb-3">Today's Orders ({todayOrders.length})</h2>
          {todayOrders.length === 0 ? (
            <div className="text-center py-12 text-[#aba8a4] text-sm">No orders yet today</div>
          ) : (
            <div className="space-y-2">
              {todayOrders.map(order => (
                <div key={order.id} className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#f4efeb]">{order.orderNumber}</p>
                    <p className="text-xs text-[#aba8a4]">{order.items.map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}</p>
                    <p className="text-xs text-[#aba8a4]">{formatTime(order.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#5ecf4f]">{formatCurrency(order.total)}</p>
                    <p className="text-xs text-[#aba8a4]">{order.paymentMethod}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Main register */
        <div className="flex-1 flex min-h-0">
          {/* Left: menu */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-[#2b2f2b]">
            {/* Search + category tabs */}
            <div className="shrink-0 px-3 pt-3 pb-0 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aba8a4]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search menu…"
                  className="w-full bg-[#191c19] border border-[#2b2f2b] rounded-xl pl-9 pr-4 py-2 text-sm text-[#f4efeb] placeholder:text-[#aba8a4]/60 focus:outline-none focus:border-[#349f2d] transition-colors"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aba8a4] hover:text-[#f4efeb]">
                    <X size={13} />
                  </button>
                )}
              </div>
              {!search && (
                <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCat(cat.id)}
                      className={[
                        'shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border',
                        cat.id === activeCat
                          ? 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40'
                          : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540] hover:text-[#f4efeb]',
                      ].join(' ')}
                    >
                      {cat.name} <span className="opacity-60">({cat.items.length})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Menu items grid */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {filteredItems.map(item => {
                  const inCart = cart.find(c => c.menuItemId === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className={[
                        'relative text-left rounded-2xl p-3 border transition-all active:scale-[0.97]',
                        inCart
                          ? 'bg-[#349f2d]/20 border-[#349f2d]/50'
                          : 'bg-[#191c19] border-[#2b2f2b] hover:border-[#404540] hover:bg-[#1b1e1b]',
                      ].join(' ')}
                    >
                      {inCart && (
                        <span className="absolute top-2 right-2 w-5 h-5 bg-[#349f2d] rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                          {inCart.quantity}
                        </span>
                      )}
                      {item.isPopular && !inCart && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full border border-yellow-400/30">
                          ★
                        </span>
                      )}
                      <p className="text-sm font-semibold text-[#f4efeb] leading-tight mb-1 pr-5">{item.name}</p>
                      {item.description && (
                        <p className="text-[10px] text-[#aba8a4] line-clamp-1 mb-1.5">{item.description}</p>
                      )}
                      <p className="text-sm font-bold text-[#5ecf4f]">{formatCurrency(item.price)}</p>
                    </button>
                  );
                })}
                {filteredItems.length === 0 && (
                  <div className="col-span-full text-center py-10 text-sm text-[#aba8a4]">
                    No items found
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: cart */}
          <div className="w-80 xl:w-96 shrink-0 flex flex-col bg-[#0a0b0a]">
            {/* Cart header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#2b2f2b]">
              <div className="flex items-center gap-2">
                <ShoppingCart size={16} className="text-[#5ecf4f]" />
                <span className="text-sm font-semibold text-[#f4efeb]">Order</span>
                {cart.length > 0 && (
                  <span className="bg-[#349f2d] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {cart.reduce((s, c) => s + c.quantity, 0)}
                  </span>
                )}
              </div>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-[#aba8a4] hover:text-red-400 flex items-center gap-1 text-xs transition-colors">
                  <RotateCcw size={12} /> Clear
                </button>
              )}
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <ShoppingCart size={24} className="text-[#2b2f2b] mb-2" />
                  <p className="text-sm text-[#aba8a4]">Tap items to add them</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.menuItemId} className="bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-[#f4efeb] leading-tight flex-1">{item.name}</p>
                      <button onClick={() => removeFromCart(item.menuItemId)} className="text-[#aba8a4] hover:text-red-400 transition-colors shrink-0 mt-0.5">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(item.menuItemId, -1)}
                          className="w-6 h-6 rounded-lg bg-[#2b2f2b] hover:bg-[#404540] flex items-center justify-center transition-colors"
                        >
                          <Minus size={11} className="text-[#f4efeb]" />
                        </button>
                        <span className="text-sm font-semibold text-[#f4efeb] w-5 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.menuItemId, 1)}
                          className="w-6 h-6 rounded-lg bg-[#349f2d] hover:bg-[#287e22] flex items-center justify-center transition-colors"
                        >
                          <Plus size={11} className="text-white" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-[#5ecf4f]">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Order details + checkout */}
            <div className="shrink-0 border-t border-[#2b2f2b] p-3 space-y-3">
              {/* Delivery type */}
              <div className="flex gap-1">
                {DELIVERY_TYPES.map(dt => (
                  <button
                    key={dt.id}
                    onClick={() => setDeliveryType(dt.id)}
                    className={[
                      'flex-1 py-1.5 rounded-xl text-xs font-medium transition-all border',
                      deliveryType === dt.id
                        ? 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40'
                        : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540]',
                    ].join(' ')}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>

              {/* Customer (optional) */}
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className="bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2 text-xs text-[#f4efeb] placeholder:text-[#aba8a4]/60 focus:outline-none focus:border-[#349f2d] transition-colors"
                />
                <input
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2 text-xs text-[#f4efeb] placeholder:text-[#aba8a4]/60 focus:outline-none focus:border-[#349f2d] transition-colors"
                />
              </div>

              {/* Payment method */}
              <div className="grid grid-cols-4 gap-1">
                {PAYMENT_METHODS.map(pm => (
                  <button
                    key={pm.id}
                    onClick={() => setPaymentMethod(pm.id)}
                    className={[
                      'flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-medium transition-all border',
                      paymentMethod === pm.id
                        ? 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40'
                        : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540]',
                    ].join(' ')}
                  >
                    {pm.icon}
                    {pm.label}
                  </button>
                ))}
              </div>

              {/* Total */}
              <div className="flex justify-between items-center bg-[#191c19] rounded-xl px-4 py-3">
                <span className="text-sm text-[#aba8a4]">Total</span>
                <span className="text-xl font-bold text-[#5ecf4f] font-serif">{formatCurrency(total)}</span>
              </div>

              {/* Place order button */}
              <button
                onClick={placeOrder}
                disabled={cart.length === 0 || placing}
                className="w-full bg-[#349f2d] hover:bg-[#287e22] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl py-3.5 font-semibold text-sm transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(52,159,45,0.3)]"
              >
                {placing ? 'Placing Order…' : `Charge ${formatCurrency(total)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
