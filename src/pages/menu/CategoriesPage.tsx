import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, GripVertical, MenuSquare } from 'lucide-react';
import { api } from '@/services/api';
import { useShopStore } from '@/store/shopStore';
import { Category } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableCategoryItem = ({ 
  cat, 
  onToggleActive, 
  onEdit, 
  onDelete 
}: { 
  cat: Category;
  onToggleActive: (cat: Category) => void;
  onEdit: (cat: Category) => void;
  onDelete: (id: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="pb-3">
      <Card className={`transition-all ${!cat.is_active ? 'opacity-60' : ''} ${isDragging ? 'shadow-lg border-primary' : ''}`}>
        <CardContent className="p-4 flex items-center gap-4">
          <div {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-2 -ml-2">
            <GripVertical size={20} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">{cat.name}</h3>
            <p className="text-xs text-slate-500">{cat.item_count} items</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleActive(cat); }}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                cat.is_active 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {cat.is_active ? 'Active' : 'Hidden'}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(cat); }}
              className="p-2 text-slate-500 hover:bg-slate-100 hover:text-primary rounded-lg transition-colors dark:hover:bg-slate-800"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(cat.id); }}
              className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors dark:hover:bg-red-900/20"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export function CategoriesPage() {
  const { categories, setCategories } = useShopStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  
  const [formData, setFormData] = useState({ name: '', is_active: true });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (error) {
      toast.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (category?: Category) => {
    if (category) {
      setEditingCat(category);
      setFormData({
        name: category.name,
        is_active: category.is_active
      });
    } else {
      setEditingCat(null);
      setFormData({ name: '', is_active: true });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Category name is required');
    
    setIsSubmitting(true);
    try {
      if (editingCat) {
        await api.put(`/categories/${editingCat.id}`, formData);
        toast.success('Category updated');
      } else {
        await api.post('/categories', { ...formData, display_order: categories.length });
        toast.success('Category created');
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/categories/${categoryToDelete}`);
      toast.success('Category deleted');
      setCategories(categories.filter(c => c.id !== categoryToDelete));
      setCategoryToDelete(null);
    } catch (error) {
      toast.error('Failed to delete category');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (cat: Category) => {
    try {
      const newStatus = !cat.is_active;
      await api.put(`/categories/${cat.id}`, { is_active: newStatus });
      setCategories(categories.map(c => c.id === cat.id ? { ...c, is_active: newStatus } : c));
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      await api.delete('/categories/all');
      setCategories([]);
      setShowDeleteAllConfirm(false);
      toast.success('All categories deleted');
    } catch (error) {
      toast.error('Failed to delete all categories');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = categories.findIndex((item) => item.id === active.id);
      const newIndex = categories.findIndex((item) => item.id === over?.id);
      
      const newItems = arrayMove(categories, oldIndex, newIndex);
      setCategories(newItems);
      
      // Prepare order payload
      const order = newItems.map((item, index) => ({
        id: item.id,
        display_order: index,
      }));
      
      // Trigger API call to update order
      api.put('/categories/reorder/batch', { order }).catch(() => {
        toast.error('Failed to reorder categories');
        fetchCategories(); // Revert on failure
      });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading">Menu Categories {categories.length > 0 && `(${categories.length})`}</h2>
          <p className="text-slate-500">Create categories like Starters, Main Course, Drinks.</p>
        </div>
        {categories.length > 0 && (
          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-medium text-sm transition-colors border border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:hover:bg-red-900/40"
          >
            <Trash2 size={15} />
            Delete All
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : categories.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <MenuSquare className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No categories yet</h3>
            <p className="text-slate-500 max-w-sm mb-6">Create your first category to start adding menu items.</p>
            <Button onClick={() => openModal()}>Create Category</Button>
          </CardContent>
        </Card>
      ) : (
        <div>
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={categories.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {categories.map((cat) => (
                <SortableCategoryItem 
                  key={cat.id} 
                  cat={cat} 
                  onToggleActive={handleToggleActive}
                  onEdit={() => openModal(cat)}
                  onDelete={setCategoryToDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingCat ? "Edit Category" : "Add New Category"}
      >
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <Input
            label="Category Name"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="e.g. Starters, Main Course"
            required
            autoFocus
          />
          
          <div className="pt-2">
            <Switch
              checked={formData.is_active}
              onChange={(c) => setFormData({...formData, is_active: c})}
              label="Visible on public menu"
              description="Turn off to hide this category from your customers"
              className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Save Category</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Category"
        message="Are you sure you want to delete this category? All items inside will also be deleted. This action cannot be undone."
        confirmText="Delete Category"
        isLoading={isDeleting}
      />

      <ConfirmModal
        isOpen={showDeleteAllConfirm}
        onClose={() => setShowDeleteAllConfirm(false)}
        onConfirm={handleDeleteAll}
        title="Delete All Categories"
        message="Are you sure you want to delete ALL categories? This will permanently remove every category and all menu items inside them. This action cannot be undone."
        confirmText="Delete All"
        isLoading={isDeletingAll}
      />
      
      {/* FAB for Add Category */}
      {!isModalOpen && createPortal(
        <button
          onClick={() => openModal()}
          className="fixed bottom-20 lg:bottom-8 right-4 lg:right-8 z-50 w-14 h-14 rounded-full bg-primary hover:bg-primary-600 hover:scale-105 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center text-white transition-all duration-200"
        >
          <Plus size={24} />
        </button>,
        document.body
      )}
    </div>
  );
}

