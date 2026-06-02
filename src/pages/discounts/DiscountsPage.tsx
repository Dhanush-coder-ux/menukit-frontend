import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Plus, Tag, Trash2, Edit2, ToggleLeft, ToggleRight, Calendar, Percent,
  ShoppingBag, Layers, Clock, CheckCircle2, AlertCircle, Timer, Sparkles, X, Search
} from 'lucide-react';
import { api } from '@/services/api';
import { Discount, Category, MenuItem } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useShopStore } from '@/store/shopStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

type DiscountStatus = 'active' | 'scheduled' | 'expired' | 'inactive';

function getDiscountStatus(d: Discount): DiscountStatus {
  if (!d.is_active) return 'inactive';
  const now = new Date();
  if (d.start_date && new Date(d.start_date) > now) return 'scheduled';
  if (d.end_date && new Date(d.end_date) < now) return 'expired';
  return 'active';
}

const STATUS_CONFIG: Record<DiscountStatus, { label: string; color: string; icon: React.ReactNode }> = {
  active: {
    label: 'Active',
    color: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    icon: <CheckCircle2 size={12} />,
  },
  scheduled: {
    label: 'Scheduled',
    color: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    icon: <Timer size={12} />,
  },
  expired: {
    label: 'Expired',
    color: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
    icon: <AlertCircle size={12} />,
  },
  inactive: {
    label: 'Inactive',
    color: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    icon: <AlertCircle size={12} />,
  },
};

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Default form ────────────────────────────────────────────────────────────

const defaultForm = {
  title: '',
  description: '',
  discount_type: 'percentage' as 'percentage' | 'flat' | 'bogo' | 'combo',
  discount_value: '',
  buy_quantity: '',
  get_quantity: '',
  reward_target_ids: [] as string[],
  applies_to: 'all' as 'all' | 'category' | 'items',
  target_ids: [] as string[],
  start_date: '',
  end_date: '',
  is_active: true,
};

// ─── Component ───────────────────────────────────────────────────────────────

