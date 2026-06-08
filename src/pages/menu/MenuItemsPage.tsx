import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, Search, Filter, Image as ImageIcon, Star, Flame, LayoutGrid, List, Sparkles, Wand2, Loader2, MessageSquare, Check, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';
import { useShopStore } from '@/store/shopStore';
import { MenuItem, MenuItemVariant, MenuItemAddon } from '@/types';
import { ReviewSummary } from '@/types';
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
  const [isFabOpen, setIsFabOpen] = useState(false);
  
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
  const [autoImageLoadingId, setAutoImageLoadingId] = useState<string | null>(null);
  const [reviewsModal, setReviewsModal] = useState<{ item: MenuItem; summary: ReviewSummary | null } | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingImageUrls, setPendingImageUrls] = useState<string[]>([]);
  const [searchImagesModal, setSearchImagesModal] = useState<{ name: string, urls: string[] } | null>(null);
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([]);
  const [isSavingVariant, setIsSavingVariant] = useState(false);
  
  const defaultForm = {
    category_id: '',
    name: '',
    description: '',
    price: '',
    offer_price: '',
    food_types: ['veg'],
    is_bestseller: false,
    is_highlighted: false,
    is_available: true,
    variants: [] as MenuItemVariant[],
    addons: [] as MenuItemAddon[],
    allow_ice_preference: false,
    available_days: [] as string[],
    available_time_presets: [] as string[],
    custom_time_from: '',
    custom_time_to: ''
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

  const handleViewReviews = async (item: MenuItem) => {
    setReviewsModal({ item, summary: null });
    setIsLoadingReviews(true);
    try {
      const res = await api.get(`/menu-items/${item.id}/reviews`);
      setReviewsModal({ item, summary: res.data });
    } catch {
      toast.error('Failed to load reviews');
      setReviewsModal(null);
    } finally {
      setIsLoadingReviews(false);
    }
  };

  const handleSearchImages = async (item?: MenuItem) => {
    const itemName = item ? item.name : formData.name;
    if (!itemName.trim()) {
      toast.error('Please enter a menu name first to search for images.');
      return;
    }
    const currentId = item ? item.id : 'new';
    if (autoImageLoadingId) return;
    setAutoImageLoadingId(currentId);
    try {
      const res = await api.get(`/menu-items/search-images-by-name?q=${encodeURIComponent(itemName)}`);
      const urls = res.data.urls || [];
      if (urls.length === 0) {
        toast.error('No images found for this item.');
      } else {
        setSearchImagesModal({ name: itemName, urls });
        setSelectedImageUrls([]);
      }
    } catch (err: any) {
      toast.error('Could not find an image. Try again.');
    } finally {
      setAutoImageLoadingId(null);
    }
  };

  const handleConfirmImageSelection = async () => {
    if (!searchImagesModal || selectedImageUrls.length === 0) return;
    
    setIsSavingVariant(true);
    try {
      if (editingItem) {
        let newImages: any[] = [];
        let hasError = false;
        let errorMsg = '';
        
        for (const url of selectedImageUrls) {
           try {
             const res = await api.post(`/menu-items/${editingItem.id}/save-image-url`, { url });
             newImages.push(res.data);
           } catch (e: any) {
             hasError = true;
             errorMsg = e?.response?.data?.detail || 'Failed to process images.';
             break;
           }
        }
        
        if (newImages.length > 0) {
          setMenuItems(menuItems.map(m => {
            if (m.id === editingItem.id) {
              const currentImages = m.images || [];
              return { 
                ...m, 
                image_url: currentImages.length === 0 && newImages.length > 0 ? newImages[0].image_url : m.image_url, 
                thumbnail_url: currentImages.length === 0 && newImages.length > 0 ? newImages[0].thumbnail_url : m.thumbnail_url,
                images: [...currentImages, ...newImages] 
              };
            }
            return m;
          }));
          setEditingItem(prev => {
            if (!prev) return prev;
            return { ...prev, images: [...(prev.images || []), ...newImages] };
          });
        }
        
        if (hasError) {
          if (errorMsg.includes("Could not download") || errorMsg.includes("Failed to save image")) {
            toast.error("That image couldn't be downloaded. Please choose a different image or hit Regenerate.");
          } else {
            toast.error(errorMsg);
          }
        } else {
          toast.success(`Successfully saved ${newImages.length} image(s)!`);
        }
      } else {
        setPendingImageUrls([...pendingImageUrls, ...selectedImageUrls]);
        toast.success(`Added ${selectedImageUrls.length} image(s) to selection`);
      }
      setSearchImagesModal(null);
    } finally {
      setIsSavingVariant(false);
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
        food_types: item.food_types || [],
        is_bestseller: item.is_bestseller,
        is_highlighted: item.is_highlighted,
        is_available: item.is_available,
        variants: item.variants || [],
        addons: item.addons || [],
        allow_ice_preference: item.allow_ice_preference || false,
        available_days: item.available_days || [],
        available_time_presets: item.available_time_presets || [],
        custom_time_from: item.custom_time_from || '',
        custom_time_to: item.custom_time_to || ''
      });
    } else {
      setEditingItem(null);
      setFormData({ 
        ...defaultForm, 
        category_id: activeTab !== 'all' ? activeTab : categories[0]?.id || '' 
      });
    }
    setPendingImages([]);
    setPendingImageUrls([]);
    setCurrentStep(1);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const hasVariants = formData.variants && formData.variants.length > 0;
    const basePrice = hasVariants ? formData.variants[0].price : formData.price;
    const baseOfferPrice = hasVariants ? formData.variants[0].offer_price : formData.offer_price;
    
    if (currentStep < 4) {
      if (currentStep === 1 && (!formData.name.trim() || !formData.category_id)) {
        toast.error('Please fill required fields');
        return;
      }
      if (currentStep === 2 && !basePrice) {
        toast.error('Please provide a regular price or add variants');
        return;
      }
      setCurrentStep(prev => prev + 1);
      return;
    }

    if (!formData.name.trim() || !basePrice || !formData.category_id) {
      toast.error('Please fill required fields');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        price: parseFloat(basePrice),
        offer_price: baseOfferPrice ? parseFloat(baseOfferPrice) : null
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
        
        if (pendingImageUrls.length > 0) {
          toast.loading('Saving selected images...', { id: 'save-url-toast' });
          for (let i = 0; i < pendingImageUrls.length; i++) {
             try {
               await api.post(`/menu-items/${res.data.id}/save-image-url`, { url: pendingImageUrls[i] });
             } catch (err) {
               console.error('Failed to save image url', err);
             }
          }
          toast.dismiss('save-url-toast');
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
                    <div className="relative w-full h-full group/img">
                      <img 
                        src={item.image_url} 
                        alt={item.name} 
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setLightboxImage(item.image_url!)}
                      />
                      <div className="absolute inset-0 m-auto flex items-center justify-center gap-3 opacity-100 sm:opacity-0 sm:group-hover/img:opacity-100 transition-opacity duration-200 bg-black/20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(item);
                          }}
                          className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-700 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
                          title="Edit Item"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id);
                          }}
                          className="w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-900/20 transition-transform hover:scale-105"
                          title="Delete Item"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-900 text-slate-300 group/noimg">
                      <ImageIcon size={24} className="group-hover/noimg:opacity-0 transition-opacity duration-200" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-100 sm:opacity-0 sm:group-hover/noimg:opacity-100 transition-all duration-200 bg-black/40 rounded-t-xl z-10">
                        <div className="flex gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(item);
                            }}
                            className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-700 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
                            title="Edit Item"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }}
                            className="w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-900/20 transition-transform hover:scale-105"
                            title="Delete Item"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSearchImages(item);
                          }}
                          disabled={autoImageLoadingId === item.id}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-600 text-white rounded-full text-xs font-semibold shadow-md"
                          title="Auto-find an image for this item"
                        >
                          {autoImageLoadingId === item.id ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              <span>Searching...</span>
                            </>
                          ) : (
                            <>
                              <Wand2 size={14} />
                              <span>Find Image</span>
                            </>
                          )}
                        </button>
                      </div>
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
                  <div className="absolute top-2 right-2 flex flex-col gap-1 z-20">
                    {item.food_types?.map((type) => (
                      <div key={type} className="bg-white/90 backdrop-blur-sm p-0.5 rounded shadow-sm">
                        {type === 'veg' ? (
                          <span className="w-3 h-3 border border-green-600 rounded-[2px] flex items-center justify-center" title="Veg">
                            <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                          </span>
                        ) : type === 'egg' ? (
                          <span className="w-3 h-3 border border-yellow-600 rounded-[2px] flex items-center justify-center" title="Egg">
                            <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></span>
                          </span>
                        ) : type === 'drink' ? (
                          <span className="w-3 h-3 border border-blue-600 rounded-[2px] flex items-center justify-center" title="Drink">
                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                          </span>
                        ) : type === 'dessert' ? (
                          <span className="w-3 h-3 border border-pink-500 rounded-[2px] flex items-center justify-center" title="Dessert">
                            <span className="w-1.5 h-1.5 bg-pink-500 rounded-[1px]"></span>
                          </span>
                        ) : type === 'non-veg' ? (
                          <span className="w-3 h-3 border border-red-600 rounded-[2px] flex items-center justify-center" title="Non-Veg">
                            <span className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[5px] border-transparent border-b-red-600"></span>
                          </span>
                        ) : null}
                      </div>
                    ))}
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
                  
                  <div className="pt-2 sm:pt-3 mt-auto border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 justify-between items-center">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => handleQuickToggle(item, 'is_available')}
                        className={`text-xs px-2 py-1 rounded font-medium transition-colors whitespace-nowrap ${
                          item.is_available 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {item.is_available ? 'In Stock' : 'Out of Stock'}
                      </button>
                      <button
                        onClick={() => handleQuickToggle(item, 'is_bestseller')}
                        className={`p-1.5 rounded transition-colors shrink-0 ${
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
                        className={`p-1.5 rounded transition-colors shrink-0 ${
                          item.is_highlighted 
                            ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800'
                        }`}
                        title="Toggle Highlight"
                      >
                        <Flame size={14} className={item.is_highlighted ? 'fill-primary' : ''} />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-1 flex-wrap shrink-0">
                      {/* Rating badge */}
                      {item.average_rating && item.average_rating > 0 ? (
                        <button
                          onClick={() => handleViewReviews(item)}
                          className="p-1.5 flex items-center gap-0.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded transition-colors text-xs font-semibold shrink-0"
                          title="View Reviews"
                        >
                          <Star size={12} className="fill-amber-500" />
                          {item.average_rating.toFixed(1)}
                          <span className="opacity-60 text-[10px]">({item.review_count})</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleViewReviews(item)}
                          className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors shrink-0"
                          title="View Reviews"
                        >
                          <MessageSquare size={14} />
                        </button>
                      )}
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
            
            {[1, 2, 3, 4].map(step => {
              const isClickable = !!editingItem;
              return (
                <button 
                  key={step} 
                  type="button"
                  onClick={() => isClickable && setCurrentStep(step)}
                  disabled={!isClickable}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    currentStep >= step 
                      ? 'bg-primary text-white ring-4 ring-white dark:ring-slate-950' 
                      : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 ring-4 ring-white dark:ring-slate-950'
                  } ${isClickable ? 'cursor-pointer hover:scale-105 shadow-sm' : 'cursor-default'}`}
                >
                  {step}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="mt-2 flex flex-col h-[450px] sm:h-[500px]">
            <div className="flex-1 overflow-y-auto px-1 space-y-5 no-scrollbar pb-4">
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
                {formData.variants.length === 0 && (
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
                )}
                
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Variants (e.g. Sizes)</label>
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, variants: [...formData.variants, { name: '', price: '', offer_price: '' }]})}
                      className="text-xs text-primary hover:text-primary-600 font-medium flex items-center"
                    >
                      <Plus size={14} className="mr-1"/> Add Variant
                    </button>
                  </div>
                  {formData.variants.map((v, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex-1 space-y-3">
                        <Input 
                          label="Variant Name" 
                          placeholder="e.g. 500ml" 
                          value={v.name} 
                          onChange={(e) => {
                            const newV = [...formData.variants];
                            newV[idx].name = e.target.value;
                            setFormData({...formData, variants: newV});
                          }} 
                          required 
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input 
                            label="Price" 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            value={v.price} 
                            onChange={(e) => {
                              const newV = [...formData.variants];
                              newV[idx].price = e.target.value;
                              setFormData({...formData, variants: newV});
                            }} 
                            required 
                          />
                          <Input 
                            label="Offer Price" 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            value={v.offer_price || ''} 
                            onChange={(e) => {
                              const newV = [...formData.variants];
                              newV[idx].offer_price = e.target.value || null;
                              setFormData({...formData, variants: newV});
                            }} 
                          />
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => {
                          const newV = [...formData.variants];
                          newV.splice(idx, 1);
                          setFormData({...formData, variants: newV});
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 mt-6"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>


                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Add-ons (Optional)</h4>
                      <p className="text-xs text-slate-500">Optional extras that increase the price (e.g. Extra Cheese +20)</p>
                    </div>
                    <Button 
                      type="button" 
                      variant="secondary" 
                      size="sm"
                      onClick={() => setFormData({
                        ...formData, 
                        addons: [...formData.addons, { name: '', price: '' }]
                      })}
                    >
                      <Plus size={16} className="mr-1.5" /> Add Option
                    </Button>
                  </div>
                  
                  {formData.addons.map((addon, idx) => (
                    <div key={`addon-${idx}`} className="flex gap-3 items-start mb-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">Add-on Name</label>
                          <Input 
                            placeholder="e.g. With Ice" 
                            value={addon.name} 
                            onChange={(e) => {
                              const newA = [...formData.addons];
                              newA[idx].name = e.target.value;
                              setFormData({...formData, addons: newA});
                            }} 
                            required 
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">Additional Price</label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            value={addon.price} 
                            onChange={(e) => {
                              const newA = [...formData.addons];
                              newA[idx].price = e.target.value;
                              setFormData({...formData, addons: newA});
                            }} 
                            required 
                          />
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => {
                          const newA = [...formData.addons];
                          newA.splice(idx, 1);
                          setFormData({...formData, addons: newA});
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 mt-6"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 text-left pt-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Dietary Type</label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl h-auto flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, food_types: formData.food_types.includes('veg') ? formData.food_types.filter(t => t !== 'veg') : [...formData.food_types, 'veg']})}
                      className={`flex-1 min-w-[80px] p-2 rounded-lg text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1.5 ${formData.food_types.includes('veg') ? 'bg-white text-green-700 shadow-sm dark:bg-slate-700 dark:text-green-400' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      <span className="w-3 h-3 border border-green-600 rounded-[2px] flex items-center justify-center shrink-0"><span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span></span> Veg
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, food_types: formData.food_types.includes('non-veg') ? formData.food_types.filter(t => t !== 'non-veg') : [...formData.food_types, 'non-veg']})}
                      className={`flex-1 min-w-[80px] p-2 rounded-lg text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1.5 ${formData.food_types.includes('non-veg') ? 'bg-white text-red-700 shadow-sm dark:bg-slate-700 dark:text-red-400' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      <span className="w-3 h-3 border border-red-600 rounded-[2px] flex items-center justify-center shrink-0"><span className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[5px] border-transparent border-b-red-600"></span></span> Non-Veg
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, food_types: formData.food_types.includes('egg') ? formData.food_types.filter(t => t !== 'egg') : [...formData.food_types, 'egg']})}
                      className={`flex-1 min-w-[80px] p-2 rounded-lg text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1.5 ${formData.food_types.includes('egg') ? 'bg-white text-yellow-600 shadow-sm dark:bg-slate-700 dark:text-yellow-400' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      <span className="w-3 h-3 border border-yellow-500 rounded-[2px] flex items-center justify-center shrink-0"><span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span></span> Egg
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, food_types: formData.food_types.includes('drink') ? formData.food_types.filter(t => t !== 'drink') : [...formData.food_types, 'drink']})}
                      className={`flex-1 min-w-[80px] p-2 rounded-lg text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1.5 ${formData.food_types.includes('drink') ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      <span className="w-3 h-3 border border-blue-500 rounded-full flex items-center justify-center shrink-0"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span></span> Drink
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, food_types: formData.food_types.includes('dessert') ? formData.food_types.filter(t => t !== 'dessert') : [...formData.food_types, 'dessert']})}
                      className={`flex-1 min-w-[80px] p-2 rounded-lg text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1.5 ${formData.food_types.includes('dessert') ? 'bg-white text-pink-600 shadow-sm dark:bg-slate-700 dark:text-pink-400' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      <span className="w-3 h-3 border border-pink-500 rounded-sm flex items-center justify-center shrink-0"><span className="w-1.5 h-1.5 bg-pink-500 rounded-[1px]"></span></span> Dessert
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, food_types: formData.food_types.includes('none') ? formData.food_types.filter(t => t !== 'none') : [...formData.food_types, 'none']})}
                      className={`flex-1 min-w-[80px] p-2 rounded-lg text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1.5 ${formData.food_types.includes('none') ? 'bg-white text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      None
                    </button>
                  </div>
                  
                  {formData.food_types.includes('drink') && (
                    <div className="pt-3">
                      <Switch
                        checked={formData.allow_ice_preference}
                        onChange={(c) => setFormData({...formData, allow_ice_preference: c})}
                        label="Allow Ice Preference"
                        description="Ask customer for With/Without Ice"
                        className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      />
                    </div>
                  )}
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
                    <div className="flex gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => handleSearchImages(editingItem || undefined)}
                        disabled={autoImageLoadingId === (editingItem?.id || 'new')}
                        className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
                      >
                        {autoImageLoadingId === (editingItem?.id || 'new') ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Wand2 size={14} />
                        )}
                        Auto-find
                      </button>
                      {(!editingItem ? (pendingImages.length + pendingImageUrls.length) : (editingItem.images?.length || 0)) < 4 ? (
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
                  ) : (!editingItem && (pendingImages.length > 0 || pendingImageUrls.length > 0)) ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {pendingImages.map((file, idx) => (
                        <div key={`file-${idx}`} className="w-full h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 relative group">
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
                          {idx === 0 && pendingImageUrls.length === 0 && (
                            <div className="absolute top-1 left-1 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                              Primary
                            </div>
                          )}
                        </div>
                      ))}
                      {pendingImageUrls.map((url, idx) => (
                        <div key={`url-${idx}`} className="w-full h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 relative group">
                          <img 
                            src={url} 
                            alt="" 
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-black/40 lg:bg-black/60 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPendingImageUrls(pendingImageUrls.filter((_, i) => i !== idx));
                              }}
                              className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded text-white"
                              title="Delete Image"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {idx === 0 && pendingImages.length === 0 && (
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

            {currentStep === 4 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Available Days</h4>
                  <p className="text-xs text-slate-500 mb-3">Leave all unchecked if available every day.</p>
                  <div className="flex flex-wrap gap-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                      const isSelected = formData.available_days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setFormData({ ...formData, available_days: formData.available_days.filter(d => d !== day) });
                            } else {
                              setFormData({ ...formData, available_days: [...formData.available_days, day] });
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                            isSelected 
                              ? 'bg-primary border-primary text-white' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Timing Presets</h4>
                  <p className="text-xs text-slate-500 mb-3">Leave all unchecked if available all day.</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'Early Morning', label: 'Early Morning (04:00 - 08:00)' },
                      { id: 'Morning', label: 'Morning (08:00 - 12:00)' },
                      { id: 'Afternoon', label: 'Afternoon (12:00 - 16:00)' },
                      { id: 'Evening', label: 'Evening (16:00 - 20:00)' },
                      { id: 'Night', label: 'Night (20:00 - 00:00)' },
                      { id: 'Mid-night', label: 'Mid-night (00:00 - 04:00)' }
                    ].map(preset => {
                      const isSelected = formData.available_time_presets.includes(preset.id);
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setFormData({ ...formData, available_time_presets: formData.available_time_presets.filter(p => p !== preset.id) });
                            } else {
                              setFormData({ ...formData, available_time_presets: [...formData.available_time_presets, preset.id] });
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                            isSelected 
                              ? 'bg-primary border-primary text-white' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Custom Time From</label>
                    <input 
                      type="time" 
                      value={formData.custom_time_from} 
                      onChange={e => setFormData({ ...formData, custom_time_from: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Custom Time To</label>
                    <input 
                      type="time" 
                      value={formData.custom_time_to} 
                      onChange={e => setFormData({ ...formData, custom_time_to: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
            </div>

            <div className="flex justify-between items-center pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
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
              
              {currentStep < 4 ? (
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

      {/* Reviews Modal */}
      <Modal
        isOpen={!!reviewsModal}
        onClose={() => setReviewsModal(null)}
        title={reviewsModal?.item ? `Reviews for ${reviewsModal.item.name}` : "Reviews"}
        className="max-w-md"
      >
        <div className="mt-4">
          {isLoadingReviews ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 size={32} className="animate-spin mb-4" />
              <p>Loading reviews...</p>
            </div>
          ) : reviewsModal?.summary ? (
            <div className="space-y-6">
              {reviewsModal.summary.total_reviews === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <MessageSquare size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400 font-medium">No reviews yet</p>
                  <p className="text-sm text-slate-400 mt-1">Customers haven't reviewed this item yet.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col items-center">
                      <span className="text-4xl font-bold text-slate-900 dark:text-white">
                        {reviewsModal.summary.average_rating.toFixed(1)}
                      </span>
                      <div className="flex mt-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} size={14} className={s <= Math.round(reviewsModal.summary!.average_rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700 fill-slate-200 dark:fill-slate-700'} />
                        ))}
                      </div>
                      <span className="text-xs text-slate-500 mt-1">{reviewsModal.summary.total_reviews} reviews</span>
                    </div>

                    <div className="flex-1 space-y-1.5">
                      {[5, 4, 3, 2, 1].map(star => {
                        const count = reviewsModal.summary!.rating_distribution[star] || 0;
                        const pct = reviewsModal.summary!.total_reviews ? Math.round((count / reviewsModal.summary!.total_reviews) * 100) : 0;
                        return (
                          <div key={star} className="flex items-center gap-2">
                            <span className="text-xs w-3 text-slate-500 shrink-0">{star}</span>
                            <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />
                            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 w-6 text-right shrink-0">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 no-scrollbar">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white sticky top-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur pb-2">Recent Reviews</h3>
                    {reviewsModal.summary.reviews.map(rev => (
                      <div key={rev.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {rev.reviewer_name}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map(s => (
                                <Star key={s} size={12} className={s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700 fill-slate-200 dark:fill-slate-700'} />
                              ))}
                            </div>
                            <span className="text-xs text-slate-400">{rev.created_at}</span>
                          </div>
                        </div>
                        {rev.comment && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">{rev.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Search Images Modal */}
      <Modal
        isOpen={!!searchImagesModal}
        onClose={() => !isSavingVariant && setSearchImagesModal(null)}
        title="Select Images"
        className="max-w-2xl"
      >
        <div className="mt-4">
          <p className="text-sm text-slate-500 mb-4 flex justify-between">
            <span>Select the best images for <strong className="text-slate-900 dark:text-white">{searchImagesModal?.name}</strong>. (Max 4 total)</span>
            <span className="font-semibold text-primary">{(editingItem ? (editingItem.images?.length || 0) : (pendingImages.length + pendingImageUrls.length)) + selectedImageUrls.length}/4</span>
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-1 custom-scrollbar">
            {searchImagesModal?.urls.map((url, idx) => {
              const isSelected = selectedImageUrls.includes(url);
              return (
                <div 
                  key={idx} 
                  className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group bg-slate-100 dark:bg-slate-800 border-2 transition-all duration-200 ${isSelected ? 'border-primary ring-2 ring-primary ring-offset-1' : 'border-transparent'}`}
                  onClick={() => {
                    const totalSelected = (editingItem ? (editingItem.images?.length || 0) : (pendingImages.length + pendingImageUrls.length)) + selectedImageUrls.length;
                    if (isSelected) {
                      setSelectedImageUrls(selectedImageUrls.filter(u => u !== url));
                    } else {
                      if (totalSelected >= 4) {
                        toast.error('Maximum 4 images allowed per item');
                        return;
                      }
                      setSelectedImageUrls([...selectedImageUrls, url]);
                    }
                  }}
                >
                  <img 
                    src={url} 
                    alt="Variant" 
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const parent = e.currentTarget.parentElement;
                      if (parent) parent.style.display = 'none';
                      if (isSelected) setSelectedImageUrls(prev => prev.filter(u => u !== url));
                    }}
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="bg-primary text-white p-1 rounded-full shadow-lg scale-110 transition-transform">
                        <Check size={24} strokeWidth={3} />
                      </div>
                    </div>
                  )}
                  {!isSelected && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                      <div className="bg-white/90 text-slate-900 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform scale-75 group-hover:scale-100 shadow-xl">
                        <Plus size={20} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="mt-6 flex justify-between gap-3">
            <Button 
              variant="secondary" 
              onClick={async () => {
                try {
                  setIsSavingVariant(true);
                  const res = await api.get(`/menu-items/search-images-by-name?q=${encodeURIComponent(searchImagesModal?.name || '')}`);
                  setSearchImagesModal({ name: searchImagesModal?.name || '', urls: res.data.urls });
                } catch (error) {
                  toast.error('Failed to regenerate images');
                } finally {
                  setIsSavingVariant(false);
                }
              }}
              disabled={isSavingVariant}
            >
              <RefreshCw size={16} className="mr-2" /> Regenerate
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setSearchImagesModal(null)} disabled={isSavingVariant}>
                Cancel
              </Button>
              <Button onClick={handleConfirmImageSelection} disabled={isSavingVariant || selectedImageUrls.length === 0}>
                {isSavingVariant ? <Loader2 size={16} className="animate-spin mr-2" /> : <Check size={16} className="mr-2" />}
                {selectedImageUrls.length > 0 ? `Add ${selectedImageUrls.length} Image(s)` : 'Select Images'}
              </Button>
            </div>
          </div>
          
          {isSavingVariant && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-10">
              <Loader2 size={32} className="animate-spin text-primary mb-3" />
              <p className="text-sm font-medium text-slate-900 dark:text-white shadow-sm">Downloading & Saving...</p>
            </div>
          )}
        </div>
      </Modal>

      {/* FIXED FAB */}
      <div className="fixed bottom-20 lg:bottom-8 right-4 lg:right-8 z-50 flex flex-col items-end gap-3">
        {/* Expanded Actions */}
        <div
          className={`flex flex-col items-end gap-3 transition-all duration-300 ${
            isFabOpen
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="bg-white dark:bg-slate-800 px-3 py-2 rounded-lg shadow text-xs font-medium">
              AI Bulk Upload
            </span>

            <button
              onClick={() => {
                setIsFabOpen(false);
                window.location.href = '/bulk-upload';
              }}
              className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center hover:scale-105 transition-transform text-amber-500"
            >
              <Sparkles size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="bg-white dark:bg-slate-800 px-3 py-2 rounded-lg shadow text-xs font-medium">
              Add Menu
            </span>

            <button
              onClick={() => {
                setIsFabOpen(false);
                openModal();
              }}
              className="w-12 h-12 rounded-full bg-primary shadow-lg flex items-center justify-center hover:scale-105 transition-transform text-white"
            >
              <Plus size={24} />
            </button>
          </div>
        </div>

        {/* Main FAB */}
        <button
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-300 ${
            isFabOpen ? 'bg-slate-800 rotate-45' : 'bg-primary hover:bg-primary-600 hover:scale-105'
          }`}
        >
          <Plus size={24} />
        </button>
      </div>
    </div>
  );
}
