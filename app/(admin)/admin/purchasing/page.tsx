'use client';

import { useEffect, useState } from 'react';
import { Plus, X, Save, Package, ChevronDown, ChevronRight, CheckCircle2, Clock, Truck, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/src/lib/utils';

interface InventoryItem { id: string; name: string; unit: string; purchaseUnit?: string; conversionFactor: number }
interface Supplier { id: string; name: string }
interface PoLine {
  id: string;
  inventoryItemId: string;
  inventoryItem: { id: string; name: string; unit: string; purchaseUnit?: string; conversionFactor: number };
  orderedQty: number;
  receivedQty: number;
  purchaseUnit: string;
  unitPrice: number;
}
interface PO {
  id: string;
  poNumber: string;
  status: 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'RECEIVED';
  expectedDate?: string;
  totalAmount?: number;
  notes?: string;
  supplier: { id: string; name: string };
  createdBy: { name: string };
  createdAt: string;
  lines: PoLine[];
  receipts: { id: string; receivedAt: string }[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT:              { label: 'Draft',             color: 'text-[#aba8a4] bg-[#aba8a4]/10 border-[#aba8a4]/20',      icon: <Clock size={11}/> },
  CONFIRMED:          { label: 'Confirmed',         color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',          icon: <CheckCircle2 size={11}/> },
  PARTIALLY_RECEIVED: { label: 'Part. Received',   color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',    icon: <Truck size={11}/> },
  RECEIVED:           { label: 'Fully Received',   color: 'text-[#5ecf4f] bg-[#349f2d]/10 border-[#349f2d]/20',       icon: <CheckCircle2 size={11}/> },
};

const emptyPoLine = () => ({ inventoryItemId: '', orderedQty: '', purchaseUnit: '', unitPrice: '' });

export default function PurchasingPage() {
  const [pos, setPos] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Create PO form
  const [formOpen, setFormOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poLines, setPoLines] = useState([emptyPoLine()]);
  const [saving, setSaving] = useState(false);

  // Receive modal
  const [receivePoId, setReceivePoId] = useState<string | null>(null);
  const [receivePo, setReceivePo] = useState<PO | null>(null);
  const [receiveLines, setReceiveLines] = useState<{ poLineId: string; qtyReceived: string }[]>([]);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receiving, setReceiving] = useState(false);

  const fetchAll = async () => {
    const [posRes, supRes, invRes] = await Promise.all([
      fetch('/api/admin/purchasing'),
      fetch('/api/admin/suppliers'),
      fetch('/api/admin/inventory'),
    ]);
    const [posData, supData, invData] = await Promise.all([posRes.json(), supRes.json(), invRes.json()]);
    setPos(posData);
    setSuppliers(supData);
    setInventory(invData?.items ?? invData ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Confirm a draft PO
  const confirmPO = async (id: string) => {
    await fetch(`/api/admin/purchasing/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CONFIRMED' }) });
    await fetchAll();
  };

  // Open receive modal
  const openReceive = (po: PO) => {
    setReceivePo(po);
    setReceivePoId(po.id);
    setReceiveLines(po.lines.filter(l => Number(l.receivedQty) < Number(l.orderedQty)).map(l => ({ poLineId: l.id, qtyReceived: '' })));
    setReceiveNotes('');
  };

  const submitReceive = async () => {
    if (!receivePoId) return;
    setReceiving(true);
    try {
      const validLines = receiveLines.filter(l => parseFloat(l.qtyReceived) > 0);
      if (validLines.length === 0) { alert('Enter at least one received quantity.'); return; }
      const res = await fetch(`/api/admin/purchasing/${receivePoId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: receiveNotes, lines: validLines.map(l => ({ poLineId: l.poLineId, qtyReceived: parseFloat(l.qtyReceived) })) }),
      });
      if (res.ok) { setReceivePoId(null); setReceivePo(null); await fetchAll(); }
    } finally { setReceiving(false); }
  };

  // Create PO
  const addPoLine = () => setPoLines(prev => [...prev, emptyPoLine()]);
  const removePoLine = (i: number) => setPoLines(prev => prev.filter((_, idx) => idx !== i));
  const updatePoLine = (i: number, field: string, value: string) => {
    setPoLines(prev => {
      const next = [...prev];
      (next[i] as any)[field] = value;
      if (field === 'inventoryItemId') {
        const inv = inventory.find(it => it.id === value);
        if (inv && inv.purchaseUnit) next[i].purchaseUnit = inv.purchaseUnit;
      }
      return next;
    });
  };

  const createPO = async () => {
    if (!supplierId || poLines.some(l => !l.inventoryItemId || !l.orderedQty || !l.purchaseUnit || !l.unitPrice)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/purchasing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          expectedDate: expectedDate || undefined,
          notes: poNotes || undefined,
          lines: poLines.map(l => ({ inventoryItemId: l.inventoryItemId, orderedQty: parseFloat(l.orderedQty), purchaseUnit: l.purchaseUnit, unitPrice: parseFloat(l.unitPrice) })),
        }),
      });
      if (res.ok) { setFormOpen(false); setSupplierId(''); setExpectedDate(''); setPoNotes(''); setPoLines([emptyPoLine()]); await fetchAll(); }
    } finally { setSaving(false); }
  };

  const filtered = statusFilter ? pos.filter(p => p.status === statusFilter) : pos;

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-96">
      <div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Purchasing</h1>
          <p className="text-sm text-[#aba8a4] mt-0.5">Create purchase orders and receive deliveries</p>
        </div>
        <button onClick={() => setFormOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[#349f2d] hover:bg-[#287e22] text-white rounded-xl text-sm font-semibold transition-colors">
          <Plus size={15} /> New Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(['', 'DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED'] as const).map((s, i) => {
          const count = s ? pos.filter(p => p.status === s).length : pos.length;
          const labels = ['All Orders', 'Drafts', 'Confirmed', 'Pending Receipt'];
          return (
            <button key={i} onClick={() => setStatusFilter(s)}
              className={`bg-[#191c19] border rounded-2xl p-4 text-left transition-all ${statusFilter === s ? 'border-[#349f2d]/50' : 'border-[#2b2f2b] hover:border-[#404540]'}`}>
              <p className="text-xs text-[#aba8a4]">{labels[i]}</p>
              <p className="text-2xl font-bold text-[#f4efeb] mt-1">{count}</p>
            </button>
          );
        })}
      </div>

      {/* PO list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-[#191c19] border border-[#2b2f2b] rounded-2xl">
            <Package size={32} className="text-[#2b2f2b] mx-auto mb-3" />
            <p className="text-sm text-[#aba8a4]">No purchase orders yet.</p>
          </div>
        ) : filtered.map(po => {
          const sc = STATUS_CONFIG[po.status];
          return (
            <div key={po.id} className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpanded(expanded === po.id ? null : po.id)}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#191c19] border border-[#2b2f2b] flex items-center justify-center shrink-0">
                    <Package size={14} className="text-[#aba8a4]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#f4efeb]">{po.poNumber}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#aba8a4] mt-0.5">{po.supplier.name} · {po.lines.length} item{po.lines.length !== 1 ? 's' : ''} · {formatDate(po.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {po.totalAmount && <span className="text-sm font-bold text-[#5ecf4f]">{formatCurrency(po.totalAmount)}</span>}
                  {po.status === 'DRAFT' && (
                    <button onClick={e => { e.stopPropagation(); confirmPO(po.id); }}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors">
                      Confirm
                    </button>
                  )}
                  {(po.status === 'CONFIRMED' || po.status === 'PARTIALLY_RECEIVED') && (
                    <button onClick={e => { e.stopPropagation(); openReceive(po); }}
                      className="px-3 py-1.5 rounded-lg bg-[#349f2d]/10 border border-[#349f2d]/30 text-[#5ecf4f] text-xs font-medium hover:bg-[#349f2d]/20 transition-colors">
                      Receive
                    </button>
                  )}
                  {expanded === po.id ? <ChevronDown size={15} className="text-[#aba8a4]" /> : <ChevronRight size={15} className="text-[#aba8a4]" />}
                </div>
              </div>

              {expanded === po.id && (
                <div className="px-5 pb-4 border-t border-[#2b2f2b] pt-3 space-y-1.5">
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-medium text-[#aba8a4] mb-1 px-1">
                    <span>Ingredient</span><span className="text-center">Ordered</span><span className="text-center">Received</span>
                  </div>
                  {po.lines.map(line => (
                    <div key={line.id} className="grid grid-cols-3 gap-2 text-sm items-center">
                      <span className="text-[#f4efeb]">{line.inventoryItem.name}</span>
                      <span className="text-center text-[#aba8a4]">{Number(line.orderedQty)} {line.purchaseUnit}</span>
                      <span className={`text-center font-medium ${Number(line.receivedQty) >= Number(line.orderedQty) ? 'text-[#5ecf4f]' : Number(line.receivedQty) > 0 ? 'text-yellow-400' : 'text-[#aba8a4]'}`}>
                        {Number(line.receivedQty)} {line.purchaseUnit}
                      </span>
                    </div>
                  ))}
                  {po.expectedDate && <p className="text-xs text-[#aba8a4] pt-2 border-t border-[#2b2f2b]">Expected: {formatDate(po.expectedDate)}</p>}
                  {po.notes && <p className="text-xs text-[#aba8a4]">Note: {po.notes}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create PO Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#191c19] border border-[#2b2f2b] rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b2f2b] shrink-0">
              <h2 className="text-base font-bold text-[#f4efeb]">New Purchase Order</h2>
              <button onClick={() => setFormOpen(false)}><X size={18} className="text-[#aba8a4]" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#aba8a4] mb-1.5">Supplier</label>
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                  className="w-full bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] focus:outline-none focus:border-[#349f2d]">
                  <option value="">Select supplier…</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#aba8a4] mb-1.5">Expected Date</label>
                  <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                    className="w-full bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] focus:outline-none focus:border-[#349f2d]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#aba8a4] mb-1.5">Notes</label>
                  <input value={poNotes} onChange={e => setPoNotes(e.target.value)} placeholder="Optional"
                    className="w-full bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] focus:outline-none focus:border-[#349f2d]" />
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[#aba8a4]">Order Lines</label>
                  <button onClick={addPoLine} className="text-xs text-[#5ecf4f] flex items-center gap-1"><Plus size={12}/> Add</button>
                </div>
                <div className="space-y-2">
                  {poLines.map((line, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                      <select value={line.inventoryItemId} onChange={e => updatePoLine(i, 'inventoryItemId', e.target.value)}
                        className="col-span-5 bg-[#111311] border border-[#2b2f2b] rounded-xl px-2 py-2 text-xs text-[#f4efeb] focus:outline-none focus:border-[#349f2d]">
                        <option value="">Ingredient…</option>
                        {inventory.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                      </select>
                      <input value={line.orderedQty} onChange={e => updatePoLine(i, 'orderedQty', e.target.value)}
                        placeholder="Qty" type="number" min="0"
                        className="col-span-2 bg-[#111311] border border-[#2b2f2b] rounded-xl px-2 py-2 text-xs text-[#f4efeb] focus:outline-none focus:border-[#349f2d]" />
                      <input value={line.purchaseUnit} onChange={e => updatePoLine(i, 'purchaseUnit', e.target.value)}
                        placeholder="Unit" className="col-span-2 bg-[#111311] border border-[#2b2f2b] rounded-xl px-2 py-2 text-xs text-[#f4efeb] focus:outline-none focus:border-[#349f2d]" />
                      <input value={line.unitPrice} onChange={e => updatePoLine(i, 'unitPrice', e.target.value)}
                        placeholder="Price" type="number" min="0"
                        className="col-span-2 bg-[#111311] border border-[#2b2f2b] rounded-xl px-2 py-2 text-xs text-[#f4efeb] focus:outline-none focus:border-[#349f2d]" />
                      <button onClick={() => removePoLine(i)} disabled={poLines.length === 1} className="col-span-1 flex justify-center text-[#aba8a4] hover:text-red-400 disabled:opacity-30">
                        <X size={13}/>
                      </button>
                    </div>
                  ))}
                </div>
                {poLines.length > 0 && (
                  <p className="text-xs text-[#aba8a4] mt-2 text-right">
                    Total: {formatCurrency(poLines.reduce((s, l) => s + (parseFloat(l.orderedQty) || 0) * (parseFloat(l.unitPrice) || 0), 0))}
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#2b2f2b] flex gap-3 shrink-0">
              <button onClick={() => setFormOpen(false)} className="flex-1 py-2.5 rounded-xl border border-[#2b2f2b] text-[#aba8a4] text-sm">Cancel</button>
              <button onClick={createPO} disabled={saving || !supplierId}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#349f2d] hover:bg-[#287e22] disabled:opacity-40 text-white text-sm font-semibold">
                <Save size={14}/> {saving ? 'Creating…' : 'Create PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {receivePoId && receivePo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#191c19] border border-[#2b2f2b] rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b2f2b] shrink-0">
              <div>
                <h2 className="text-base font-bold text-[#f4efeb]">Receive Delivery</h2>
                <p className="text-xs text-[#aba8a4]">{receivePo.poNumber} · {receivePo.supplier.name}</p>
              </div>
              <button onClick={() => { setReceivePoId(null); setReceivePo(null); }}><X size={18} className="text-[#aba8a4]" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <div className="bg-[#111311] rounded-xl p-3 space-y-1">
                <p className="text-xs font-medium text-[#aba8a4]">Enter quantities received (in purchase units)</p>
                {receivePo.lines.filter(l => Number(l.receivedQty) < Number(l.orderedQty)).map(line => {
                  const rl = receiveLines.find(r => r.poLineId === line.id);
                  const remaining = Number(line.orderedQty) - Number(line.receivedQty);
                  const inv = inventory.find(i => i.id === line.inventoryItemId);
                  const cf = inv?.conversionFactor ?? 1;
                  const received = parseFloat(rl?.qtyReceived ?? '0') || 0;
                  return (
                    <div key={line.id} className="pt-3 border-t border-[#2b2f2b] first:border-0 first:pt-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[#f4efeb]">{line.inventoryItem.name}</span>
                        <span className="text-xs text-[#aba8a4]">Remaining: {remaining} {line.purchaseUnit}</span>
                      </div>
                      <input type="number" min="0" max={remaining} value={rl?.qtyReceived ?? ''}
                        onChange={e => setReceiveLines(prev => prev.map(r => r.poLineId === line.id ? { ...r, qtyReceived: e.target.value } : r))}
                        placeholder={`Max ${remaining} ${line.purchaseUnit}`}
                        className="w-full bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2 text-sm text-[#f4efeb] focus:outline-none focus:border-[#349f2d]" />
                      {received > 0 && cf > 1 && (
                        <p className="text-xs text-[#5ecf4f] mt-1">→ Adds {received * cf} {line.inventoryItem.unit} to stock</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div>
                <label className="block text-xs font-medium text-[#aba8a4] mb-1.5">Notes</label>
                <input value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)} placeholder="Delivery notes…"
                  className="w-full bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] focus:outline-none focus:border-[#349f2d]" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#2b2f2b] flex gap-3 shrink-0">
              <button onClick={() => { setReceivePoId(null); setReceivePo(null); }} className="flex-1 py-2.5 rounded-xl border border-[#2b2f2b] text-[#aba8a4] text-sm">Cancel</button>
              <button onClick={submitReceive} disabled={receiving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#349f2d] hover:bg-[#287e22] disabled:opacity-40 text-white text-sm font-semibold">
                <Truck size={14}/> {receiving ? 'Receiving…' : 'Confirm Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