export function DiscountsPage() {
  const { shop } = useShopStore();
  const currencySymbol = shop?.settings?.currency || '₹';

  const [searchQuery, setSearchQuery] = useState('');
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(defaultForm);
  const [discountToDelete, setDiscountToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<'discount' | 'combo'>('discount');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      // Always load categories and items — these are needed for the modal selectors
      const [catRes, itemRes] = await Promise.all([
        api.get('/categories'),
        api.get('/menu-items'),
      ]);
      setCategories(catRes.data);
      setMenuItems(itemRes.data);
    } catch {
      toast.error('Failed to load categories and items');
    } finally {
      setIsLoading(false);
    }

    // Load discounts separately — if this fails (e.g. migration not run), the page still works
    try {
      const discRes = await api.get('/discounts');
      setDiscounts(discRes.data);
    } catch {
      // Silently ignore — discounts table may not exist yet
    }
  };


  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openModal = (defaultType?: 'percentage' | 'flat' | 'bogo' | 'combo' | Discount, discount?: Discount) => {
    // If the first argument is a discount object (editing mode)
    const isEditing = defaultType && typeof defaultType === 'object';
    const targetDiscount = isEditing ? (defaultType as Discount) : discount;

    if (targetDiscount) {
      setModalCategory(['percentage', 'flat'].includes(targetDiscount.discount_type) ? 'discount' : 'combo');
      setEditingDiscount(targetDiscount);
      setFormData({
        title: targetDiscount.title,
        description: targetDiscount.description || '',
        discount_type: targetDiscount.discount_type,
        discount_value: targetDiscount.discount_value?.toString() || '',
        buy_quantity: targetDiscount.buy_quantity?.toString() || '',
        get_quantity: targetDiscount.get_quantity?.toString() || '',
        reward_target_ids: targetDiscount.reward_target_ids || [],
        applies_to: targetDiscount.applies_to,
        target_ids: targetDiscount.target_ids || [],
        start_date: targetDiscount.start_date
          ? new Date(targetDiscount.start_date).toISOString().slice(0, 16)
          : '',
        end_date: targetDiscount.end_date
          ? new Date(targetDiscount.end_date).toISOString().slice(0, 16)
          : '',
        is_active: targetDiscount.is_active,
      });
    } else {
      const type = typeof defaultType === 'string' ? defaultType : 'percentage';
      setModalCategory(['percentage', 'flat'].includes(type) ? 'discount' : 'combo');
      setEditingDiscount(null);
      setFormData({
        ...defaultForm,
        discount_type: type,
        applies_to: (type === 'bogo' || type === 'combo') ? 'items' : 'all'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (['percentage', 'flat', 'combo'].includes(formData.discount_type) && !formData.discount_value) {
      toast.error('Please enter a value/price');
      return;
    }
    if (formData.discount_type === 'bogo' && (!formData.buy_quantity || !formData.get_quantity)) {
      toast.error('Please specify buy and get quantities');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        discount_value: formData.discount_value ? parseFloat(formData.discount_value) : null,
        buy_quantity: formData.buy_quantity ? parseInt(formData.buy_quantity) : null,
        get_quantity: formData.get_quantity ? parseInt(formData.get_quantity) : null,
        reward_target_ids: formData.reward_target_ids.length > 0 ? formData.reward_target_ids : null,
        description: formData.description || null,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
        target_ids: formData.applies_to === 'all' ? null : formData.target_ids,
      };

      if (editingDiscount) {
        await api.put(`/discounts/${editingDiscount.id}`, payload);
        toast.success('Discount updated');
      } else {
        await api.post('/discounts', payload);
        toast.success('Discount created');
      }

      setIsModalOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save discount');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!discountToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/discounts/${discountToDelete}`);
      toast.success('Discount deleted');
      setDiscounts(discounts.filter(d => d.id !== discountToDelete));
      setDiscountToDelete(null);
    } catch {
      toast.error('Failed to delete discount');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (d: Discount) => {
    try {
      await api.put(`/discounts/${d.id}`, { is_active: !d.is_active });
      setDiscounts(discounts.map(x => x.id === d.id ? { ...x, is_active: !x.is_active } : x));
      toast.success(d.is_active ? 'Discount deactivated' : 'Discount activated');
    } catch {
      toast.error('Failed to update discount');
    }
  };

  const toggleTargetId = (id: string) => {
    setFormData(prev => ({
      ...prev,
      target_ids: prev.target_ids.includes(id)
        ? prev.target_ids.filter(t => t !== id)
        : [...prev.target_ids, id],
    }));
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const activeCount = discounts.filter(d => getDiscountStatus(d) === 'active').length;
  const scheduledCount = discounts.filter(d => getDiscountStatus(d) === 'scheduled').length;

  const filteredDiscounts = discounts.filter(d => 
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Tag className="text-primary" size={24} />
            Discounts & Offers
          </h2>
          <p className="text-slate-500 mt-1">Create promotions that appear as banners on your public menu.</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: discounts.length, color: 'bg-slate-50 border-slate-200', textColor: 'text-slate-900' },
          { label: 'Active Now', value: activeCount, color: 'bg-emerald-50 border-emerald-200', textColor: 'text-emerald-700' },
          { label: 'Scheduled', value: scheduledCount, color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 sm:p-4 text-center ${s.color}`}>
            <p className={`text-2xl font-bold ${s.textColor}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Sticky Search Bar */}
      <div className="sticky top-0 sm:top-2 z-30 py-2 bg-[#f8fafc]/90 backdrop-blur-md -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search discounts by title or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
          />
        </div>
      </div>

      {/* Discount List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : discounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="text-primary" size={28} />
            </div>
            <h3 className="text-lg font-semibold mb-1">No discounts yet</h3>
            <p className="text-slate-500 text-sm max-w-xs mb-6">
              Create your first offer — it'll appear as a prominent banner when customers scan your QR code.
            </p>
            <Button onClick={() => openModal('percentage')}>
              <Plus size={16} className="mr-2" /> Create First Offer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDiscounts.length === 0 && searchQuery && (
            <div className="py-12 text-center bg-white rounded-xl border border-dashed border-slate-200">
              <Search className="mx-auto text-slate-300 mb-3" size={32} />
              <p className="text-slate-500 font-medium text-sm">No discounts found matching "{searchQuery}"</p>
            </div>
          )}
          {filteredDiscounts.map(d => {
            const status = getDiscountStatus(d);
            const statusCfg = STATUS_CONFIG[status];

            return (
              <div
                key={d.id}
                className={`flex flex-col sm:flex-row p-3.5 sm:p-5 gap-3 sm:gap-4 bg-white rounded-2xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                  status === 'expired' || status === 'inactive' ? 'border-slate-200 opacity-75' : 'border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:border-primary/20'
                }`}
              >
                <div className="flex gap-3 sm:gap-4 flex-1 min-w-0">
                  {/* Icon */}
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    d.discount_type === 'percentage' ? 'bg-primary/10 text-primary' : 
                    d.discount_type === 'bogo' ? 'bg-indigo-100 text-indigo-600' :
                    d.discount_type === 'combo' ? 'bg-emerald-100 text-emerald-600' :
                    'bg-violet-50 text-violet-600'
                  }`}>
                    {d.discount_type === 'percentage' && <Percent size={20} className="sm:w-6 sm:h-6" strokeWidth={2.5} />}
                    {d.discount_type === 'flat' && <span className="text-xl sm:text-2xl font-black">{currencySymbol}</span>}
                    {d.discount_type === 'bogo' && <Sparkles size={20} className="sm:w-6 sm:h-6" strokeWidth={2.5} />}
                    {d.discount_type === 'combo' && <Layers size={20} className="sm:w-6 sm:h-6" strokeWidth={2.5} />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <h3 className="text-sm sm:text-base font-bold text-slate-800 truncate">{d.title}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${statusCfg.color}`}>
                        {statusCfg.icon} {statusCfg.label}
                      </span>
                    </div>

                    {d.description && (
                      <p className="text-xs sm:text-sm text-slate-500 mb-2 line-clamp-1 font-medium">{d.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px] sm:text-xs font-semibold text-slate-600">
                      <span className="flex items-center gap-1 sm:gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                        {d.discount_type === 'percentage' && <><Percent size={12} className="text-slate-400" /> {d.discount_value}% off</>}
                        {d.discount_type === 'flat' && <><span className="text-slate-400 text-[12px]">{currencySymbol}</span>{d.discount_value} off</>}
                        {d.discount_type === 'bogo' && <><Sparkles size={12} className="text-slate-400" /> Buy {d.buy_quantity} Get {d.get_quantity}</>}
                        {d.discount_type === 'combo' && <><Layers size={12} className="text-slate-400" /> {currencySymbol}{d.discount_value} Combo</>}
                      </span>
                      <span className="flex items-center gap-1 sm:gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                        {d.applies_to === 'all' && <><ShoppingBag size={12} className="text-slate-400" /> All items</>}
                        {d.applies_to === 'category' && <><Layers size={12} className="text-slate-400" /> {(d.target_ids?.length || 0)} categor{(d.target_ids?.length || 0) === 1 ? 'y' : 'ies'}</>}
                        {d.applies_to === 'items' && <><Tag size={12} className="text-slate-400" /> {(d.target_ids?.length || 0)} item{(d.target_ids?.length || 0) === 1 ? '' : 's'}</>}
                      </span>
                      {(d.start_date || d.end_date) && (
                        <span className="flex items-center gap-1 sm:gap-1.5 text-slate-400 mt-0.5 sm:mt-0 w-full sm:w-auto font-medium">
                          <Calendar size={12} />
                          {d.start_date ? formatDateTime(d.start_date) : 'Now'}
                          {' → '}
                          {d.end_date ? formatDateTime(d.end_date) : 'No end'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end sm:justify-start pt-2 sm:pt-0 mt-1 sm:mt-0 border-t sm:border-0 border-slate-100">
                  <button
                    onClick={() => handleToggleActive(d)}
                    className={`flex items-center justify-center p-2 rounded-xl transition-all ${
                      d.is_active
                        ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:scale-105'
                        : 'text-slate-400 bg-slate-100 hover:bg-slate-200 hover:scale-105'
                    }`}
                    title={d.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {d.is_active ? <ToggleRight size={20} strokeWidth={2.5} /> : <ToggleLeft size={20} strokeWidth={2.5} />}
                  </button>
                  <button
                    onClick={() => openModal(d)}
                    className="p-2 rounded-xl text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all hover:scale-105"
                    title="Edit"
                  >
                    <Edit2 size={18} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => setDiscountToDelete(d.id)}
                    className="p-2 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all hover:scale-105"
                    title="Delete"
                  >
                    <Trash2 size={18} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDiscount ? 'Edit Offer' : 'Create New Offer'}
        className="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {/* Title */}
          <Input
            label="Offer Title *"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Weekend Special 20% Off"
            required
          />

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Description (shown on banner)
            </label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g. Enjoy 20% off on all items this weekend only!"
              className="flex w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-slate-900 min-h-[80px] resize-y"
            />
          </div>

          {/* Offer Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Offer Type *</label>
            <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
              {(modalCategory === 'discount' ? ['percentage', 'flat'] : ['bogo', 'combo'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, discount_type: type as any, applies_to: (type === 'bogo' || type === 'combo') ? 'items' : formData.applies_to })}
                  className={`py-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-colors ${
                    formData.discount_type === type
                      ? 'bg-white shadow text-slate-900 dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {type === 'percentage' && <Percent size={14} />}
                  {type === 'flat' && <span className="font-semibold text-sm">{currencySymbol}</span>}
                  {type === 'bogo' && <Sparkles size={14} />}
                  {type === 'combo' && <Layers size={14} />}
                  
                  {type === 'percentage' && 'Percentage'}
                  {type === 'flat' && 'Flat Amount'}
                  {type === 'bogo' && 'BOGO'}
                  {type === 'combo' && 'Combo'}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional Inputs based on type */}
          {['percentage', 'flat'].includes(formData.discount_type) && (
            <Input
              label={formData.discount_type === 'percentage' ? 'Percentage (%) *' : `Amount (${currencySymbol}) *`}
              type="number"
              step="0.01"
              min="0"
              max={formData.discount_type === 'percentage' ? '100' : undefined}
              value={formData.discount_value}
              onChange={e => setFormData({ ...formData, discount_value: e.target.value })}
              placeholder={formData.discount_type === 'percentage' ? '10' : '50'}
              required={['percentage', 'flat'].includes(formData.discount_type)}
            />
          )}

          {formData.discount_type === 'bogo' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl">
              <Input
                label="Buy Quantity *"
                type="number"
                min="1"
                value={formData.buy_quantity}
                onChange={e => setFormData({ ...formData, buy_quantity: e.target.value })}
                placeholder="e.g. 2"
                required={formData.discount_type === 'bogo'}
              />
              <Input
                label="Get Quantity (Free) *"
                type="number"
                min="1"
                value={formData.get_quantity}
                onChange={e => setFormData({ ...formData, get_quantity: e.target.value })}
                placeholder="e.g. 1"
                required={formData.discount_type === 'bogo'}
              />
            </div>
          )}

          {formData.discount_type === 'combo' && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl">
              <Input
                label={`Combo Price (${currencySymbol}) *`}
                type="number"
                step="0.01"
                min="0"
                value={formData.discount_value}
                onChange={e => setFormData({ ...formData, discount_value: e.target.value })}
                placeholder="e.g. 499"
                required={formData.discount_type === 'combo'}
              />
            </div>
          )}

          {/* Applies To */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {formData.discount_type === 'bogo' ? 'Buy these items (Required Purchase) *' : 'Applies To'}
            </label>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
              {([
                { v: 'all', label: 'All Items', icon: <ShoppingBag size={13} /> },
                { v: 'category', label: 'Categories', icon: <Layers size={13} /> },
                { v: 'items', label: 'Items', icon: <Tag size={13} /> },
              ] as const).map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setFormData({ ...formData, applies_to: opt.v, target_ids: [] })}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    formData.applies_to === opt.v
                      ? 'bg-white shadow text-slate-900 dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>

            {/* Category selector */}
            {formData.applies_to === 'category' && (
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="text-xs text-slate-500">No categories found</p>
                ) : categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleTargetId(cat.id)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      formData.target_ids.includes(cat.id)
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-primary/50'
                    }`}
                  >
                    {formData.target_ids.includes(cat.id) && <X size={10} />}
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Item selector */}
            {formData.applies_to === 'items' && (
              <div className="flex flex-col gap-1 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                {menuItems.length === 0 ? (
                  <p className="text-xs text-slate-500">No items found</p>
                ) : menuItems.map(item => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                      formData.target_ids.includes(item.id) ? 'bg-primary/5' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.target_ids.includes(item.id)}
                      onChange={() => toggleTargetId(item.id)}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 line-clamp-1">{item.name}</span>
                    <span className="ml-auto text-xs text-slate-400">{currencySymbol}{item.price}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Reward Item selector (For BOGO) */}
          {formData.discount_type === 'bogo' && (
            <div className="space-y-3 pt-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Get these items (Reward) *</label>
              <div className="flex flex-col gap-1 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30 max-h-48 overflow-y-auto">
                {menuItems.length === 0 ? (
                  <p className="text-xs text-slate-500">No items found</p>
                ) : menuItems.map(item => (
                  <label
                    key={`reward-${item.id}`}
                    className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-indigo-100/50 dark:hover:bg-indigo-800/30 transition-colors ${
                      formData.reward_target_ids.includes(item.id) ? 'bg-indigo-100 dark:bg-indigo-800/50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.reward_target_ids.includes(item.id)}
                      onChange={() => {
                        const newTargets = formData.reward_target_ids.includes(item.id)
                          ? formData.reward_target_ids.filter(id => id !== item.id)
                          : [...formData.reward_target_ids, item.id];
                        setFormData({ ...formData, reward_target_ids: newTargets });
                      }}
                      className="w-4 h-4 rounded accent-indigo-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 line-clamp-1">{item.name}</span>
                    <span className="ml-auto text-xs text-slate-400">{currencySymbol}{item.price}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Date range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                <Calendar size={14} className="text-primary" /> Start Date
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="date"
                  value={formData.start_date ? formData.start_date.split('T')[0] : ''}
                  onChange={e => {
                    const d = e.target.value;
                    if (!d) setFormData({ ...formData, start_date: '' });
                    else {
                      const t = formData.start_date ? formData.start_date.split('T')[1] || '00:00' : '00:00';
                      setFormData({ ...formData, start_date: `${d}T${t}` });
                    }
                  }}
                  className="flex-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all dark:bg-slate-900 dark:border-slate-700"
                />
                <input
                  type="time"
                  value={formData.start_date ? formData.start_date.split('T')[1] || '' : ''}
                  onChange={e => {
                    const t = e.target.value;
                    if (!t) return;
                    const d = formData.start_date ? formData.start_date.split('T')[0] : new Date().toISOString().split('T')[0];
                    setFormData({ ...formData, start_date: `${d}T${t}` });
                  }}
                  disabled={!formData.start_date}
                  className="flex-1 sm:flex-none sm:w-32 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all dark:bg-slate-900 dark:border-slate-700 disabled:opacity-50 disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                <Clock size={14} className="text-amber-500" /> End Date
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="date"
                  value={formData.end_date ? formData.end_date.split('T')[0] : ''}
                  onChange={e => {
                    const d = e.target.value;
                    if (!d) setFormData({ ...formData, end_date: '' });
                    else {
                      const t = formData.end_date ? formData.end_date.split('T')[1] || '00:00' : '00:00';
                      setFormData({ ...formData, end_date: `${d}T${t}` });
                    }
                  }}
                  className="flex-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all dark:bg-slate-900 dark:border-slate-700"
                />
                <input
                  type="time"
                  value={formData.end_date ? formData.end_date.split('T')[1] || '' : ''}
                  onChange={e => {
                    const t = e.target.value;
                    if (!t) return;
                    const d = formData.end_date ? formData.end_date.split('T')[0] : new Date().toISOString().split('T')[0];
                    setFormData({ ...formData, end_date: `${d}T${t}` });
                  }}
                  disabled={!formData.end_date}
                  className="flex-1 sm:flex-none sm:w-32 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all dark:bg-slate-900 dark:border-slate-700 disabled:opacity-50 disabled:bg-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">Enable Offer</p>
              <p className="text-xs text-slate-500">Publish this offer to the public menu now</p>
            </div>
            <div
              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${formData.is_active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${formData.is_active ? 'translate-x-6' : ''}`} />
            </div>
          </label>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingDiscount ? 'Update Offer' : 'Create Offer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmModal
        isOpen={!!discountToDelete}
        onClose={() => setDiscountToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Discount"
        message="This offer will be permanently removed and will no longer appear on your public menu."
        confirmText="Delete"
        isLoading={isDeleting}
      />

      {/* Floating Action Button with Menu */}
      <div className="fixed bottom-20 lg:bottom-8 right-4 lg:right-8 z-50 flex flex-col items-end gap-3">
        {/* Menu Options */}
        <div className={`flex flex-col items-end gap-3 transition-all duration-200 ${isFabOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-4 invisible pointer-events-none'}`}>
          <button
            onClick={() => {
              setIsFabOpen(false);
              openModal('bogo');
            }}
            className="flex items-center gap-2 pr-2 hover:scale-105 transition-transform"
          >
            <span className="bg-white text-slate-700 text-sm font-medium px-3 py-1.5 rounded-lg shadow-sm border border-slate-100">Combos & Bogos</span>
            <div className="w-10 h-10 rounded-full bg-white text-indigo-600 shadow-[0_4px_20px_rgb(0,0,0,0.1)] flex items-center justify-center border border-indigo-50">
              <Sparkles size={18} />
            </div>
          </button>
          <button
            onClick={() => {
              setIsFabOpen(false);
              openModal('percentage');
            }}
            className="flex items-center gap-2 pr-2 hover:scale-105 transition-transform"
          >
            <span className="bg-white text-slate-700 text-sm font-medium px-3 py-1.5 rounded-lg shadow-sm border border-slate-100">Discount & Offer</span>
            <div className="w-10 h-10 rounded-full bg-white text-primary shadow-[0_4px_20px_rgb(0,0,0,0.1)] flex items-center justify-center border border-primary/10">
              <Percent size={18} />
            </div>
          </button>
        </div>

        {/* Main FAB */}
        <button
          onClick={() => setIsFabOpen(!isFabOpen)}
          className="w-14 h-14 rounded-full bg-primary shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center text-white transition-all duration-300 hover:scale-105"
          title="New Offer"
        >
          {isFabOpen ? <X size={24} className="transition-transform duration-300 rotate-90" /> : <Plus size={24} className="transition-transform duration-300" />}
        </button>
      </div>
    </div>
  );
}
