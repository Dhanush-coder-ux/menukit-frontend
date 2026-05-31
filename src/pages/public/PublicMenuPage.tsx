import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Search, Flame, MapPin, Phone, Info, UtensilsCrossed, X, Star, LayoutGrid, List as ListIcon, Clock, Sparkles, ExternalLink, SlidersHorizontal, Check, Languages } from 'lucide-react';
import { api } from '@/services/api';
import { Shop, Category, MenuItem } from '@/types';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Lightbox } from '@/components/ui/Lightbox';
import { GoogleTranslate } from '@/components/GoogleTranslate';
import { LanguageSelectorModal } from '@/components/LanguageSelectorModal';

// This is a special interface for the public menu structure returned by the backend
interface PublicCategory extends Category {
  items: MenuItem[];
}

export function PublicMenuPage() {
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(h, 10));
    date.setMinutes(parseInt(m, 10));
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [shop, setShop] = useState<Shop | null>(null);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [foodFilter, setFoodFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [sortOrder, setSortOrder] = useState<'default' | 'price_asc' | 'price_desc'>('default');
  const [extraFilters, setExtraFilters] = useState<string[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [userViewMode, setUserViewMode] = useState<'grid' | 'list' | null>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);

  // Handle Scroll
  useEffect(() => {
    const handleScroll = () => {
      if (categoriesRef.current) {
        const rect = categoriesRef.current.getBoundingClientRect();
        setIsScrolled(rect.bottom <= 0);
      } else {
        setIsScrolled(window.scrollY > 300);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Details Modal
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isShopInfoOpen, setIsShopInfoOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomePhase, setWelcomePhase] = useState<'entering' | 'visible' | 'exiting' | 'hidden'>('hidden');

  // Track scan if referrer is present
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (id) {
      api.post(`/public/shop/${id}/scan`, { referrer: ref }).catch(console.error);
    }
  }, [id, searchParams]);

  // Load Data
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const [shopRes, menuRes] = await Promise.all([
          api.get(`/public/shop/${id}`),
          api.get(`/public/shop/${id}/menu`)
        ]);
        
        setShop(shopRes.data);
        setCategories(menuRes.data);

        // Show welcome popup once per session if shop has a welcome message
        const shopData = shopRes.data as Shop;
        if (shopData.welcome_message && !sessionStorage.getItem(`welcome_${id}`)) {
          sessionStorage.setItem(`welcome_${id}`, 'true');
          setShowWelcome(true);
          setWelcomePhase('entering');
          // Transition to fully visible after entrance animation
          setTimeout(() => setWelcomePhase('visible'), 600);
        }
        
        // Track view
        api.post(`/public/shop/${id}/view`).catch(console.error);
        
      } catch (error) {
        console.error("Failed to load menu", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) fetchMenu();
  }, [id]);

  // Handle Search Tracking with Debounce
  useEffect(() => {
    if (!searchQuery || !id) return;
    
    const timeoutId = setTimeout(() => {
      // Find result count
      let resultCount = 0;
      categories.forEach(cat => {
        cat.items.forEach(item => {
          if (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))) {
            resultCount++;
          }
        });
      });
      
      api.post(`/public/shop/${id}/search`, { 
        term: searchQuery, 
        result_count: resultCount 
      }).catch(console.error);
      
    }, 1000); // 1s debounce
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery, id, categories]);

  // Apply styles dynamically
  useEffect(() => {
    if (!shop?.theme) return;
    const { primary_color, font_family } = shop.theme;
    
    document.documentElement.style.setProperty('--primary', primary_color);
    document.documentElement.classList.remove('dark');
    
    // Add font family to body
    document.body.style.fontFamily = font_family;
    
    return () => {
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.classList.remove('dark');
      document.body.style.fontFamily = '';
    };
  }, [shop?.theme]);

  // Filter Items
  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    
    return categories.map(cat => {
      const filteredItems = cat.items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesFood = foodFilter === 'all' || 
          (item.food_type && item.food_type.toLowerCase().replace('_', '-') === foodFilter);
          
        let matchesExtra = true;
        if (extraFilters.includes('chef_special') && !item.is_highlighted) matchesExtra = false;
        if (extraFilters.includes('bestseller') && !item.is_bestseller) matchesExtra = false;
        if (extraFilters.includes('in_stock') && !item.is_available) matchesExtra = false;
        if (extraFilters.includes('out_of_stock') && item.is_available) matchesExtra = false;

        return matchesSearch && matchesFood && matchesExtra;
      });

      // Sort
      filteredItems.sort((a, b) => {
        if (sortOrder === 'price_asc') {
          return Number(a.offer_price || a.price) - Number(b.offer_price || b.price);
        }
        if (sortOrder === 'price_desc') {
          return Number(b.offer_price || b.price) - Number(a.offer_price || a.price);
        }
        // Default sort: Highlighted items first, then original order
        if (a.is_highlighted && !b.is_highlighted) return -1;
        if (!a.is_highlighted && b.is_highlighted) return 1;
        return 0;
      });

      return {
        ...cat,
        items: filteredItems
      };
    }).filter(cat => cat.items.length > 0 && (activeCategoryId === 'all' || cat.id === activeCategoryId));
  }, [categories, searchQuery, activeCategoryId, foodFilter, sortOrder, extraFilters]);

  const toggleExtraFilter = (filter: string) => {
    setExtraFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  const handleItemClick = (item: MenuItem, categoryId: string) => {
    setSelectedItem(item);
    if (id) {
      api.post(`/public/shop/${id}/view`, { item_id: item.id, category_id: categoryId }).catch(console.error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Skeleton className="h-48 w-full rounded-none" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-3/4 mx-auto" />
          <Skeleton className="h-12 w-full rounded-full mt-6" />
          <div className="flex gap-2 mt-4 overflow-hidden">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-24 rounded-full shrink-0" />)}
          </div>
          <div className="mt-8 space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-400">
          <UtensilsCrossed size={32} />
        </div>
        <h1 className="text-2xl font-bold font-heading mb-2 text-slate-900 dark:text-white">Restaurant Not Found</h1>
        <p className="text-slate-500 max-w-sm">The digital menu you're looking for doesn't exist or is currently unavailable.</p>
      </div>
    );
  }

  const { theme, settings } = shop;
  const layoutStyle = userViewMode || theme?.layout || 'grid';
  const primaryColor = theme?.primary_color || '#f97316';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 animate-fade-in">
      {/* Welcome Popup Overlay */}
      {showWelcome && (
        <div
          className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 transition-all duration-500 ${
            welcomePhase === 'exiting' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => {
            setWelcomePhase('exiting');
            setTimeout(() => setShowWelcome(false), 500);
          }}
        >
          {/* Floating decorative particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full opacity-30"
                style={{
                  width: `${8 + i * 4}px`,
                  height: `${8 + i * 4}px`,
                  backgroundColor: primaryColor,
                  left: `${15 + i * 14}%`,
                  top: `${20 + (i % 3) * 25}%`,
                  animation: `float-particle ${3 + i * 0.5}s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.3}s`,
                }}
              />
            ))}
          </div>

          {/* Popup Card */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 ${
              welcomePhase === 'entering'
                ? 'translate-y-8 scale-95 opacity-0'
                : welcomePhase === 'exiting'
                ? 'translate-y-4 scale-95 opacity-0'
                : 'translate-y-0 scale-100 opacity-100'
            }`}
            style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}
          >
            {/* Gradient accent bar */}
            <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}99, ${primaryColor}44)` }} />

            <div className="p-6 sm:p-8 text-center">
              {/* Logo with glow */}
              <div
                className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-5 shadow-lg border-2 border-white overflow-hidden"
                style={{
                  backgroundColor: `${primaryColor}10`,
                  boxShadow: `0 0 30px ${primaryColor}25, 0 8px 32px rgba(0,0,0,0.08)`,
                  animation: 'welcome-logo-pulse 2s ease-in-out infinite',
                }}
              >
                {shop.logo_url ? (
                  <img src={shop.logo_url} className="w-full h-full object-cover" alt="Logo" />
                ) : (
                  <UtensilsCrossed size={32} style={{ color: primaryColor }} />
                )}
              </div>

              {/* Sparkle + Title */}
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles size={16} style={{ color: primaryColor }} className="opacity-60" />
                <span className="text-xs font-semibold uppercase tracking-widest opacity-50">Welcome to</span>
                <Sparkles size={16} style={{ color: primaryColor }} className="opacity-60" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-heading mb-4" style={{ color: '#1e293b' }}>
                {shop.name}
              </h2>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4 px-4">
                <div className="flex-1 h-px bg-slate-200" />
                <UtensilsCrossed size={14} className="text-slate-300" />
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Welcome Message */}
              <p className="text-sm sm:text-base text-slate-500 leading-relaxed mb-6 px-2">
                {shop.welcome_message}
              </p>

              {/* CTA Button */}
              <button
                onClick={() => {
                  setWelcomePhase('exiting');
                  setTimeout(() => setShowWelcome(false), 500);
                }}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  backgroundColor: primaryColor,
                  boxShadow: `0 4px 20px ${primaryColor}40`,
                }}
              >
                Explore Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline keyframes for welcome popup */}
      <style>{`
        @keyframes float-particle {
          0% { transform: translateY(0px) rotate(0deg); }
          100% { transform: translateY(-20px) rotate(180deg); }
        }
        @keyframes welcome-logo-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
      `}</style>
      {/* Sticky Header */}
      <div className={`fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-200 transition-all duration-300 transform ${
        isScrolled ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
      }`}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Small Logo */}
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-white flex items-center justify-center shadow-sm">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <UtensilsCrossed size={20} className="text-slate-400" />
            )}
          </div>
          
          {/* Small Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-8 rounded-lg bg-white border border-slate-200 shadow-sm focus:outline-none focus:ring-2 transition-all text-sm"
              style={{ '--tw-ring-color': primaryColor } as any}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Veg/Non-veg Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1 shrink-0 items-center">
            <button
              onClick={() => setFoodFilter(foodFilter === 'veg' ? 'all' : 'veg')}
              className={`p-1.5 rounded-md transition-colors ${foodFilter === 'veg' ? 'bg-white shadow-sm' : 'opacity-50 hover:opacity-80'}`}
              title="Veg Only"
            >
              <span className="w-4 h-4 border-2 border-green-600 rounded-[3px] flex items-center justify-center">
                <span className="w-2 h-2 bg-green-600 rounded-full"></span>
              </span>
            </button>
            <button
              onClick={() => setFoodFilter(foodFilter === 'non-veg' ? 'all' : 'non-veg')}
              className={`p-1.5 rounded-md transition-colors ${foodFilter === 'non-veg' ? 'bg-white shadow-sm' : 'opacity-50 hover:opacity-80'}`}
              title="Non-veg Only"
            >
              <span className="w-4 h-4 border-2 border-red-600 rounded-[3px] flex items-center justify-center">
                <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-red-600"></span>
              </span>
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1 shrink-0 items-center">
            <button
              onClick={() => setUserViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${layoutStyle === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              title="Grid View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setUserViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${layoutStyle === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              title="List View"
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
        
        {/* Sticky Categories */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide no-scrollbar max-w-3xl mx-auto">
          <button
            onClick={() => {
              setActiveCategoryId('all');
              window.scrollTo({ top: 200, behavior: 'smooth' });
            }}
            className={`px-4 py-1.5 rounded-full whitespace-nowrap text-xs font-medium transition-all ${
              activeCategoryId === 'all' 
                ? 'text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
            style={activeCategoryId === 'all' ? { backgroundColor: primaryColor } : {}}
          >
            All Menu
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategoryId(cat.id);
                window.scrollTo({ top: 200, behavior: 'smooth' });
              }}
              className={`px-4 py-1.5 rounded-full whitespace-nowrap text-xs font-medium transition-all ${
                activeCategoryId === cat.id 
                  ? 'text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
              style={activeCategoryId === cat.id ? { backgroundColor: primaryColor } : {}}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Banner & Header */}
      <div className="relative">
        <GoogleTranslate />
        {shop.banner_url ? (
          <img src={shop.banner_url} alt="Restaurant Banner" className="w-full h-48 sm:h-64 object-cover" />
        ) : (
          <div className="w-full h-48 sm:h-64 bg-slate-200 flex items-center justify-center">
             <UtensilsCrossed size={48} className="text-slate-400 opacity-20" />
          </div>
        )}
        
        <div className="absolute top-4 right-4 flex gap-2">
          <button 
            onClick={() => setIsLanguageModalOpen(true)}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-sm hover:bg-white/30 transition-colors"
          >
            <Languages size={20}className='text-primary-400' />
          </button>
          <button 
            onClick={() => setIsShopInfoOpen(true)}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-sm hover:bg-white/30 transition-colors"
          >
            <Info size={20} color='orange'/>
          </button>
        </div>

        <div className="absolute -bottom-12 left-0 right-0 flex justify-center px-4">
          <div className="w-24 h-24 rounded-2xl border-4 border-slate-50 overflow-hidden bg-white shadow-lg shrink-0 flex items-center justify-center">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <UtensilsCrossed size={32} className="text-slate-300" />
            )}
          </div>
        </div>
      </div>

      <div className="pt-16 px-4 max-w-3xl mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold font-heading">{shop.name}</h1>
        </div>

        {/* Search & View Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
            <input
              type="text"
              placeholder="Search for a dish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-12 pr-10 rounded-full border shadow-sm focus:outline-none focus:ring-2 transition-all bg-white border-slate-200 text-slate-900 placeholder-slate-400 text-sm sm:text-base"
              style={{ '--tw-ring-color': primaryColor } as any}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Veg/Non-veg Toggle */}
          <div className="flex bg-white shadow-sm border border-slate-200 rounded-full p-1 shrink-0 items-center">
            <button
              onClick={() => setFoodFilter(foodFilter === 'veg' ? 'all' : 'veg')}
              className={`p-2 rounded-full transition-all ${foodFilter === 'veg' ? 'bg-green-50 shadow-sm ring-1 ring-green-200' : 'text-slate-400 hover:text-slate-600'}`}
              title="Veg Only"
            >
              <span className="w-4 h-4 border-2 border-green-600 rounded-[3px] flex items-center justify-center">
                <span className="w-2 h-2 bg-green-600 rounded-full"></span>
              </span>
            </button>
            <button
              onClick={() => setFoodFilter(foodFilter === 'non-veg' ? 'all' : 'non-veg')}
              className={`p-2 rounded-full transition-all ${foodFilter === 'non-veg' ? 'bg-red-50 shadow-sm ring-1 ring-red-200' : 'text-slate-400 hover:text-slate-600'}`}
              title="Non-veg Only"
            >
              <span className="w-4 h-4 border-2 border-red-600 rounded-[3px] flex items-center justify-center">
                <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-red-600"></span>
              </span>
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex bg-white shadow-sm border border-slate-200 rounded-full p-1 shrink-0 items-center">
            <button
              onClick={() => setUserViewMode('grid')}
              className={`p-2 rounded-full transition-colors ${layoutStyle === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              title="Grid View"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setUserViewMode('list')}
              className={`p-2 rounded-full transition-colors ${layoutStyle === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              title="List View"
            >
              <ListIcon size={18} />
            </button>
          </div>
        </div>

        {/* Active filter indicators */}
        {(foodFilter !== 'all' || sortOrder !== 'default' || extraFilters.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {foodFilter !== 'all' && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${foodFilter === 'veg' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-red-50 text-red-700 ring-1 ring-red-200'}`}>
                {foodFilter === 'veg' ? (
                  <><span className="w-3 h-3 border-[1.5px] border-green-600 rounded-[2px] flex items-center justify-center"><span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span></span> Showing Veg Only</>
                ) : (
                  <><span className="w-3 h-3 border-[1.5px] border-red-600 rounded-[2px] flex items-center justify-center"><span className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[5px] border-transparent border-b-red-600"></span></span> Showing Non-veg Only</>
                )}
                <button onClick={() => setFoodFilter('all')} className="ml-1 opacity-60 hover:opacity-100">
                  <X size={12} />
                </button>
              </span>
            )}
            {sortOrder !== 'default' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                Sorted: {sortOrder === 'price_asc' ? 'Low to High' : 'High to Low'}
                <button onClick={() => setSortOrder('default')} className="ml-1 opacity-60 hover:opacity-100">
                  <X size={12} />
                </button>
              </span>
            )}
            {extraFilters.map(filter => (
              <span key={filter} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                {filter.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                <button onClick={() => toggleExtraFilter(filter)} className="ml-1 opacity-60 hover:opacity-100">
                  <X size={12} />
                </button>
              </span>
            ))}
            {(foodFilter !== 'all' || sortOrder !== 'default' || extraFilters.length > 0) && (
              <button 
                onClick={() => {
                  setFoodFilter('all');
                  setSortOrder('default');
                  setExtraFilters([]);
                }}
                className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2 ml-1 font-medium transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Categories Tab */}
        <div ref={categoriesRef} className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setActiveCategoryId('all')}
            className={`px-5 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
              activeCategoryId === 'all' 
                ? 'text-white shadow-md scale-105' 
                : 'bg-white text-slate-600 border-slate-200 border opacity-80 hover:opacity-100'
            }`}
            style={activeCategoryId === 'all' ? { backgroundColor: primaryColor } : {}}
          >
            All Menu
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`px-5 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                activeCategoryId === cat.id 
                  ? 'text-white shadow-md scale-105' 
                  : 'bg-white text-slate-600 border-slate-200 border opacity-80 hover:opacity-100'
              }`}
              style={activeCategoryId === cat.id ? { backgroundColor: primaryColor } : {}}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Items */}
        <div className="mt-4 space-y-8">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No items found</p>
              <p className="text-sm opacity-60 mt-1">Try a different search term</p>
            </div>
          ) : (
            filteredCategories.map(cat => (
              <div key={cat.id} className="animate-slide-up">
                <h2 className="text-xl font-bold font-heading mb-4 flex items-center">
                  {cat.name}
                  <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200/50 opacity-70">
                    {cat.items.length}
                  </span>
                </h2>
                
                <div className={layoutStyle === 'grid' ? "grid grid-cols-2 gap-3 sm:gap-4" : "flex flex-col gap-3 sm:gap-4"}>
                  {cat.items.map(item => {
                    const primaryImage = item.thumbnail_url || item.image_url;
                    
                    return (
                      <div 
                        key={item.id} 
                        onClick={() => item.is_available ? handleItemClick(item, cat.id) : null}
                        className={`rounded-2xl overflow-hidden shadow-sm border transition-transform ${
                          item.is_available ? 'active:scale-[0.98] cursor-pointer hover:shadow-md' : 'opacity-70 grayscale-[60%] cursor-not-allowed'
                        } ${
                          item.is_highlighted ? 'ring-2 ring-primary ring-offset-2 ring-offset-slate-50' : 'border-slate-100'
                        } ${
                          layoutStyle === 'list' ? 'flex h-28 sm:h-32' : 'flex flex-col'
                        } bg-white relative`}
                      >
                        {/* Image */}
                        <div className={`relative bg-slate-100 ${
                          layoutStyle === 'list' ? 'w-28 sm:w-32 h-full shrink-0' : 'w-full h-32 sm:h-40'
                        }`}>
                          {primaryImage ? (
                            <img src={primaryImage} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-20">
                              <UtensilsCrossed size={32} />
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
                          
                          {/* Out of Stock Overlay */}
                          {!item.is_available && (
                            <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10">
                              <span className="bg-slate-900 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">Out of Stock</span>
                            </div>
                          )}
                          
                          {/* Veg/Non-veg mark */}
                          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-0.5 rounded shadow-sm">
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
                        
                        {/* Content */}
                        <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between min-w-0">
                          <div>
                            <h3 className="font-semibold text-sm sm:text-base leading-tight line-clamp-2">{item.name}</h3>
                            {item.description && layoutStyle === 'list' && (
                              <p className="text-xs opacity-60 mt-1 line-clamp-2">{item.description}</p>
                            )}
                          </div>
                          
                          <div className={`mt-2 flex flex-wrap items-center gap-2 ${layoutStyle === 'grid' ? 'justify-between' : ''}`}>
                            <span className="font-bold whitespace-nowrap" style={{ color: primaryColor }}>
                              {settings?.currency || '₹'}{item.offer_price || item.price}
                            </span>
                            {settings?.show_offers && item.offer_price && (
                              <span className="text-xs opacity-50 line-through whitespace-nowrap">
                                {settings?.currency || '₹'}{item.price}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Item Details Modal */}
      <Modal 
        isOpen={!!selectedItem} 
        onClose={() => setSelectedItem(null)}
        className="max-w-md p-0 overflow-hidden bg-white text-slate-900"
      >
        {selectedItem && (
          <div className="flex flex-col max-h-[85vh]">
            <div className="h-48 sm:h-64 bg-slate-100 relative shrink-0">
              {selectedItem.images && selectedItem.images.length > 0 ? (
                <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide no-scrollbar">
                  {selectedItem.images.map(img => (
                    <div key={img.id} className="w-full h-full shrink-0 snap-center relative cursor-pointer" onClick={() => setLightboxImage(img.image_url)}>
                      <img src={img.image_url} alt={selectedItem.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : selectedItem.image_url ? (
                <img src={selectedItem.image_url} alt={selectedItem.name} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxImage(selectedItem.image_url!)} />
              ) : (
                <div className="w-full h-full flex items-center justify-center opacity-20">
                  <UtensilsCrossed size={48} />
                </div>
              )}
              {selectedItem.images && selectedItem.images.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10 pointer-events-none">
                  <div className="bg-black/40 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                    Swipe for more
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-5 overflow-y-auto">
              <div className="flex justify-between items-start gap-4 mb-2">
                <h2 className="text-2xl font-bold font-heading">{selectedItem.name}</h2>
                <div className="shrink-0 mt-1">
                  {selectedItem.food_type === 'veg' ? (
                    <span className="w-5 h-5 border border-green-600 rounded flex items-center justify-center" title="Vegetarian">
                      <span className="w-2.5 h-2.5 bg-green-600 rounded-full"></span>
                    </span>
                  ) : (
                    <span className="w-5 h-5 border border-red-600 rounded flex items-center justify-center" title="Non-Vegetarian">
                      <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-red-600"></span>
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl font-bold" style={{ color: primaryColor }}>
                  {settings?.currency || '₹'}{selectedItem.offer_price || selectedItem.price}
                </span>
                {settings?.show_offers && selectedItem.offer_price && (
                  <span className="text-sm opacity-50 line-through">
                    {settings?.currency || '₹'}{selectedItem.price}
                  </span>
                )}
                {selectedItem.is_bestseller && (
                  <span className="ml-auto text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded flex items-center">
                    <Flame size={12} className="mr-1" /> Bestseller
                  </span>
                )}
              </div>
              
              {selectedItem.description ? (
                <div className="mt-4">
                  <h3 className="font-semibold text-sm mb-1 opacity-90">About this dish</h3>
                  <p className="text-sm opacity-70 leading-relaxed">{selectedItem.description}</p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      {/* Shop Info Modal */}
      <Modal
        isOpen={isShopInfoOpen}
        onClose={() => setIsShopInfoOpen(false)}
        title="Restaurant Info"
        className="bg-white text-slate-900"
      >
        <div className="space-y-4 mt-4">
          {shop.address && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                <MapPin size={20} />
              </div>
              <div>
                <h4 className="font-medium text-sm">Location</h4>
                <p className="text-sm opacity-70 whitespace-pre-line mt-1">{shop.address}</p>
              </div>
            </div>
          )}
          
          {(shop.phone || shop.whatsapp) && (
            <div className="flex items-start gap-3 mt-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                <Phone size={20} />
              </div>
              <div>
                <h4 className="font-medium text-sm">Contact</h4>
                {shop.phone && <p className="text-sm opacity-70 mt-1">{shop.phone}</p>}
                {shop.whatsapp && <p className="text-sm opacity-70">WhatsApp: {shop.whatsapp}</p>}
              </div>
            </div>
          )}
          
          {(shop.opening_time || shop.closing_time) && (() => {
            // Determine if currently open
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            let isOpen = false;
            if (shop.opening_time && shop.closing_time) {
              const [oh, om] = shop.opening_time.split(':').map(Number);
              const [ch, cm] = shop.closing_time.split(':').map(Number);
              const openMin = oh * 60 + om;
              const closeMin = ch * 60 + cm;
              if (closeMin > openMin) {
                isOpen = currentMinutes >= openMin && currentMinutes < closeMin;
              } else {
                // Overnight hours (e.g. 22:00 - 06:00)
                isOpen = currentMinutes >= openMin || currentMinutes < closeMin;
              }
            }
            return (
              <div className="flex items-start gap-3 mt-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                  <Clock size={20} />
                </div>
                <div>
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    Hours
                    {shop.opening_time && shop.closing_time && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOpen 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {isOpen ? 'Open Now' : 'Closed'}
                      </span>
                    )}
                  </h4>
                  <p className="text-sm opacity-70 mt-1">
                    {shop.opening_time && formatTime(shop.opening_time)}
                    {shop.opening_time && shop.closing_time && ' — '}
                    {shop.closing_time && formatTime(shop.closing_time)}
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="pt-4 mt-4 border-t border-slate-200 flex flex-col items-center gap-1">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Powered by</span>
            <a
              href="https://menukit.debuggers.co.in/landing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-extrabold bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent hover:opacity-80 transition-opacity flex items-center gap-1"
            >
              Menukit
              <ExternalLink size={10} className="text-orange-500" />
            </a>
          </div>
        </div>
      </Modal>

      <Lightbox 
        isOpen={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
        imageUrl={lightboxImage || ''}
      />

      {/* Filter FAB */}
      <button
        onClick={() => setIsFilterModalOpen(true)}
        className="fixed bottom-10 right-4 sm:right-6 w-14 h-14 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform z-40 border-4 border-white/50 backdrop-blur-md"
        style={{ backgroundColor: primaryColor }}
      >
        <SlidersHorizontal size={24} />
        {(sortOrder !== 'default' || extraFilters.length > 0) && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {/* Filter Options Modal */}
      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Sort & Filter"
        className="bg-white text-slate-900 max-w-md w-full"
      >
        <div className="space-y-6 mt-4">
          {/* Sort Section */}
          <div>
            <h3 className="text-xs font-bold mb-3 opacity-70 uppercase tracking-wider">Sort By</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-colors">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${sortOrder === 'default' ? 'border-primary' : 'border-slate-300'}`} style={sortOrder === 'default' ? { borderColor: primaryColor } : {}}>
                  {sortOrder === 'default' && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />}
                </div>
                <input type="radio" className="hidden" checked={sortOrder === 'default'} onChange={() => setSortOrder('default')} />
                <span className="text-sm font-medium">Default (Chef's Specials first)</span>
              </label>
              
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-colors">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${sortOrder === 'price_asc' ? 'border-primary' : 'border-slate-300'}`} style={sortOrder === 'price_asc' ? { borderColor: primaryColor } : {}}>
                  {sortOrder === 'price_asc' && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />}
                </div>
                <input type="radio" className="hidden" checked={sortOrder === 'price_asc'} onChange={() => setSortOrder('price_asc')} />
                <span className="text-sm font-medium">Price: Low to High</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-colors">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${sortOrder === 'price_desc' ? 'border-primary' : 'border-slate-300'}`} style={sortOrder === 'price_desc' ? { borderColor: primaryColor } : {}}>
                  {sortOrder === 'price_desc' && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />}
                </div>
                <input type="radio" className="hidden" checked={sortOrder === 'price_desc'} onChange={() => setSortOrder('price_desc')} />
                <span className="text-sm font-medium">Price: High to Low</span>
              </label>
            </div>
          </div>

          {/* Filter Section */}
          <div>
            <h3 className="text-xs font-bold mb-3 opacity-70 uppercase tracking-wider">Quick Filters</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'chef_special', label: "Chef's Specials", icon: <Flame size={18} className="text-orange-500" /> },
                { id: 'bestseller', label: "Bestsellers", icon: <Star size={18} className="text-amber-500" /> },
                { id: 'in_stock', label: "In Stock", icon: null },
                { id: 'out_of_stock', label: "Out of Stock", icon: null }
              ].map(filter => (
                <label 
                  key={filter.id}
                  className={`relative flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl border cursor-pointer transition-all text-center ${
                    extraFilters.includes(filter.id) 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                  style={extraFilters.includes(filter.id) ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
                >
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={extraFilters.includes(filter.id)}
                    onChange={() => toggleExtraFilter(filter.id)}
                  />
                  {filter.icon && <div>{filter.icon}</div>}
                  <span className={`text-xs font-medium ${extraFilters.includes(filter.id) ? 'text-slate-900' : 'text-slate-600'}`}>
                    {filter.label}
                  </span>
                  {extraFilters.includes(filter.id) && (
                    <div className="absolute top-2 right-2">
                      <Check size={14} style={{ color: primaryColor }} />
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => {
                setSortOrder('default');
                setExtraFilters([]);
              }}
              className="flex-1 py-3 px-4 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-sm"
            >
              Reset
            </button>
            <button
              onClick={() => setIsFilterModalOpen(false)}
              className="flex-[2] py-3 px-4 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transition-all text-sm"
              style={{ backgroundColor: primaryColor }}
            >
              Show Results
            </button>
          </div>
        </div>
      </Modal>

      {/* Bottom Branding Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-200 py-2 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-2">
          <span className="text-[10px] text-slate-400 font-medium">Powered by</span>
          <a
            href="https://menukit.debuggers.co.in/landing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent hover:opacity-80 transition-opacity flex items-center gap-1"
          >
            Menukit
            <ExternalLink size={10} className="text-orange-500" />
          </a>
        </div>
      </div>

      <LanguageSelectorModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        primaryColor={primaryColor}
      />
    </div>
  );
}
