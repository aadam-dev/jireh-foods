'use client';

import { useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, CheckCircle, DollarSign } from 'lucide-react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input, Select, Textarea } from '@/src/components/ui/Input';
import { Badge } from '@/src/components/ui/Badge';
import { Modal, ConfirmDialog } from '@/src/components/ui/Modal';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { StatCard } from '@/src/components/ui/StatCard';
import { formatCurrency } from '@/src/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  userId: z.string().min(1, 'Select staff member'),
  baseSalary: z.coerce.number().min(0),
  bonus: z.coerce.number().min(0).default(0),
  deductions: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'text-[#aba8a4] bg-white/5 border-white/10',
  APPROVED: 'text-blue-400 bg-blue-500/20 border-blue-500/40',
  PAID: 'text-[#5ecf4f] bg-[#349f2d]/20 border-[#349f2d]/40',
};

export default function PayrollPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [addModal, setAddModal] = useState(false);
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; record?: any; action?: string }>({ open: false });
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { bonus: 0, deductions: 0 },
  });

  const baseSalary = watch('baseSalary') || 0;
  const bonus = watch('bonus') || 0;
  const deductions = watch('deductions') || 0;
  const netPay = Number(baseSalary) + Number(bonus) - Number(deductions);

  const fetchData = async () => {
    setLoading(true);
    const monthStr = format(month, 'yyyy-MM');
    const [payRes, staffRes] = await Promise.all([
      fetch(`/api/admin/payroll?month=${monthStr}`),
      fetch('/api/admin/staff'),
    ]);
    setRecords(await payRes.json());
    const staffData = await staffRes.json();
    setStaff(staffData.filter((s: any) => s.isActive));
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, [month]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      await fetch('/api/admin/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
        }),
      });
      await fetchData();
      setAddModal(false);
      reset({ bonus: 0, deductions: 0 });
    } finally { setSaving(false); }
  };

  const updateStatus = async () => {
    if (!approveDialog.record) return;
    setSaving(true);
    try {
      await fetch('/api/admin/payroll', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: approveDialog.record.id, status: approveDialog.action }),
      });
      await fetchData();
      setApproveDialog({ open: false });
    } finally { setSaving(false); }
  };

  const totalNetPay = records.reduce((s, r) => s + Number(r.netPay), 0);
  const paidTotal = records.filter(r => r.status === 'PAID').reduce((s, r) => s + Number(r.netPay), 0);

  const staffOptions = [{ value: '', label: 'Select staff member…' }, ...staff.map(s => ({ value: s.id, label: `${s.name} (${s.role})` }))];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Payroll</h1>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => setMonth(subMonths(month, 1))} className="text-[#aba8a4] hover:text-[#f4efeb] p-1 rounded-lg hover:bg-white/5">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-[#aba8a4]">{format(month, 'MMMM yyyy')}</span>
            <button onClick={() => setMonth(addMonths(month, 1))} className="text-[#aba8a4] hover:text-[#f4efeb] p-1 rounded-lg hover:bg-white/5">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setAddModal(true)}>Add Record</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Total Payroll" value={formatCurrency(totalNetPay)} icon={<DollarSign size={16} className="text-[#5ecf4f]" />} />
        <StatCard title="Paid Out" value={formatCurrency(paidTotal)} icon={<CheckCircle size={16} className="text-blue-400" />} iconBg="bg-blue-500/20" />
        <StatCard title="Records" value={String(records.length)} icon={<DollarSign size={16} className="text-yellow-400" />} iconBg="bg-yellow-500/20" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" /></div>
      ) : records.length === 0 ? (
        <EmptyState icon={<DollarSign size={24} />} title="No payroll records" description="Add payroll records for this month" action={{ label: 'Add Record', onClick: () => setAddModal(true) }} />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2b2f2b]">
                  {['Staff', 'Base Salary', 'Bonus', 'Deductions', 'Net Pay', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#aba8a4] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2f2b]">
                {records.map(record => (
                  <tr key={record.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#f4efeb]">{record.user?.name}</p>
                      <p className="text-xs text-[#aba8a4]">{record.user?.role}</p>
                    </td>
                    <td className="px-4 py-3 text-[#f4efeb]">{formatCurrency(record.baseSalary)}</td>
                    <td className="px-4 py-3 text-[#5ecf4f]">{formatCurrency(record.bonus)}</td>
                    <td className="px-4 py-3 text-red-400">{formatCurrency(record.deductions)}</td>
                    <td className="px-4 py-3 font-bold text-[#f4efeb]">{formatCurrency(record.netPay)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full border ${STATUS_STYLES[record.status]}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {record.status === 'DRAFT' && (
                          <Button variant="secondary" size="xs" onClick={() => setApproveDialog({ open: true, record, action: 'APPROVED' })}>Approve</Button>
                        )}
                        {record.status === 'APPROVED' && (
                          <Button variant="success" size="xs" onClick={() => setApproveDialog({ open: true, record, action: 'PAID' })}>Mark Paid</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Payroll Record" size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setAddModal(false)}>Cancel</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={saving}>Create Record</Button>
        </>}>
        <div className="space-y-4">
          <Select label="Staff Member *" options={staffOptions} error={errors.userId?.message} {...register('userId')} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Base Salary (GH₵)" type="number" step="0.01" {...register('baseSalary')} />
            <Input label="Bonus (GH₵)" type="number" step="0.01" {...register('bonus')} />
            <Input label="Deductions (GH₵)" type="number" step="0.01" {...register('deductions')} />
          </div>
          <div className="bg-[#111311] border border-[#349f2d]/30 rounded-xl px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-[#aba8a4]">Net Pay</span>
            <span className="text-lg font-bold text-[#5ecf4f]">{formatCurrency(Math.max(0, netPay))}</span>
          </div>
          <Textarea label="Notes" {...register('notes')} />
        </div>
      </Modal>

      <ConfirmDialog
        open={approveDialog.open}
        onClose={() => setApproveDialog({ open: false })}
        onConfirm={updateStatus}
        title={approveDialog.action === 'APPROVED' ? 'Approve Payroll' : 'Mark as Paid'}
        message={`${approveDialog.action === 'APPROVED' ? 'Approve' : 'Mark as paid'} ${approveDialog.record?.user?.name}'s payroll of ${formatCurrency(approveDialog.record?.netPay)}?`}
        confirmLabel={approveDialog.action === 'APPROVED' ? 'Approve' : 'Mark Paid'}
        loading={saving}
      />
    </div>
  );
}
