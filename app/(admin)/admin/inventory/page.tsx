'use client';

import { useEffect, useState } from 'react';
import { Plus, AlertTriangle, Package, ArrowUp, ArrowDown, History, X } from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input, Select, Textarea } from '@/src/components/ui/Input';
import { Badge } from '@/src/components/ui/Badge';
import { Modal } from '@/src/components/ui/Modal';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { formatCurrency, formatDateTime } from '@/src/lib/utils';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const itemSchema = z.object({
  name: z.string().min(1, 'Required'),
  unit: z.string().min(1, 'Required'),
  purchaseUnit: z.string().optional(),
  conversionFactor: z.coerce.number().min(0.001).default(1),
  quantity: z.coerce.number().min(0),
  lowStockThreshold: z.coerce.number().min(0),
  costPerUnit: z.coerce.number().optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});
const txSchema = z.object({
  type: z.enum(['PURCHASE', 'USAGE', 'ADJUSTMENT', 'WASTE']),
  quantity: z.coerce.number().positive('Must be positive'),
  notes: z.string().optional(),
});
type ItemForm = z.infer<typeof itemSchema>;
type TxForm = z.infer<typeof txSchema>;

const TX_TYPES = [
  { value: 'PURCHASE', label: 'Purchase (add stock)' },
  { value: 'USAGE', label: 'Usage (deduct)' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'WASTE', label: 'Waste / Spoilage' },
];

