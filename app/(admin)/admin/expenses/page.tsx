'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { Card, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input, Select, Textarea } from '@/src/components/ui/Input';
import { Badge, PaymentBadge } from '@/src/components/ui/Badge';
import { Modal, ConfirmDialog } from '@/src/components/ui/Modal';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { StatCard } from '@/src/components/ui/StatCard';
import { formatCurrency, formatDate } from '@/src/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  categoryId: z.string().min(1, 'Select a category'),
  description: z.string().min(1, 'Required'),
  amount: z.coerce.number().positive('Must be positive'),
  paymentMethod: z.enum(['CASH', 'MOMO', 'CARD', 'BANK_TRANSFER', 'UNPAID']),
  date: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'MOMO', label: 'Mobile Money' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'UNPAID', label: 'Unpaid/Pending' },
];

export default function ExpensesPage() {
  const [data, setData] = useState<{ expenses: any[]; categories: any[] }>({ expenses: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [addModal, setAddModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string; desc?: string }>({ open: false });
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { paymentMethod: 'CASH', date: format(new Date(), 'yyyy-MM-dd') },
  });

  const fetchData = async () => {
    setLoading(true);
    const monthStr = format(month, 'yyyy-MM');
    const res = await fetch(`/api/admin/expenses?month=${monthStr}`);
    setData(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [month]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      reset({ paymentMethod: 'CASH', date: format(new Date(), 'yyyy-MM-dd') });
      await fetchData();
      setAddModal(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    await fetch(`/api/admin/expenses?id=${deleteDialog.id}`, { method: 'DELETE' });
    await fetchData();
    setDeleteDialog({ open: false });
  };

  const totalExpenses = data.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = data.expenses.reduce((acc: Record<string, number>, e) => {
    const cat = e.category?.name ?? 'Other';
    acc[cat] = (acc[cat] || 0) + Number(e.amount);
    return acc;
  }, {});
  const topCategory = Object.entries(byCategory).sort(([, a], [, b]) => b - a)[0];

  const catOptions = [
    { value: '', label: 'Select category…' },
    ...data.categories.map(c => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Expenses</h1>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => setMonth(subMonths(month, 1))} className="text-[#aba8a4] hover:text-[#f4efeb] p-1 rounded-lg hover:bg-white/5 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-[#aba8a4]">{format(month, 'MMMM yyyy')}</span>
            <button onClick={() => setMonth(addMonths(month, 1))} className="text-[#aba8a4] hover:text-[#f4efeb] p-1 rounded-lg hover:bg-white/5 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setAddModal(true)}>Add Expense</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Expenses" value={formatCurrency(totalExpenses)} icon={<Receipt size={16} className="text-red-400" />} iconBg="bg-red-500/20" />
        <StatCard title="Transactions" value={String(data.expenses.length)} icon={<Receipt size={16} className="text-blue-400" />} iconBg="bg-blue-500/20" />
        <StatCard title="Top Category" value={topCategory?.[0] ?? '—'} subValue={topCategory ? formatCurrency(topCategory[1]) : undefined} icon={<Receipt size={16} className="text-yellow-400" />} iconBg="bg-yellow-500/20" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" /></div>
      ) : data.expenses.length === 0 ? (
        <EmptyState icon={<Receipt size={24} />} title="No expenses this month" description="Start recording your business expenses" action={{ label: 'Add Expense', onClick: () => setAddModal(true) }} />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2b2f2b]">
                  {['Date', 'Description', 'Category', 'Payment', 'Amount', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#aba8a4] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2f2b]">
                {data.expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-[#aba8a4] whitespace-nowrap">{formatDate(exp.date)}</td>
                    <td className="px-4 py-3 font-medium text-[#f4efeb]">{exp.description}</td>
                    <td className="px-4 py-3"><Badge variant="gray">{exp.category?.name}</Badge></td>
                    <td className="px-4 py-3"><PaymentBadge method={exp.paymentMethod} /></td>
                    <td className="px-4 py-3 font-semibold text-red-400">{formatCurrency(exp.amount)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDeleteDialog({ open: true, id: exp.id, desc: exp.description })} className="p-1.5 rounded-lg text-[#aba8a4] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#404540]">
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-[#aba8a4]">Total</td>
                  <td className="px-4 py-3 text-base font-bold text-red-400">{formatCurrency(totalExpenses)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Add modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Expense" size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setAddModal(false)}>Cancel</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={saving}>Add Expense</Button>
        </>}>
        <form className="space-y-4">
          <Select label="Category *" options={catOptions} error={errors.categoryId?.message} {...register('categoryId')} />
          <Input label="Description *" placeholder="What was this expense for?" error={errors.description?.message} {...register('description')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount (GH₵) *" type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
            <Input label="Date" type="date" {...register('date')} />
          </div>
          <Select label="Payment Method" options={PAYMENT_METHODS} {...register('paymentMethod')} />
          <Textarea label="Notes" placeholder="Any additional notes…" {...register('notes')} />
        </form>
      </Modal>

      <ConfirmDialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false })} onConfirm={handleDelete} title="Delete Expense" message={`Delete "${deleteDialog.desc}"? This cannot be undone.`} confirmLabel="Delete" danger />
    </div>
  );
}
