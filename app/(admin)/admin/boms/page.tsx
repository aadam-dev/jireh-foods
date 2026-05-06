'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, BookOpen, X, Save, Pencil, FlaskConical } from 'lucide-react';
import { formatCurrency } from '@/src/lib/utils';

interface InventoryItem { id: string; name: string; unit: string }
interface MenuItem { id: string; name: string; price: number; category: { name: string }; bom?: { id: string } | null }
interface BomLine { id?: string; inventoryItemId: string; quantity: number; unit: string }
interface Bom {
  id: string;
  menuItemId: string;
  notes?: string;
  isActive: boolean;
  menuItem: { id: string; name: string; price: number; category: { name: string } };
  lines: (BomLine & { inventoryItem: { id: string; name: string; unit: string } })[];
}

const emptyLine = (): BomLine => ({ inventoryItemId: '', quantity: 0, unit: '' });

export default function BomsPage() {
  const [boms, setBoms] = useState<Bom[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuItemId, setMenuItemId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<BomLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    const [bomsRes, menuRes, invRes] = await Promise.all([
      fetch('/api/admin/boms'),
      fetch('/api/admin/menu'),
      fetch('/api/admin/inventory'),
    ]);
    const [bomsData, menuData, invData] = await Promise.all([bomsRes.json(), menuRes.json(), invRes.json()]);
    setBoms(bomsData);
    setMenuItems(menuData?.items ?? menuData ?? []);
    setInventory(invData?.items ?? invData ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setMenuItemId('');
    setNotes('');
    setLines([emptyLine()]);
    setFormOpen(true);
  };

  const openEdit = (bom: Bom) => {
    setEditingId(bom.id);
    setMenuItemId(bom.menuItemId);
    setNotes(bom.notes ?? '');
    setLines(bom.lines.map(l => ({ inventoryItemId: l.inventoryItemId, quantity: Number(l.quantity), unit: l.unit })));
    setFormOpen(true);
  };

  const addLine = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof BomLine, value: string | number) => {
    setLines(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      // Auto-fill unit from inventory item
      if (field === 'inventoryItemId') {
        const inv = inventory.find(it => it.id === value);
        if (inv) next[i].unit = inv.unit;
      }
      return next;
    });
  };

  const save = async () => {
    if (!menuItemId || lines.some(l => !l.inventoryItemId || !l.quantity)) return;
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/boms/${editingId}` : '/api/admin/boms';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItemId, notes, lines }),
      });
      if (res.ok) { setFormOpen(false); await fetchAll(); }
    } finally { setSaving(false); }
  };

  const deleteBom = async (id: string) => {
    if (!confirm('Delete this recipe?')) return;
    await fetch(`/api/admin/boms/${id}`, { method: 'DELETE' });
    await fetchAll();
  };

  // Menu items without a BOM (for the create form dropdown)
  const unlinkedItems = menuItems.filter(m => !boms.find(b => b.menuItemId === m.id));

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-96">
      <div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Recipes (BOMs)</h1>
          <p className="text-sm text-[#aba8a4] mt-0.5">Link menu items to ingredients for automatic stock deduction</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-[#349f2d] hover:bg-[#287e22] text-white rounded-xl text-sm font-semibold transition-colors">
          <Plus size={15} /> New Recipe
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Recipes', value: boms.length },
          { label: 'Items Covered', value: boms.length },
          { label: 'Items Without Recipe', value: unlinkedItems.length },
        ].map(s => (
          <div key={s.label} className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-4">
            <p className="text-xs text-[#aba8a4]">{s.label}</p>
            <p className="text-2xl font-bold text-[#f4efeb] mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* BOM list */}
      <div className="space-y-2">
        {boms.length === 0 ? (
          <div className="text-center py-16 bg-[#191c19] border border-[#2b2f2b] rounded-2xl">
            <FlaskConical size={32} className="text-[#2b2f2b] mx-auto mb-3" />
            <p className="text-sm text-[#aba8a4]">No recipes yet. Create one to enable automatic stock deduction.</p>
          </div>
        ) : boms.map(bom => (
          <div key={bom.id} className="bg-[#191c19] border border-[#2b2f2b] rounded-2xl overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
              onClick={() => setExpanded(expanded === bom.id ? null : bom.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#349f2d]/20 border border-[#349f2d]/30 flex items-center justify-center">
                  <FlaskConical size={14} className="text-[#5ecf4f]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#f4efeb]">{bom.menuItem.name}</p>
                  <p className="text-xs text-[#aba8a4]">{bom.menuItem.category.name} · {formatCurrency(bom.menuItem.price)} · {bom.lines.length} ingredient{bom.lines.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); openEdit(bom); }}
                  className="p-1.5 rounded-lg text-[#aba8a4] hover:text-[#f4efeb] hover:bg-white/5 transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteBom(bom.id); }}
                  className="p-1.5 rounded-lg text-[#aba8a4] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 size={13} />
                </button>
                {expanded === bom.id ? <ChevronUp size={15} className="text-[#aba8a4]" /> : <ChevronDown size={15} className="text-[#aba8a4]" />}
              </div>
            </div>

            {expanded === bom.id && (
              <div className="px-5 pb-4 border-t border-[#2b2f2b]">
                <div className="pt-3 space-y-1.5">
                  {bom.lines.map((line, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-[#f4efeb]">{line.inventoryItem.name}</span>
                      <span className="text-[#aba8a4]">{Number(line.quantity)} {line.unit}</span>
                    </div>
                  ))}
                  {bom.notes && <p className="text-xs text-[#aba8a4] mt-2 pt-2 border-t border-[#2b2f2b]">Note: {bom.notes}</p>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create / Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#191c19] border border-[#2b2f2b] rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b2f2b] shrink-0">
              <h2 className="text-base font-bold text-[#f4efeb]">{editingId ? 'Edit Recipe' : 'New Recipe'}</h2>
              <button onClick={() => setFormOpen(false)} className="text-[#aba8a4] hover:text-[#f4efeb]"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Menu item select */}
              {!editingId ? (
                <div>
                  <label className="block text-xs font-medium text-[#aba8a4] mb-1.5">Menu Item</label>
                  <select value={menuItemId} onChange={e => setMenuItemId(e.target.value)}
                    className="w-full bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] focus:outline-none focus:border-[#349f2d]">
                    <option value="">Select menu item…</option>
                    {unlinkedItems.map(m => (
                      <option key={m.id} value={m.id}>{m.name} — {m.category.name}</option>
                    ))}
                  </select>
                  {unlinkedItems.length === 0 && (
                    <p className="text-xs text-yellow-400 mt-1">All menu items already have recipes.</p>
                  )}
                </div>
              ) : (
                <div className="bg-[#111311] rounded-xl px-4 py-3">
                  <p className="text-xs text-[#aba8a4]">Editing recipe for</p>
                  <p className="text-sm font-semibold text-[#f4efeb] mt-0.5">{boms.find(b => b.id === editingId)?.menuItem.name}</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-[#aba8a4] mb-1.5">Notes (optional)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Per single serving"
                  className="w-full bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] focus:outline-none focus:border-[#349f2d]" />
              </div>

              {/* Ingredient lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[#aba8a4]">Ingredients</label>
                  <button onClick={addLine} className="text-xs text-[#5ecf4f] hover:text-[#349f2d] flex items-center gap-1 transition-colors">
                    <Plus size={12} /> Add ingredient
                  </button>
                </div>
                <div className="space-y-2">
                  {lines.map((line, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select value={line.inventoryItemId} onChange={e => updateLine(i, 'inventoryItemId', e.target.value)}
                        className="flex-1 bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-2 text-sm text-[#f4efeb] focus:outline-none focus:border-[#349f2d]">
                        <option value="">Select ingredient…</option>
                        {inventory.map(inv => <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</option>)}
                      </select>
                      <input type="number" min="0" step="0.001" value={line.quantity || ''} onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="Qty"
                        className="w-20 bg-[#111311] border border-[#2b2f2b] rounded-xl px-3 py-2 text-sm text-[#f4efeb] focus:outline-none focus:border-[#349f2d]" />
                      <span className="text-xs text-[#aba8a4] w-8 text-center shrink-0">{line.unit || '—'}</span>
                      <button onClick={() => removeLine(i)} disabled={lines.length === 1}
                        className="text-[#aba8a4] hover:text-red-400 disabled:opacity-30 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#2b2f2b] flex gap-3 shrink-0">
              <button onClick={() => setFormOpen(false)} className="flex-1 py-2.5 rounded-xl border border-[#2b2f2b] text-[#aba8a4] hover:text-[#f4efeb] text-sm transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !menuItemId || lines.some(l => !l.inventoryItemId || !l.quantity)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#349f2d] hover:bg-[#287e22] disabled:opacity-40 text-white text-sm font-semibold transition-colors">
                <Save size={14} /> {saving ? 'Saving…' : 'Save Recipe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