const TX_TYPE_CONFIG: Record<string, { color: string; sign: string }> = {
  PURCHASE:   { color: 'text-[#5ecf4f]', sign: '+' },
  USAGE:      { color: 'text-red-400',   sign: '-' },
  ADJUSTMENT: { color: 'text-blue-400',  sign: '±' },
  WASTE:      { color: 'text-yellow-400', sign: '-' },
};

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemModal, setItemModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [txModal, setTxModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [historyItem, setHistoryItem] = useState<any | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [filterLow, setFilterLow] = useState(false);

  const { register: regItem, handleSubmit: subItem, reset: resetItem, formState: { errors: errItem } } = useForm<ItemForm>({ resolver: zodResolver(itemSchema) });
  const { register: regTx, handleSubmit: subTx, reset: resetTx, formState: { errors: errTx } } = useForm<TxForm>({ resolver: zodResolver(txSchema) });

  const fetch_ = async () => {
    const res = await fetch('/api/admin/inventory');
    const data = await res.json();
    setItems(data?.items ?? data ?? []);
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, []);

  const openItem = (item?: any) => {
    resetItem(item
      ? { ...item, conversionFactor: Number(item.conversionFactor ?? 1) }
      : { quantity: 0, lowStockThreshold: 5, conversionFactor: 1 });
    setItemModal({ open: true, item });
  };

  const saveItem = async (values: ItemForm) => {
    setSaving(true);
    try {
      await fetch('/api/admin/inventory', {
        method: itemModal.item ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemModal.item ? { id: itemModal.item.id, ...values } : values),
      });
      await fetch_();
      setItemModal({ open: false });
    } finally { setSaving(false); }
  };

  const saveTx = async (values: TxForm) => {
    setSaving(true);
    try {
      await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: txModal.item.id, ...values }),
      });
      await fetch_();
      setTxModal({ open: false });
      resetTx();
    } finally { setSaving(false); }
  };

  const openHistory = async (item: any) => {
    setHistoryItem(item);
    const res = await fetch(`/api/admin/inventory?id=${item.id}&transactions=1`);
    if (res.ok) {
      const data = await res.json();
      setHistoryData(data.transactions ?? []);
    }
  };

  const displayed = items
    .filter(i => !filterLow || Number(i.quantity) <= Number(i.lowStockThreshold))
    .filter(i => !searchQ || i.name.toLowerCase().includes(searchQ.toLowerCase()));

  const lowStockCount = items.filter(i => Number(i.quantity) <= Number(i.lowStockThreshold)).length;
  const totalStockValue = items.reduce((s, i) => s + Number(i.quantity) * Number(i.costPerUnit ?? 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Inventory</h1>
          <p className="text-sm text-[#aba8a4] mt-0.5">
            {items.length} items · {formatCurrency(totalStockValue)} stock value
            {lowStockCount > 0 && <> · <span className="text-yellow-400">{lowStockCount} low stock</span></>}
          </p>
        </div>
        <Button size="sm" icon={<Plus size={14}/>} onClick={() => openItem()}>Add Item</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search items…"
          className="bg-[#191c19] border border-[#2b2f2b] rounded-xl px-3 py-2 text-sm text-[#f4efeb] placeholder:text-[#aba8a4]/60 focus:outline-none focus:border-[#349f2d] w-56"/>
        <button onClick={() => setFilterLow(!filterLow)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${filterLow ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30' : 'text-[#aba8a4] border-[#2b2f2b] hover:border-[#404540]'}`}>
          <AlertTriangle size={12}/> Low Stock Only
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin"/></div>
      ) : displayed.length === 0 ? (
        <EmptyState icon={<Package size={24}/>} title="No inventory items" description="Start tracking your stock levels" action={{ label: 'Add Item', onClick: () => openItem() }}/>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2b2f2b]">
                  {['Item', 'On Hand', 'Inv. Unit', 'Purchase Unit', 'Reorder At', 'Cost/Unit', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#aba8a4] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2f2b]">
                {displayed.map(item => {
                  const qty = Number(item.quantity);
                  const threshold = Number(item.lowStockThreshold);
                  const isLow = qty <= threshold;
                  const cf = Number(item.conversionFactor ?? 1);
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-medium text-[#f4efeb]">{item.name}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${isLow ? 'text-yellow-400' : 'text-[#f4efeb]'}`}>
                          {qty % 1 === 0 ? qty : qty.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#aba8a4]">{item.unit}</td>
                      <td className="px-4 py-3 text-[#aba8a4] text-xs">
                        {item.purchaseUnit ? (
                          <span>1 {item.purchaseUnit} = {cf} {item.unit}</span>
                        ) : <span className="opacity-40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[#aba8a4]">{threshold} {item.unit}</td>
                      <td className="px-4 py-3 text-[#aba8a4]">{item.costPerUnit ? formatCurrency(item.costPerUnit) : '—'}</td>
                      <td className="px-4 py-3">
                        {isLow ? <Badge variant="yellow" dot>Low</Badge> : <Badge variant="green" dot>OK</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="xs" icon={<ArrowUp size={11}/>}
                            onClick={() => { resetTx({ type: 'PURCHASE', quantity: 0 as any }); setTxModal({ open: true, item }); }}>In</Button>
                          <Button variant="ghost" size="xs" icon={<ArrowDown size={11}/>}
                            onClick={() => { resetTx({ type: 'WASTE', quantity: 0 as any }); setTxModal({ open: true, item }); }}>Out</Button>
                          <Button variant="ghost" size="xs" icon={<History size={11}/>} onClick={() => openHistory(item)}/>
                          <Button variant="ghost" size="xs" onClick={() => openItem(item)}>Edit</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit item modal */}
      <Modal open={itemModal.open} onClose={() => setItemModal({ open: false })}
        title={itemModal.item ? 'Edit Item' : 'Add Inventory Item'} size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setItemModal({ open: false })}>Cancel</Button>
          <Button onClick={subItem(saveItem)} loading={saving}>{itemModal.item ? 'Save' : 'Add'}</Button>
        </>}>
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Item name *" placeholder="e.g. Rice" error={errItem.name?.message} {...regItem('name')}/>
            <Input label="Inventory Unit *" placeholder="kg, litres, pieces…" error={errItem.unit?.message} {...regItem('unit')}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Purchase Unit" placeholder="e.g. bag, crate, box" {...regItem('purchaseUnit')}/>
            <Input label="Conversion Factor" type="number" step="0.001" placeholder="e.g. 50 (1 bag = 50 kg)" {...regItem('conversionFactor')}/>
          </div>
          <div className="text-xs text-[#aba8a4] -mt-2">
            e.g. 1 bag = 50 kg → enter "bag" as Purchase Unit and "50" as Conversion Factor
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Current Qty" type="number" step="0.01" {...regItem('quantity')}/>
            <Input label="Low Stock Alert At" type="number" step="0.01" {...regItem('lowStockThreshold')}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cost per Inv. Unit (GH₵)" type="number" step="0.01" {...regItem('costPerUnit')}/>
            <Input label="Supplier" placeholder="Supplier name" {...regItem('supplier')}/>
          </div>
          <Textarea label="Notes" {...regItem('notes')}/>
        </form>
      </Modal>

      {/* Transaction modal */}
      <Modal open={txModal.open} onClose={() => setTxModal({ open: false })}
        title={`Update Stock — ${txModal.item?.name}`} size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setTxModal({ open: false })}>Cancel</Button>
          <Button onClick={subTx(saveTx)} loading={saving}>Record</Button>
        </>}>
        <form className="space-y-4">
          <Select label="Transaction type" options={TX_TYPES} {...regTx('type')}/>
          <Input label={`Quantity (${txModal.item?.unit ?? 'units'}) *`} type="number" step="0.01"
            placeholder="0" error={errTx.quantity?.message} {...regTx('quantity')}/>
          <Textarea label="Notes / Reason" placeholder="e.g. Spoiled goods, counted stock…" {...regTx('notes')}/>
        </form>
      </Modal>

      {/* History panel */}
      {historyItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#191c19] border border-[#2b2f2b] rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b2f2b] shrink-0">
              <div>
                <h2 className="text-base font-bold text-[#f4efeb]">{historyItem.name}</h2>
                <p className="text-xs text-[#aba8a4]">Stock movement history · On hand: {Number(historyItem.quantity).toFixed(2)} {historyItem.unit}</p>
              </div>
              <button onClick={() => { setHistoryItem(null); setHistoryData([]); }} className="text-[#aba8a4] hover:text-[#f4efeb]">
                <X size={18}/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
              {historyData.length === 0 ? (
                <p className="text-center text-sm text-[#aba8a4] py-8">No movements recorded yet</p>
              ) : historyData.map((tx: any) => {
                const cfg = TX_TYPE_CONFIG[tx.type] ?? { color: 'text-[#f4efeb]', sign: '' };
                return (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-[#2b2f2b] last:border-0">
                    <div>
                      <p className="text-xs font-medium text-[#f4efeb]">{tx.type}</p>
                      {tx.notes && <p className="text-[10px] text-[#aba8a4]">{tx.notes}</p>}
                      <p className="text-[10px] text-[#aba8a4]">{formatDateTime(tx.createdAt)}</p>
                    </div>
                    <span className={`text-sm font-bold ${cfg.color}`}>
                      {cfg.sign}{Number(tx.quantity).toFixed(2)} {historyItem.unit}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-3 border-t border-[#2b2f2b] shrink-0">
              <button
                onClick={() => { resetTx({ type: 'ADJUSTMENT', quantity: 0 as any }); setTxModal({ open: true, item: historyItem }); setHistoryItem(null); }}
                className="w-full py-2.5 rounded-xl bg-[#349f2d]/10 border border-[#349f2d]/30 text-[#5ecf4f] text-sm font-medium hover:bg-[#349f2d]/20 transition-colors">
                Add Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
