'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, UtensilsCrossed, Star, ImagePlus, X } from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input, Select, Textarea } from '@/src/components/ui/Input';
import { Badge } from '@/src/components/ui/Badge';
import { Modal, ConfirmDialog } from '@/src/components/ui/Modal';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { formatCurrency } from '@/src/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const itemSchema = z.object({
  name: z.string().min(1, 'Name required'),
  description: z.string().optional(),
  price: z.coerce.number().positive('Price must be positive'),
  costPrice: z.coerce.number().optional(),
  isAvailable: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  tags: z.string().optional(),
});
type ItemForm = z.infer<typeof itemSchema>;

export default function MenuPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [itemModal, setItemModal] = useState<{ open: boolean; item?: any; categoryId?: string }>({ open: false });
  const [catModal, setCatModal] = useState<{ open: boolean; cat?: any }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string; type?: string; name?: string }>({ open: false });
  const [saving, setSaving] = useState(false);
  const [catName, setCatName] = useState('');

  // Image state
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
  });

  const fetchMenu = async () => {
    const res = await fetch('/api/admin/menu');
    const data = await res.json();
    setCategories(data);
    if (!activeCategory && data.length > 0) setActiveCategory(data[0].id);
    setLoading(false);
  };

  useEffect(() => { fetchMenu(); }, []);

  const openItemModal = (categoryId: string, item?: any) => {
    reset(item ? {
      name: item.name,
      description: item.description ?? '',
      price: item.price,
      costPrice: item.costPrice ?? '',
      isAvailable: item.isAvailable,
      isPopular: item.isPopular,
      tags: (item.tags ?? []).join(', '),
    } : { isAvailable: true, isPopular: false });
    setImageUrl(item?.image ?? '');
    setImageError('');
    setItemModal({ open: true, item, categoryId });
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setImageError(data.error ?? 'Upload failed'); return; }
      setImageUrl(data.url);
    } catch {
      setImageError('Upload failed — try again');
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveItem = async (values: ItemForm) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        type: 'item',
        categoryId: itemModal.categoryId,
        tags: values.tags ? values.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        image: imageUrl || null,
        ...(itemModal.item ? { id: itemModal.item.id } : {}),
      };
      await fetch('/api/admin/menu', {
        method: itemModal.item ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetchMenu();
      setItemModal({ open: false });
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async () => {
    if (!catName.trim()) return;
    setSaving(true);
    try {
      const payload = catModal.cat
        ? { id: catModal.cat.id, type: 'category', name: catName }
        : { type: 'category', name: catName };
      await fetch('/api/admin/menu', {
        method: catModal.cat ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetchMenu();
      setCatModal({ open: false });
      setCatName('');
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = async (id: string, field: string, value: boolean) => {
    await fetch('/api/admin/menu', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'item', [field]: !value }),
    });
    await fetchMenu();
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    await fetch(`/api/admin/menu?id=${deleteDialog.id}&type=${deleteDialog.type}`, { method: 'DELETE' });
    await fetchMenu();
    setDeleteDialog({ open: false });
  };

  const activeCat = categories.find(c => c.id === activeCategory);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Menu</h1>
          <p className="text-sm text-[#aba8a4]">
            {categories.length} categories · {categories.reduce((s, c) => s + c.items.length, 0)} items
          </p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => { setCatName(''); setCatModal({ open: true }); }}>
          Add Category
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-5">
          {/* Category list */}
          <div className="w-52 shrink-0 space-y-1">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={[
                  'w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center justify-between gap-2',
                  cat.id === activeCategory
                    ? 'bg-[#349f2d]/20 text-[#5ecf4f] border border-[#349f2d]/40'
                    : 'text-[#aba8a4] hover:text-[#f4efeb] hover:bg-white/5 border border-transparent',
                ].join(' ')}
              >
                <span className="truncate font-medium">{cat.name}</span>
                <Badge variant="gray" size="sm">{cat.items.length}</Badge>
              </button>
            ))}
          </div>

          {/* Items list */}
          <div className="flex-1 min-w-0">
            {activeCat ? (
              <Card padding="none">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#2b2f2b]">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-[#f4efeb]">{activeCat.name}</h2>
                    <button
                      onClick={() => { setCatName(activeCat.name); setCatModal({ open: true, cat: activeCat }); }}
                      className="text-[#aba8a4] hover:text-[#f4efeb] p-1 rounded-lg hover:bg-white/5"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteDialog({ open: true, id: activeCat.id, type: 'category', name: activeCat.name })}
                      className="text-[#aba8a4] hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <Button size="sm" icon={<Plus size={13} />} onClick={() => openItemModal(activeCat.id)}>
                    Add Item
                  </Button>
                </div>

                {activeCat.items.length === 0 ? (
                  <EmptyState
                    icon={<UtensilsCrossed size={22} />}
                    title="No items yet"
                    description="Add your first menu item to this category"
                    action={{ label: 'Add Item', onClick: () => openItemModal(activeCat.id) }}
                  />
                ) : (
                  <div className="divide-y divide-[#2b2f2b]">
                    {activeCat.items.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#111311] border border-[#2b2f2b] flex items-center justify-center">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <UtensilsCrossed size={16} className="text-[#2b2f2b]" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[#f4efeb]">{item.name}</span>
                            {item.isPopular && <Star size={11} className="text-yellow-400 fill-yellow-400" />}
                            {!item.isAvailable && <Badge variant="red" size="sm">Off menu</Badge>}
                            {(item.tags ?? []).map((tag: string) => (
                              <Badge key={tag} variant="gray" size="sm">{tag}</Badge>
                            ))}
                          </div>
                          {item.description && (
                            <p className="text-xs text-[#aba8a4] mt-0.5 truncate max-w-xs">{item.description}</p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-[#f4efeb]">{formatCurrency(item.price)}</p>
                          {item.costPrice && (
                            <p className="text-xs text-[#aba8a4]">Cost: {formatCurrency(item.costPrice)}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleItem(item.id, 'isAvailable', item.isAvailable)}
                            className={`p-1.5 rounded-lg transition-colors ${item.isAvailable ? 'text-[#5ecf4f] hover:bg-[#349f2d]/10' : 'text-[#aba8a4] hover:bg-white/5'}`}
                            title={item.isAvailable ? 'Mark unavailable' : 'Mark available'}
                          >
                            {item.isAvailable ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                          <button
                            onClick={() => openItemModal(activeCat.id, item)}
                            className="p-1.5 rounded-lg text-[#aba8a4] hover:text-[#f4efeb] hover:bg-white/5 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteDialog({ open: true, id: item.id, type: 'item', name: item.name })}
                            className="p-1.5 rounded-lg text-[#aba8a4] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ) : (
              <EmptyState
                icon={<UtensilsCrossed size={22} />}
                title="Select a category"
                description="Choose a category from the left to manage its items"
              />
            )}
          </div>
        </div>
      )}

      {/* Item modal */}
      <Modal
        open={itemModal.open}
        onClose={() => setItemModal({ open: false })}
        title={itemModal.item ? 'Edit Item' : 'Add Menu Item'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setItemModal({ open: false })}>Cancel</Button>
            <Button onClick={handleSubmit(saveItem)} loading={saving}>
              {itemModal.item ? 'Save Changes' : 'Add Item'}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          {/* Image upload */}
          <div>
            <p className="text-xs font-medium text-[#aba8a4] mb-2">Photo</p>
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#111311] border border-[#2b2f2b] flex items-center justify-center shrink-0">
                {imageUploading ? (
                  <div className="w-5 h-5 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" />
                ) : imageUrl ? (
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <UtensilsCrossed size={22} className="text-[#2b2f2b]" />
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImagePick}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#2b2f2b] text-xs text-[#aba8a4] hover:text-[#f4efeb] hover:border-[#404540] transition-colors disabled:opacity-50"
                >
                  <ImagePlus size={13} />
                  {imageUploading ? 'Uploading…' : imageUrl ? 'Change photo' : 'Upload photo'}
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                  >
                    <X size={11} /> Remove
                  </button>
                )}
                {imageError && <p className="text-xs text-red-400">{imageError}</p>}
                <p className="text-[10px] text-[#aba8a4]">JPG, PNG or WebP · max 4MB</p>
              </div>
            </div>
          </div>

          <Input label="Item name *" placeholder="e.g. Jollof Rice with Chicken" error={errors.name?.message} {...register('name')} />
          <Textarea label="Description" placeholder="Brief description of the dish…" {...register('description')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Price (GH₵) *" type="number" step="0.01" placeholder="0.00" error={errors.price?.message} {...register('price')} />
            <Input label="Cost Price (GH₵)" type="number" step="0.01" placeholder="0.00" hint="For margin tracking" {...register('costPrice')} />
          </div>
          <Input label="Tags" placeholder="vegetarian, spicy, popular" hint="Comma-separated" {...register('tags')} />
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('isAvailable')} className="w-4 h-4 accent-[#349f2d]" />
              <span className="text-sm text-[#f4efeb]">Available on menu</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('isPopular')} className="w-4 h-4 accent-[#349f2d]" />
              <span className="text-sm text-[#f4efeb]">⭐ Popular item</span>
            </label>
          </div>
        </form>
      </Modal>

      {/* Category modal */}
      <Modal
        open={catModal.open}
        onClose={() => setCatModal({ open: false })}
        title={catModal.cat ? 'Edit Category' : 'Add Category'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCatModal({ open: false })}>Cancel</Button>
            <Button onClick={saveCategory} loading={saving}>{catModal.cat ? 'Save' : 'Create'}</Button>
          </>
        }
      >
        <Input
          label="Category name"
          placeholder="e.g. Drinks, Sides, Snacks…"
          value={catName}
          onChange={e => setCatName(e.target.value)}
        />
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false })}
        onConfirm={handleDelete}
        title={`Delete ${deleteDialog.type === 'category' ? 'Category' : 'Item'}`}
        message={`Are you sure you want to delete "${deleteDialog.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
