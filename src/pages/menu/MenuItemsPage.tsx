import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, Search, Filter, Image as ImageIcon, Star, Flame, LayoutGrid, List } from 'lucide-react';
import { api } from '@/services/api';
import { useShopStore } from '@/store/shopStore';
import { MenuItem } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Lightbox } from '@/components/ui/Lightbox';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export function MenuItemsPage() {
  const { menuItems, setMenuItems, categories, setCategories } = useShopStore();
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [imageToDelete, setImageToDelete] = useState<{itemId: string, imageId: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  
  const defaultForm = {
    category_id: '',
    name: '',
    description: '',
    price: '',
    offer_price: '',
    food_type: 'veg',
    is_bestseller: false,
    is_highlighted: false,
    is_available: true
  };
  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [catRes, itemRes] = await Promise.all([
        api.get('/categories'),
        api.get('/menu-items')
      ]);
      setCategories(catRes.data);
      setMenuItems(itemRes.data);
    } catch (error) {
      toast.error('Failed to load menu items');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeTab === 'all' || item.category_id === activeTab;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    if (a.is_highlighted && !b.is_highlighted) return -1;
    if (!a.is_highlighted && b.is_highlighted) return 1;
    return 0;
  });

  const openModal = (item?: MenuItem) => {
    if (categories.length === 0) {
      toast.error('Please create a category first');
      return;
    }

    if (item) {
      setEditingItem(item);
      setFormData({
        category_id: item.category_id,
        name: item.name,
        description: item.description || '',
        price: item.price,
        offer_price: item.offer_price || '',
        food_type: item.food_type,
        is_bestseller: item.is_bestseller,
        is_highlighted: item.is_highlighted,
        is_available: item.is_available
      });
    } else {
      setEditingItem(null);
      setFormData({ 
        ...defaultForm, 
        category_id: activeTab !== 'all' ? activeTab : categories[0]?.id || '' 
      });
    }
    setPendingImages([]);
    setCurrentStep(1);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentStep < 3) {
      if (currentStep === 1 && (!formData.name.trim() || !formData.category_id)) {
        toast.error('Please fill required fields');
        return;
      }
      if (currentStep === 2 && !formData.price) {
        toast.error('Please provide a regular price');
        return;
      }
      setCurrentStep(prev => prev + 1);
      return;
    }

    if (!formData.name.trim() || !formData.price || !formData.category_id) {
      toast.error('Please fill required fields');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        offer_price: formData.offer_price ? parseFloat(formData.offer_price) : null
      };

      if (editingItem) {
        await api.put(`/menu-items/${editingItem.id}`, payload);
        toast.success('Menu updated');
      } else {
        const res = await api.post('/menu-items', payload);
        
        if (pendingImages.length > 0) {
          toast.loading('Uploading images...', { id: 'upload-toast' });
          for (let i = 0; i < pendingImages.length; i++) {
            const fd = new FormData();
            fd.append('file', pendingImages[i]);
            fd.append('folder', 'items');
            fd.append('item_id', res.data.id);
            fd.append('is_primary', i === 0 ? 'true' : 'false');
            try {
              await api.post('/upload/image', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
            } catch (err) {
              console.error('Failed to upload image', err);
            }
          }
          toast.dismiss('upload-toast');
        }
        
        toast.success('Menu created');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/menu-items/${itemToDelete}`);
      toast.success('Item deleted');
      setMenuItems(menuItems.filter(i => i.id !== itemToDelete));
      setItemToDelete(null);
    } catch (error) {
      toast.error('Failed to delete item');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const handleQuickToggle = async (item: MenuItem, field: 'is_available' | 'is_bestseller' | 'is_highlighted') => {
    try {
      const newValue = !item[field];
      await api.put(`/menu-items/${item.id}`, { [field]: newValue });
      setMenuItems(menuItems.map(i => i.id === item.id ? { ...i, [field]: newValue } : i));
    } catch (error) {
      toast.error(`Failed to update ${field}`);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading">Menu Items</h2>
          <p className="text-slate-500">Add and manage your menus.</p>
        </div>
      </div>

      {/* Filters & Tabs */}
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar w-full md:w-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
              activeTab === 'all' 
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            All Items ({menuItems.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                activeTab === cat.id 
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' 
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              {cat.name} ({menuItems.filter(item => item.category_id === cat.id).length})
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex-1 relative min-w-0 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search menus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-full border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-900 dark:border-slate-700"
            />
          </div>
          <div className="flex bg-white border border-slate-200 rounded-lg p-1 dark:bg-slate-900 dark:border-slate-700 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
              title="Grid View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
              title="List View"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Filter className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No items found</h3>
            <p className="text-slate-500 max-w-sm mb-6">
              {searchQuery ? `No menus match "${searchQuery}"` : "You haven't added any menus to this category yet."}
            </p>
            {categories.length > 0 ? (
              <Button onClick={() => openModal()} variant="secondary">Add First Menu</Button>
            ) : (
              <p className="text-sm text-primary font-medium">Please create a category first to add menus.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {filteredItems.map(item => {
            const categoryName = categories.find(c => c.id === item.category_id)?.name || 'Unknown';
            
            return (
              <Card key={item.id} className={`flex ${viewMode === 'grid' ? 'flex-col' : 'flex-row'} overflow-hidden transition-all hover:shadow-md ${!item.is_available ? 'opacity-70 grayscale-[30%]' : ''}`}>
                <div className={`${viewMode === 'grid' ? 'h-32' : 'w-32 sm:w-40 shrink-0'} bg-slate-100 dark:bg-slate-800 relative`}>
                  {item.image_url ? (
                    <img 
                      src={item.image_url} 
                      alt={item.name} 
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setLightboxImage(item.image_url!)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon size={32} />
                    </div>
                  )}
                  {/* Tags */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1 z-20">
                    {item.is_highlighted && (
                      <div className="bg-primary text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center animate-pulse">
                        <Flame size={10} className="mr-0.5" /> Chef's Special
                      </div>
                    )}
                    {item.is_bestseller && (
                      <div className="bg-amber-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center">
                        <Star size={10} className="mr-0.5 fill-white" /> Bestseller
                      </div>
                    )}
                  </div>
                  
                  {/* Veg/Non-veg mark */}
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-0.5 rounded shadow-sm z-20">
                    {item.food_type === 'veg' ? (
                      <span className="w-3 h-3 border border-green-600 rounded-[2px] flex items-center justify-center">
                        <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                      </span>
                    ) : (
                      <span className="w-3 h-3 border border-red-600 rounded-[2px] flex items-center justify-center">
                        <span className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[5px] border-transparent border-b-red-600"></span>
                      </span>
                    )}
                  </div>
                </div>
                
                <CardContent className={`flex-1 flex flex-col ${viewMode === 'grid' ? 'p-3 sm:p-4' : 'p-3 sm:p-4'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-1" title={item.name}>{item.name}</h3>
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-sm sm:text-base text-primary whitespace-nowrap">₹{item.offer_price || item.price}</span>
                      {item.offer_price && (
                        <span className="text-xs text-slate-400 line-through">₹{item.price}</span>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-xs text-primary-600 dark:text-primary-400 mb-1 sm:mb-2">{categoryName}</p>
                  
                  <p className={`text-xs text-slate-500 line-clamp-2 ${viewMode === 'grid' ? 'mb-3 sm:mb-4' : 'mb-2 sm:mb-3'} flex-1`}>
                    {item.description || 'No description provided.'}
                  </p>
                  
                  <div className="pt-2 sm:pt-3 mt-auto border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleQuickToggle(item, 'is_available')}
                        className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                          item.is_available 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {item.is_available ? 'In Stock' : 'Out of Stock'}
                      </button>
                      <button
                        onClick={() => handleQuickToggle(item, 'is_bestseller')}
                        className={`p-1.5 rounded transition-colors ${
                          item.is_bestseller 
                            ? 'bg-amber-100 text-amber-600 hover:bg-amber-200 dark:bg-amber-900/30' 
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800'
                        }`}
                        title="Toggle Bestseller"
                      >
                        <Star size={14} className={item.is_bestseller ? 'fill-amber-600' : ''} />
                      </button>
                      <button
                        onClick={() => handleQuickToggle(item, 'is_highlighted')}
                        className={`p-1.5 rounded transition-colors ${
                          item.is_highlighted 
                            ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800'
                        }`}
                        title="Toggle Highlight"
                      >
                        <Flame size={14} className={item.is_highlighted ? 'fill-primary' : ''} />
                      </button>
                    </div>
                    
                    <div className="flex gap-1">
                      <button 
                        onClick={() => openModal(item)}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary rounded transition-colors dark:hover:bg-slate-800"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded transition-colors dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Edit Menu" : "Add New Menu"}
        className="max-w-xl"
      >
        <div className="mt-4">
          {/* Step Indicator */}
          <div className="flex items-center justify-between mb-8 relative max-w-sm mx-auto">
            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-200 dark:bg-slate-800 -z-10" />
            
            {[1, 2, 3].map(step => (
              <div 
                key={step} 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  currentStep >= step 
                    ? 'bg-primary text-white ring-4 ring-white dark:ring-slate-950' 
                    : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 ring-4 ring-white dark:ring-slate-950'
                }`}
              >
                {step}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {currentStep === 1 && (
              <div className="space-y-4 animate-fade-in">
                <Input
                  label="Menu Name *"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Chicken Biryani"
                  required
                />
                
                <div className="space-y-1.5 text-left">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category *</label>
                  <SearchableSelect
                    options={categories.map(c => ({ id: c.id, name: c.name }))}
                    value={formData.category_id}
                    onChange={(val) => setFormData({...formData, category_id: val})}
                    placeholder="Select a category"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Short description of ingredients..."
                    className="flex w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-slate-900 min-h-[100px] resize-y"
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Regular Price *"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    placeholder="0.00"
                    required
                  />
                  <Input
                    label="Offer Price (Opt)"
                    type="number"
                    step="0.01"
                    value={formData.offer_price}
                    onChange={(e) => setFormData({...formData, offer_price: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-1.5 text-left pt-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Dietary Type</label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl h-11">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, food_type: 'veg'})}
                      className={`flex-1 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${formData.food_type === 'veg' ? 'bg-white text-green-700 shadow-sm dark:bg-slate-700 dark:text-green-400' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      <span className="w-3 h-3 border border-green-600 rounded-sm flex items-center justify-center"><span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span></span> Veg
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, food_type: 'non-veg'})}
                      className={`flex-1 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${formData.food_type === 'non-veg' ? 'bg-white text-red-700 shadow-sm dark:bg-slate-700 dark:text-red-400' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      <span className="w-3 h-3 border border-red-600 rounded-sm flex items-center justify-center"><span className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[5px] border-transparent border-b-red-600"></span></span> Non-Veg
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 gap-4">
                  <Switch
                    checked={formData.is_available}
                    onChange={(c) => setFormData({...formData, is_available: c})}
                    label="Item is Available"
                    description="Toggle off to mark as out of stock"
                    className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  />
                  <Switch
                    checked={formData.is_bestseller}
                    onChange={(c) => setFormData({...formData, is_bestseller: c})}
                    label={<span className="flex items-center"><Star size={14} className="text-amber-500 mr-1" /> Mark as Bestseller</span>}
                    description="Adds a badge for popular items"
                    className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  />
                  <Switch
                    checked={formData.is_highlighted}
                    onChange={(c) => setFormData({...formData, is_highlighted: c})}
                    label={<span className="flex items-center"><Flame size={14} className="text-primary mr-1" /> Highlight Item</span>}
                    description="Shows at the top with special effects"
                    className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  />
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 mt-4 text-sm">
                  <div className="flex justify-between items-center mb-3">
                    <span className="flex items-center font-medium text-slate-900 dark:text-white">
                      <ImageIcon size={16} className="mr-2 text-slate-500"/> Product Images
                    </span>
                    {(!editingItem ? pendingImages.length : (editingItem.images?.length || 0)) < 4 ? (
                      <label className="cursor-pointer text-xs font-medium bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-400 px-3 py-1.5 rounded-full transition-colors">
                        Upload New
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            if (editingItem) {
                              if (editingItem.images && editingItem.images.length >= 4) {
                                toast.error('Maximum 4 images allowed per item');
                                return;
                              }
                              
                              const fd = new FormData();
                              fd.append('file', file);
                              fd.append('folder', 'items');
                              fd.append('item_id', editingItem.id);
                              fd.append('is_primary', (!editingItem.images || editingItem.images.length === 0) ? 'true' : 'false');
                              
                              try {
                                const toastId = toast.loading('Uploading image...');
                                await api.post('/upload/image', fd, {
                                  headers: { 'Content-Type': 'multipart/form-data' }
                                });
                                toast.success('Image uploaded successfully', { id: toastId });
                                fetchData();
                                const res = await api.get(`/menu-items/${editingItem.id}`);
                                setEditingItem(res.data);
                              } catch (error: any) {
                                toast.error(error.response?.data?.detail || 'Failed to upload image');
                              }
                            } else {
                              if (pendingImages.length >= 4) {
                                toast.error('Maximum 4 images allowed per item');
                                return;
                              }
                              setPendingImages([...pendingImages, file]);
                            }
                          }}
                        />
                      </label>
                    ) : (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                        Limit Reached (4/4)
                      </span>
                    )}
                  </div>
                  
                  {editingItem && editingItem.images && editingItem.images.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {editingItem.images.map(img => (
                        <div key={img.id} className="w-full h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 relative group">
                          <img 
                            src={img.image_url} 
                            alt="" 
                            className="w-full h-full object-cover cursor-pointer" 
                            onClick={() => setLightboxImage(img.image_url)}
                          />
                          <div className="absolute inset-0 bg-black/40 lg:bg-black/60 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            {!img.is_primary && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await api.put(`/menu-items/${editingItem.id}/images/${img.id}/primary`);
                                    toast.success('Primary image updated');
                                    const res = await api.get(`/menu-items/${editingItem.id}`);
                                    setEditingItem(res.data);
                                    fetchData();
                                  } catch (err) {
                                    toast.error('Failed to update primary image');
                                  }
                                }}
                                className="p-1.5 bg-white/20 hover:bg-white/40 rounded text-white"
                                title="Set as Primary"
                              >
                                <Star size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setImageToDelete({ itemId: editingItem.id, imageId: img.id });
                              }}
                              className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded text-white"
                              title="Delete Image"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {img.is_primary && (
                            <div className="absolute top-1 left-1 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                              Primary
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (!editingItem && pendingImages.length > 0) ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {pendingImages.map((file, idx) => (
                        <div key={idx} className="w-full h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 relative group">
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt="" 
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-black/40 lg:bg-black/60 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPendingImages(pendingImages.filter((_, i) => i !== idx));
                              }}
                              className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded text-white"
                              title="Delete Image"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {idx === 0 && (
                            <div className="absolute top-1 left-1 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                              Primary
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                      No images uploaded yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 mt-6 border-t border-slate-100 dark:border-slate-800">
              <Button 
                variant="secondary" 
                type="button" 
                onClick={() => {
                  if (currentStep > 1) setCurrentStep(currentStep - 1);
                  else setIsModalOpen(false);
                }}
              >
                {currentStep > 1 ? 'Back' : 'Cancel'}
              </Button>
              
              {currentStep < 3 ? (
                <Button 
                  type="submit"
                >
                  Next Step
                </Button>
              ) : (
                <Button type="submit" isLoading={isSubmitting}>
                  Save Menu
                </Button>
              )}
            </div>
          </form>
        </div>
      </Modal>
      
      {/* FAB for Add Dish */}
      {createPortal(
        <button
          onClick={() => openModal()}
          className="fixed bottom-20 lg:bottom-8 right-4 lg:right-8 z-50 w-14 h-14 rounded-full bg-primary hover:bg-primary-600 hover:scale-105 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center text-white transition-all duration-200"
        >
          <Plus size={24} />
        </button>,
        document.body
      )}

      <ConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDeleteItem}
        title="Delete Menu Item"
        message="Are you sure you want to delete this menu? This action cannot be undone."
        confirmText="Delete Menu"
        isLoading={isDeleting}
      />

      <ConfirmModal
        isOpen={!!imageToDelete}
        onClose={() => setImageToDelete(null)}
        onConfirm={async () => {
          if (!imageToDelete) return;
          setIsDeleting(true);
          try {
            await api.delete(`/menu-items/${imageToDelete.itemId}/images/${imageToDelete.imageId}`);
            toast.success('Image deleted');
            const res = await api.get(`/menu-items/${imageToDelete.itemId}`);
            setEditingItem(res.data);
            fetchData();
            setImageToDelete(null);
          } catch (err) {
            toast.error('Failed to delete image');
          } finally {
            setIsDeleting(false);
          }
        }}
        title="Delete Image"
        message="Are you sure you want to delete this image?"
        confirmText="Delete Image"
        isLoading={isDeleting}
      />

      <Lightbox 
        isOpen={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
        imageUrl={lightboxImage || ''}
      />
    </div>
  );
}
