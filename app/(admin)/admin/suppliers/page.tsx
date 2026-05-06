'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Phone, Mail, MapPin, X, Save, Truck, Trash2 } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  _count?: { purchaseOrders: number };
}

const emptyForm = () => ({ name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' });

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetch_ = async () => {
    const res = await fetch('/api/admin/suppliers');
    if (res.ok) setSuppliers(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const openCreate = () => { setEditingId(null); setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (s: Supplier) => {
    setEditingId(s.id);
    setForm({ name: s.name, contactPerson: s.contactPerson ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', notes: s.notes ?? '' });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/suppliers/${editingId}` : '/api/admin/suppliers';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) { setFormOpen(false); await fetch_(); }
    } finally { setSaving(false); }
  };

  const deactivate = async (id: string) => {
    if (!confirm('Remove this supplier?')) return;
    await fetch(`/api/admin/suppliers/${id}`, { method: 'DELETE' });
    await fetch_();
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-96">
      <div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Suppliers</h1>
          <p className="text-sm text-[#aba8a4] mt-0.5">Manage ingredient suppliers and contact details</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-[#349f2d] hover:bg-[#287e22] text-white rounded-xl text-sm font-semibold transition-colors">
          <Plus size={15} /> Add Supplier
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4">
          <p className="text-xs text-[#aba8a4]">Active Suppliers</p>
          <p className="text-2xl font-bold text-[#f4efeb] mt-1">{suppliers.length}</p>
        </div>
        <div className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4">
          <p className="text-xs text-[#aba8a4]">Total Purchase Orders</p>
          <p className="text-2xl font-bold text-[#f4efeb] mt-1">{suppliers.reduce((s, sup) => s + (sup._count?.purchaseOrders ?? 0), 0)}</p>
        </div>
      </div>

      {/* Supplier cards */}
      {suppliers.length === 0 ? (
        <div className="text-center py-16 bg-[#191c19] border border-[#2b2f2b] rounded-2xl">
          <Truck size={32} className="text-[#2b2f2b] mx-auto mb-3" />
          <p className="text-sm text-[#aba8a4]">No suppliers yet. Add your first supplier.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suppliers.map(s => (
            <div key={s.id} className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-semibold text-[#f4efeb]">{s.name}</p>
                  {s.contactPerson && <p className="text-xs text-[#aba8a4] mt-0.5">{s.contactPerson}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-[#aba8a4] hover:text-[#f4efeb] hover:bg-white/5 transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deactivate(s.id)} className="p-1.5 rounded-lg text-[#aba8a4] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {s.phone && (
                  <div className="flex items-center gap-2 text-xs text-[#aba8a4]">
                    <Phone size={12} className="shrink-0" /> {s.phone}
                  </div>
                )}
                {s.email && (
                  <div className="flex items-center gap-2 text-xs text-[#aba8a4]">
                    <Mail size={12} className="shrink-0" /> {s.email}
                  </div>
                )}
                {s.address && (
                  <div className="flex items-center gap-2 text-xs text-[#aba8a4]">
                    <MapPin size={12} className="shrink-0" /> {s.address}
                  </div>
                )}
              </div>

              {s._count && s._count.purchaseOrders > 0 && (
                <div className="pt-2 border-t border-[#2b2f2b]">
                  <span className="text-xs text-[#5ecf4f]">{s._count.purchaseOrders} purchase order{s._count.purchaseOrders !== 1 ? 's' : ''}</span>
                </div>
              )}

              {s.notes && <p className="text-xs text-[#aba8a4] italic">{s.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#191c19] border border-[#2b2f2b] rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b2f2b]">
              <h2 className="text-base font-bold text-[#f4efeb]">{editingId ? 'Edit Supplier' : 'New Supplier'}</h2>
              <button onClick={() => setFormOpen(false)} className="text-[#aba8a4] hover:text-[#f4efeb]"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {[
                { key: 'name', label: 'Supplier Name *', placeholder: 'e.g. Adjoa Fresh Market' },
                { key: 'contactPerson', label: 'Contact Person', placeholder: 'e.g. Adjoa Mensah' },
                { key: 'phone', label: 'Phone', placeholder: '0XX-XXX-XXXX' },
                { key: 'email', label: 'Email', placeholder: 'supplier@example.com' },
                { key: 'address', label: 'Address / Location', placeholder: 'Madina Market, Accra' },
                { key: 'notes', label: 'Notes', placeholder: 'Any additional info…' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-[#aba8a4] mb-1.5">{f.label}</label>
                  <input
                    value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] placeholder:text-[#aba8a4]/50 focus:outline-none focus:border-[#349f2d] transition-colors"
                  />
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-[#2b2f2b] flex gap-3">
              <button onClick={() => setFormOpen(false)} className="flex-1 py-2.5 rounded-xl border border-[#2b2f2b] text-[#aba8a4] hover:text-[#f4efeb] text-sm transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !form.name.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#349f2d] hover:bg-[#287e22] disabled:opacity-40 text-white text-sm font-semibold transition-colors">
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
