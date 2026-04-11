'use client';

import { useEffect, useState } from 'react';
import { Plus, AlertTriangle, Package, ArrowUp, ArrowDown } from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input, Select, Textarea } from '@/src/components/ui/Input';
import { Badge } from '@/src/components/ui/Badge';
import { Modal } from '@/src/components/ui/Modal';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { formatDateTime } from '@/src/lib/utils';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const itemSchema = z.object({
  name: z.string().min(1, 'Required'),
  unit: z.string().min(1, 'Required'),
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
  { value: 'WASTE', label: 'Waste' },
];

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemModal, setItemModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [txModal, setTxModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [saving, setSaving] = useState(false);

  const { register: regItem, handleSubmit: subItem, reset: resetItem, formState: { errors: errItem } } = useForm<ItemForm>({ resolver: zodResolver(itemSchema) });
  const { register: regTx, handleSubmit: subTx, reset: resetTx, formState: { errors: errTx } } = useForm<TxForm>({ resolver: zodResolver(txSchema) });

  const fetch_ = async () => {
    const res = await fetch('/api/admin/inventory');
    setItems(await res.json());
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, []);

  const openItem = (item?: any) => {
    resetItem(item ?? { quantity: 0, lowStockThreshold: 5 });
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
        body: JSON.stringify({ type: 'transaction', itemId: txModal.item.id, ...values }),
      });
      await fetch_();
      setTxModal({ open: false });
      resetTx();
    } finally { setSaving(false); }
  };

  const lowStockCount = items.filter(i => Number(i.quantity) <= Number(i.lowStockThreshold)).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Inventory</h1>
          <p className="text-sm text-[#aba8a4]">
            {items.length} items · {lowStockCount > 0 && <span className="text-yellow-400">{lowStockCount} low stock</span>}
          </p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => openItem()}>Add Item</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Package size={24} />} title="No inventory items" description="Start tracking your stock levels" action={{ label: 'Add Item', onClick: () => openItem() }} />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2b2f2b]">
                  {['Item', 'Qty', 'Unit', 'Low Stock At', 'Status', 'Supplier', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#aba8a4] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2f2b]">
                {items.map(item => {
                  const qty = Number(item.quantity);
                  const threshold = Number(item.lowStockThreshold);
                  const isLow = qty <= threshold;
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-medium text-[#f4efeb]">{item.name}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${isLow ? 'text-yellow-400' : 'text-[#f4efeb]'}`}>
                          {qty.toFixed(isLow ? 2 : 1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#aba8a4]">{item.unit}</td>
                      <td className="px-4 py-3 text-[#aba8a4]">{threshold}</td>
                      <td className="px-4 py-3">
                        {isLow
                          ? <Badge variant="yellow" dot>Low Stock</Badge>
                          : <Badge variant="green" dot>OK</Badge>}
                      </td>
                      <td className="px-4 py-3 text-[#aba8a4]">{item.supplier || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="xs" icon={<ArrowUp size={12} />} onClick={() => { resetTx({ type: 'PURCHASE', quantity: 0 as any }); setTxModal({ open: true, item }); }}>Stock In</Button>
                          <Button variant="ghost" size="xs" icon={<ArrowDown size={12} />} onClick={() => { resetTx({ type: 'USAGE', quantity: 0 as any }); setTxModal({ open: true, item }); }}>Use</Button>
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
      <Modal open={itemModal.open} onClose={() => setItemModal({ open: false })} title={itemModal.item ? 'Edit Item' : 'Add Inventory Item'} size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setItemModal({ open: false })}>Cancel</Button>
          <Button onClick={subItem(saveItem)} loading={saving}>{itemModal.item ? 'Save' : 'Add'}</Button>
        </>}>
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Item name *" placeholder="e.g. Rice" error={errItem.name?.message} {...regItem('name')} />
            <Input label="Unit *" placeholder="kg, litres, pieces…" error={errItem.unit?.message} {...regItem('unit')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Current Qty" type="number" step="0.01" {...regItem('quantity')} />
            <Input label="Low Stock Alert At" type="number" step="0.01" {...regItem('lowStockThreshold')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cost per Unit (GH₵)" type="number" step="0.01" {...regItem('costPerUnit')} />
            <Input label="Supplier" placeholder="Supplier name" {...regItem('supplier')} />
          </div>
          <Textarea label="Notes" {...regItem('notes')} />
        </form>
      </Modal>

      {/* Transaction modal */}
      <Modal open={txModal.open} onClose={() => setTxModal({ open: false })} title={`Update Stock — ${txModal.item?.name}`} size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setTxModal({ open: false })}>Cancel</Button>
          <Button onClick={subTx(saveTx)} loading={saving}>Record</Button>
        </>}>
        <form className="space-y-4">
          <Select label="Transaction type" options={TX_TYPES} {...regTx('type')} />
          <Input label="Quantity *" type="number" step="0.01" placeholder="0" error={errTx.quantity?.message} {...regTx('quantity')} />
          <Textarea label="Notes (optional)" placeholder="Reason or reference…" {...regTx('notes')} />
        </form>
      </Modal>
    </div>
  );
}
