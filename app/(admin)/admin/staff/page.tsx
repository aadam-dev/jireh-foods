'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, UserX, UserCheck, KeyRound, Users } from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input, Select } from '@/src/components/ui/Input';
import { Badge } from '@/src/components/ui/Badge';
import { Modal, ConfirmDialog } from '@/src/components/ui/Modal';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/src/lib/utils';
import { ROLE_LABELS, ROLE_COLORS } from '@/src/lib/permissions';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Min 6 characters'),
  role: z.enum(['OWNER', 'MANAGER', 'ACCOUNTANT', 'CASHIER', 'STAFF']),
  phone: z.string().optional(),
  hireDate: z.string().optional(),
  salaryType: z.enum(['MONTHLY', 'DAILY', 'HOURLY']),
  salary: z.coerce.number().min(0),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
});

const editSchema = createSchema.omit({ password: true }).extend({
  newPassword: z.string().min(6).optional().or(z.literal('')),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;

const ROLES = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'ACCOUNTANT', label: 'Accountant' },
  { value: 'CASHIER', label: 'Cashier' },
  { value: 'STAFF', label: 'Staff' },
];
const SALARY_TYPES = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'HOURLY', label: 'Hourly' },
];

// IT Admin account functions as OWNER but displays a distinct label
const getMemberRoleLabel = (member: any) =>
  member.email === 'it@jireh.com' ? 'IT Admin' : (ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] ?? member.role);

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<{ open: boolean; member?: any }>({ open: false });
  const [toggleDialog, setToggleDialog] = useState<{ open: boolean; member?: any }>({ open: false });
  const [saving, setSaving] = useState(false);

  const { register: regCreate, handleSubmit: subCreate, reset: resetCreate, formState: { errors: errCreate } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'CASHIER', salaryType: 'MONTHLY', salary: 0 },
  });
  const { register: regEdit, handleSubmit: subEdit, reset: resetEdit, formState: { errors: errEdit } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  const fetchStaff = async () => {
    const res = await fetch('/api/admin/staff');
    setStaff(await res.json());
    setLoading(false);
  };
  useEffect(() => { fetchStaff(); }, []);

  const createMember = async (values: CreateForm) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      await fetchStaff();
      setAddModal(false);
      resetCreate();
    } finally { setSaving(false); }
  };

  const openEdit = (member: any) => {
    resetEdit({
      name: member.name,
      email: member.email,
      role: member.role,
      phone: member.staffProfile?.phone ?? '',
      hireDate: member.staffProfile?.hireDate ? member.staffProfile.hireDate.slice(0, 10) : '',
      salaryType: member.staffProfile?.salaryType ?? 'MONTHLY',
      salary: member.staffProfile?.salary ?? 0,
      bankName: member.staffProfile?.bankName ?? '',
      bankAccount: member.staffProfile?.bankAccount ?? '',
      newPassword: '',
    });
    setEditModal({ open: true, member });
  };

  const saveMember = async (values: EditForm) => {
    setSaving(true);
    try {
      const { newPassword, ...rest } = values;
      await fetch(`/api/admin/staff/${editModal.member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rest,
          ...(newPassword ? { newPassword } : {}),
          staffProfile: {
            phone: rest.phone,
            hireDate: rest.hireDate || undefined,
            salaryType: rest.salaryType,
            salary: rest.salary,
            bankName: rest.bankName,
            bankAccount: rest.bankAccount,
          },
        }),
      });
      await fetchStaff();
      setEditModal({ open: false });
    } finally { setSaving(false); }
  };

  const toggleActive = async () => {
    if (!toggleDialog.member) return;
    await fetch(`/api/admin/staff/${toggleDialog.member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !toggleDialog.member.isActive }),
    });
    await fetchStaff();
    setToggleDialog({ open: false });
  };

  const StaffFormFields = ({ register, errors, showPassword = false }: any) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Full name *" {...register('name')} error={errors.name?.message} />
        <Input label="Email *" type="email" {...register('email')} error={errors.email?.message} />
      </div>
      {showPassword ? (
        <Input label="Password *" type="password" placeholder="Min 6 characters" {...register('password')} error={errors.password?.message} />
      ) : (
        <Input label="New Password (leave blank to keep)" type="password" placeholder="Leave blank to keep current" {...register('newPassword')} error={errors.newPassword?.message} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Select label="Role" options={ROLES} {...register('role')} />
        <Input label="Phone" placeholder="+233…" {...register('phone')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Salary Type" options={SALARY_TYPES} {...register('salaryType')} />
        <Input label="Salary (GH₵)" type="number" step="0.01" {...register('salary')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Hire Date" type="date" {...register('hireDate')} />
        <Input label="Bank Name" placeholder="Bank name" {...register('bankName')} />
      </div>
      <Input label="Bank Account" placeholder="Account number" {...register('bankAccount')} />
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Staff</h1>
          <p className="text-sm text-[#aba8a4]">{staff.filter(s => s.isActive).length} active · {staff.length} total</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => { resetCreate({ role: 'CASHIER', salaryType: 'MONTHLY', salary: 0 }); setAddModal(true); }}>
          Add Staff
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" /></div>
      ) : staff.length === 0 ? (
        <EmptyState icon={<Users size={24} />} title="No staff yet" description="Add your team members to get started" action={{ label: 'Add Staff', onClick: () => setAddModal(true) }} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map(member => (
            <Card key={member.id} padding="md">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#349f2d]/20 border border-[#349f2d]/30 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-[#5ecf4f]">{member.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#f4efeb]">{member.name}</p>
                    <p className="text-xs text-[#aba8a4]">{member.email}</p>
                  </div>
                </div>
                {!member.isActive && <Badge variant="red" size="sm">Inactive</Badge>}
              </div>
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#aba8a4]">Role</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ROLE_COLORS[member.role as keyof typeof ROLE_COLORS]}`}>
                    {getMemberRoleLabel(member)}
                  </span>
                </div>
                {member.staffProfile?.salary > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#aba8a4]">Salary</span>
                    <span className="text-xs text-[#f4efeb]">{formatCurrency(member.staffProfile.salary)} / {member.staffProfile.salaryType.toLowerCase()}</span>
                  </div>
                )}
                {member.staffProfile?.hireDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#aba8a4]">Hired</span>
                    <span className="text-xs text-[#f4efeb]">{formatDate(member.staffProfile.hireDate)}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="xs" icon={<Pencil size={11} />} onClick={() => openEdit(member)}>Edit</Button>
                <Button
                  variant={member.isActive ? 'danger' : 'success'} size="xs"
                  icon={member.isActive ? <UserX size={11} /> : <UserCheck size={11} />}
                  onClick={() => setToggleDialog({ open: true, member })}
                >
                  {member.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Staff Member" size="lg"
        footer={<>
          <Button variant="ghost" onClick={() => setAddModal(false)}>Cancel</Button>
          <Button onClick={subCreate(createMember)} loading={saving}>Add Member</Button>
        </>}>
        <StaffFormFields register={regCreate} errors={errCreate} showPassword />
      </Modal>

      {/* Edit modal */}
      <Modal open={editModal.open} onClose={() => setEditModal({ open: false })} title={`Edit — ${editModal.member?.name}`} size="lg"
        footer={<>
          <Button variant="ghost" onClick={() => setEditModal({ open: false })}>Cancel</Button>
          <Button onClick={subEdit(saveMember)} loading={saving}>Save Changes</Button>
        </>}>
        <StaffFormFields register={regEdit} errors={errEdit} showPassword={false} />
      </Modal>

      <ConfirmDialog
        open={toggleDialog.open}
        onClose={() => setToggleDialog({ open: false })}
        onConfirm={toggleActive}
        title={toggleDialog.member?.isActive ? 'Deactivate Staff' : 'Activate Staff'}
        message={`${toggleDialog.member?.isActive ? 'Deactivate' : 'Activate'} ${toggleDialog.member?.name}?`}
        confirmLabel={toggleDialog.member?.isActive ? 'Deactivate' : 'Activate'}
        danger={toggleDialog.member?.isActive}
      />
    </div>
  );
}
