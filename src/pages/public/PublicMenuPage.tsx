import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router';
import { Search, Flame, MapPin, Phone, Info, UtensilsCrossed, X, Star, LayoutGrid, List as ListIcon, Clock, Sparkles, ExternalLink, SlidersHorizontal, Check, Languages, Tag, Crown } from 'lucide-react';
import { api } from '@/services/api';
import { Shop, Category, MenuItem, Discount } from '@/types';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { GoogleTranslate } from '@/components/GoogleTranslate';
import { LanguageSelectorModal } from '@/components/LanguageSelectorModal';

const PRESET_TIMINGS: Record<string, string> = {
  'Early Morning': '(04:00 - 08:00)',
  'Morning': '(08:00 - 12:00)',
  'Afternoon': '(12:00 - 16:00)',
  'Evening': '(16:00 - 20:00)',
  'Night': '(20:00 - 00:00)',
  'Mid-night': '(00:00 - 04:00)'
};

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
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [foodFilter, setFoodFilter] = useState<'all' | 'veg' | 'non-veg' | 'egg' | 'drink'>('all');
  const [sortOrder, setSortOrder] = useState<'default' | 'price_asc' | 'price_desc'>('default');
  const [extraFilters, setExtraFilters] = useState<string[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [userViewMode, setUserViewMode] = useState<'grid' | 'list' | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
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
  
  const [isShopInfoOpen, setIsShopInfoOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomePhase, setWelcomePhase] = useState<'entering' | 'visible' | 'exiting' | 'hidden'>('hidden');
  const [activeDiscounts, setActiveDiscounts] = useState<Discount[]>([]);
  const [selectedDiscountForModal, setSelectedDiscountForModal] = useState<Discount | null>(null);
  const [activeDiscountFilter, setActiveDiscountFilter] = useState<string | null>(null);
  const [isDiscountsModalOpen, setIsDiscountsModalOpen] = useState(false);

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

        // Fetch active discounts for the banner
        try {
          const discountRes = await api.get(`/public/shop/${id}/discounts`);
          setActiveDiscounts(discountRes.data || []);
        } catch {
          // Non-critical — silently ignore
        }

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

        const timingFilters = extraFilters.filter(f => f.startsWith('timing_')).map(f => f.replace('timing_', ''));
        if (timingFilters.length > 0) {
          const isAllDay = !item.available_time_presets || item.available_time_presets.length === 0;
          if (!isAllDay) {
            const hasMatch = timingFilters.some(t => item.available_time_presets?.includes(t));
            if (!hasMatch) matchesExtra = false;
          }
        }

        let matchesDiscount = true;
        if (activeDiscountFilter) {
          const disc = activeDiscounts.find(d => d.id === activeDiscountFilter);
          if (disc) {
            if (disc.applies_to === 'all') matchesDiscount = true;
            else if (disc.applies_to === 'category' && disc.target_ids?.includes(item.category_id)) matchesDiscount = true;
            else if (disc.applies_to === 'items' && disc.target_ids?.includes(item.id)) matchesDiscount = true;
            else matchesDiscount = false;
          }
        }

        return matchesSearch && matchesFood && matchesExtra && matchesDiscount;
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
  }, [categories, searchQuery, activeCategoryId, foodFilter, sortOrder, extraFilters, activeDiscountFilter, activeDiscounts]);

  const toggleExtraFilter = (filter: string) => {
    setExtraFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  const handleItemClick = (item: MenuItem, categoryId: string) => {
    navigate(`/shop/${id}/item/${item.id}`);
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
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-center gap-2 sm:gap-3 transition-all overflow-x-auto scrollbar-hide no-scrollbar w-full">
          {/* Small Logo */}
          {!isSearchFocused && (
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-white flex items-center justify-center shadow-sm transition-all">
              {shop.logo_url ? (
                <img src={shop.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <UtensilsCrossed size={20} className="text-slate-400" />
              )}
            </div>
          )}
          
          {/* Small Search */}
          <div className={`relative transition-all duration-300 overflow-hidden ${isSearchFocused || searchQuery ? 'flex-1' : 'w-10 sm:flex-1 shrink-0'}`}>
            <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none transition-all duration-300 z-10 ${
              isSearchFocused || searchQuery ? 'left-3' : 'left-1/2 -translate-x-1/2 sm:left-3 sm:translate-x-0'
            }`} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {
                setTimeout(() => {
                  if (!searchQuery) {
                    setIsSearchFocused(false);
                  }
                }, 200);
              }}
              className={`w-full h-10 rounded-lg bg-white border border-slate-200 shadow-sm focus:outline-none focus:ring-2 transition-all duration-300 text-sm ${
                isSearchFocused || searchQuery
                  ? 'pl-9 pr-8 text-slate-900 placeholder-slate-400' 
                  : 'p-0 sm:pl-9 sm:pr-8 text-transparent sm:text-slate-900 placeholder-transparent sm:placeholder-slate-400 cursor-pointer sm:cursor-text'
              }`}
              style={{ '--tw-ring-color': primaryColor } as any}
            />
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchFocused(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 z-10"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {!isSearchFocused && (
            <>
              {/* Veg/Non-veg/Egg/Drink Toggle */}
              <div className="flex bg-slate-100 rounded-lg p-1 shrink-0 items-center overflow-x-auto scrollbar-hide no-scrollbar">
                <button
                  onClick={() => setFoodFilter(foodFilter === 'veg' ? 'all' : 'veg')}
                  className={`p-1.5 rounded-md transition-colors ${foodFilter === 'veg' ? 'bg-white shadow-sm' : 'opacity-50 hover:opacity-80'}`}
                  title="Veg Only"
                >
                  <span className="w-4 h-4 border-2 border-green-600 rounded-[3px] flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                  </span>
                </button>
                <button
                  onClick={() => setFoodFilter(foodFilter === 'non-veg' ? 'all' : 'non-veg')}
                  className={`p-1.5 rounded-md transition-colors ${foodFilter === 'non-veg' ? 'bg-white shadow-sm' : 'opacity-50 hover:opacity-80'}`}
                  title="Non-veg Only"
                >
                  <span className="w-4 h-4 border-2 border-red-600 rounded-[3px] flex items-center justify-center shrink-0">
                    <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-red-600"></span>
                  </span>
                </button>
                <button
                  onClick={() => setFoodFilter(foodFilter === 'egg' ? 'all' : 'egg')}
                  className={`p-1.5 rounded-md transition-colors ${foodFilter === 'egg' ? 'bg-white shadow-sm' : 'opacity-50 hover:opacity-80'}`}
                  title="Egg Only"
                >
                  <span className="w-4 h-4 border-2 border-yellow-600 rounded-[3px] flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                  </span>
                </button>
                <button
                  onClick={() => setFoodFilter(foodFilter === 'drink' ? 'all' : 'drink')}
                  className={`p-1.5 rounded-md transition-colors ${foodFilter === 'drink' ? 'bg-white shadow-sm' : 'opacity-50 hover:opacity-80'}`}
                  title="Drinks Only"
                >
                  <span className="w-4 h-4 border-2 border-blue-600 rounded-[3px] flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                  </span>
                </button>
              </div>

              {/* Active Offers Label */}
              {activeDiscounts.length > 0 && (
                <button
                  onClick={() => setIsDiscountsModalOpen(true)}
                  className="p-1.5 rounded-lg flex items-center justify-center shrink-0 transition-colors relative"
                  style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                  title="Active Offers"
                >
                  <Tag size={18} />
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm border border-white">
                    {activeDiscounts.length}
                  </span>
                </button>
              )}

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
            </>
          )}
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
            <Languages size={20} className='text-primary-400' />
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
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 transition-all overflow-x-auto scrollbar-hide no-scrollbar w-full">
          <div className={`relative transition-all duration-300 overflow-hidden ${isSearchFocused || searchQuery ? 'flex-1' : 'w-12 sm:flex-1 shrink-0'}`}>
            <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none transition-all duration-300 z-10 ${
              isSearchFocused || searchQuery ? 'left-4' : 'left-1/2 -translate-x-1/2 sm:left-4 sm:translate-x-0'
            }`} />
            <input
              type="text"
              placeholder="Search for a dish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {
                setTimeout(() => {
                  if (!searchQuery) {
                    setIsSearchFocused(false);
                  }
                }, 200);
              }}
              className={`w-full h-12 rounded-full border shadow-sm focus:outline-none focus:ring-2 transition-all duration-300 bg-white border-slate-200 text-sm sm:text-base ${
                isSearchFocused || searchQuery
                  ? 'pl-12 pr-10 text-slate-900 placeholder-slate-400' 
                  : 'p-0 sm:pl-12 sm:pr-10 text-transparent sm:text-slate-900 placeholder-transparent sm:placeholder-slate-400 cursor-pointer sm:cursor-text'
              }`}
              style={{ '--tw-ring-color': primaryColor } as any}
            />
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchFocused(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 z-10"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {!isSearchFocused && (
            <>
              {/* Veg/Non-veg/Egg/Drink Toggle */}
              <div className="flex bg-white shadow-sm border border-slate-200 rounded-full p-1 shrink-0 items-center overflow-x-auto no-scrollbar scrollbar-hide">
                <button
                  onClick={() => setFoodFilter(foodFilter === 'veg' ? 'all' : 'veg')}
                  className={`p-2 rounded-full transition-all shrink-0 ${foodFilter === 'veg' ? 'bg-green-50 shadow-sm ring-1 ring-green-200' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Veg Only"
                >
                  <span className="w-4 h-4 border-2 border-green-600 rounded-[3px] flex items-center justify-center">
                    <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                  </span>
                </button>
                <button
                  onClick={() => setFoodFilter(foodFilter === 'non-veg' ? 'all' : 'non-veg')}
                  className={`p-2 rounded-full transition-all shrink-0 ${foodFilter === 'non-veg' ? 'bg-red-50 shadow-sm ring-1 ring-red-200' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Non-veg Only"
                >
                  <span className="w-4 h-4 border-2 border-red-600 rounded-[3px] flex items-center justify-center">
                    <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-red-600"></span>
                  </span>
                </button>
                <button
                  onClick={() => setFoodFilter(foodFilter === 'egg' ? 'all' : 'egg')}
                  className={`p-2 rounded-full transition-all shrink-0 ${foodFilter === 'egg' ? 'bg-yellow-50 shadow-sm ring-1 ring-yellow-200' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Contains Egg"
                >
                  <span className="w-4 h-4 border-2 border-yellow-500 rounded-[3px] flex items-center justify-center">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  </span>
                </button>
                <button
                  onClick={() => setFoodFilter(foodFilter === 'drink' ? 'all' : 'drink')}
                  className={`p-2 rounded-full transition-all shrink-0 ${foodFilter === 'drink' ? 'bg-blue-50 shadow-sm ring-1 ring-blue-200' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Drinks Only"
                >
                  <span className="w-4 h-4 border-2 border-blue-500 rounded-full flex items-center justify-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
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
            </>
          )}
        </div>

        {/* Active filter indicators */}
        {(foodFilter !== 'all' || sortOrder !== 'default' || extraFilters.length > 0 || activeDiscountFilter) && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {foodFilter !== 'all' && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
                foodFilter === 'veg' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 
                foodFilter === 'egg' ? 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200' :
                foodFilter === 'drink' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' :
                'bg-red-50 text-red-700 ring-1 ring-red-200'
              }`}>
                {foodFilter === 'veg' ? (
                  <><span className="w-3 h-3 border-[1.5px] border-green-600 rounded-[2px] flex items-center justify-center"><span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span></span> Showing Veg Only</>
                ) : foodFilter === 'egg' ? (
                  <><span className="w-3 h-3 border-[1.5px] border-yellow-500 rounded-[2px] flex items-center justify-center"><span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span></span> Showing Contains Egg</>
                ) : foodFilter === 'drink' ? (
                  <><span className="w-3 h-3 border-[1.5px] border-blue-500 rounded-full flex items-center justify-center"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span></span> Showing Drinks Only</>
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
            {activeDiscountFilter && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 ring-1 ring-purple-200 shadow-sm animate-pulse-slow">
                <Sparkles size={12} className="text-purple-500" /> Offer Applied
                <button onClick={() => setActiveDiscountFilter(null)} className="ml-1 opacity-60 hover:opacity-100">
                  <X size={12} />
                </button>
              </span>
            )}
            {(foodFilter !== 'all' || sortOrder !== 'default' || extraFilters.length > 0 || activeDiscountFilter) && (
              <button 
                onClick={() => {
                  setFoodFilter('all');
                  setSortOrder('default');
                  setExtraFilters([]);
                  setActiveDiscountFilter(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2 ml-1 font-medium transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* 🎉 Active Offers Banner */}
        {activeDiscounts.length > 0 && (
          <div className="mb-6 w-full -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {activeDiscounts.map(disc => (
                <div
                  key={disc.id}
                  onClick={() => setSelectedDiscountForModal(disc)}
                  className="relative shrink-0 w-[85%] sm:w-[350px] flex shadow-md rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] snap-center group bg-white"
                  style={{ border: `1px solid ${primaryColor}30` }}
                >
                  {/* Left Ticket Stub */}
                  <div 
                    className="relative w-28 sm:w-32 flex flex-col items-center justify-center text-white p-4 shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {/* Cutouts for ticket effect */}
                    <div className="absolute -top-3 -right-3 w-6 h-6 bg-slate-50 rounded-full border-b border-l border-transparent" style={{ borderColor: `${primaryColor}30` }} />
                    <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-slate-50 rounded-full border-t border-l border-transparent" style={{ borderColor: `${primaryColor}30` }} />
                    
                    <div className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-md text-center">
                      {disc.discount_type === 'percentage' && `${Number(disc.discount_value)}%`}
                      {disc.discount_type === 'flat' && `${settings?.currency || '₹'}${Number(disc.discount_value)}`}
                      {disc.discount_type === 'bogo' && 'BOGO'}
                      {disc.discount_type === 'combo' && 'COMBO'}
                    </div>
                    <div className="text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-0.5 opacity-90 text-center">
                      {['percentage', 'flat'].includes(disc.discount_type) && 'Off'}
                      {disc.discount_type === 'bogo' && `Buy ${disc.buy_quantity} Get ${disc.get_quantity}`}
                      {disc.discount_type === 'combo' && `${settings?.currency || '₹'}${Number(disc.discount_value)}`}
                    </div>
                  </div>

                  {/* Perforated line */}
                  <div className="relative border-l-2 border-dashed border-slate-200 my-4" />

                  {/* Right Ticket Body */}
                  <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center relative bg-white overflow-hidden min-w-0">
                    <div className="flex justify-between items-start mb-1.5 gap-2">
                      <h3 className="font-extrabold text-slate-800 text-sm sm:text-base leading-tight truncate">
                        {disc.title}
                      </h3>
                      <Sparkles size={16} className="shrink-0 animate-pulse" style={{ color: primaryColor }} />
                    </div>
                    
                    {disc.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3 font-medium">
                        {disc.description}
                      </p>
                    )}
                    
                    <div className="mt-auto flex items-center justify-between gap-2 min-w-0">
                      <div className="flex gap-1.5 min-w-0 shrink">
                        {disc.members_only ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shadow-sm flex items-center gap-1 bg-purple-100 text-purple-700 min-w-0">
                            <Crown size={10} className="shrink-0" /> 
                            <span className="truncate">Members Only</span>
                          </span>
                        ) : (
                          <span 
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shadow-sm truncate min-w-0"
                            style={{ color: primaryColor, backgroundColor: `${primaryColor}15` }}
                          >
                            Limited Offer
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap">
                        Tap to use
                      </span>
                    </div>
                  </div>
                  
                  {/* Constant shimmer effect spanning the whole card */}
                  <div className="absolute inset-0 z-10 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite] pointer-events-none mix-blend-overlay" />
                </div>
              ))}
            </div>
          </div>
        )}
        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-150%) skewX(-12deg); }
            100% { transform: translateX(150%) skewX(-12deg); }
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>

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
                          
                          {/* Food Type mark */}
                          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-0.5 rounded shadow-sm">
                            {item.food_type === 'veg' ? (
                              <span className="w-3 h-3 border border-green-600 rounded-[2px] flex items-center justify-center">
                                <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                              </span>
                            ) : item.food_type === 'egg' ? (
                              <span className="w-3 h-3 border border-yellow-500 rounded-[2px] flex items-center justify-center">
                                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                              </span>
                            ) : item.food_type === 'drink' ? (
                              <span className="w-3 h-3 border border-blue-500 rounded-full flex items-center justify-center">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
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
                          
                          <div className={`mt-2 flex flex-col gap-1.5 ${layoutStyle === 'grid' ? 'justify-between' : ''}`}>
                            {(() => {
                              let basePrice = Number(item.price);
                              let offerPrice = item.offer_price ? Number(item.offer_price) : null;
                              let isFrom = false;

                              if (item.variants && item.variants.length > 0) {
                                let minPrice = Infinity;
                                let minOffer = Infinity;
                                item.variants.forEach(v => {
                                  const p = Number(v.price);
                                  const op = v.offer_price ? Number(v.offer_price) : p;
                                  if (p < minPrice) minPrice = p;
                                  if (op < minOffer) minOffer = op;
                                });
                                if (minPrice !== Infinity) {
                                  basePrice = minPrice;
                                  offerPrice = minOffer < minPrice ? minOffer : null;
                                  isFrom = true;
                                }
                              }

                              let finalPrice = offerPrice !== null ? offerPrice : basePrice;
                              let hasDiscount = offerPrice !== null && offerPrice < basePrice;
                              
                              if (!offerPrice && activeDiscounts.length > 0) {
                                const disc = activeDiscounts.find(d => {
                                  if (d.discount_type === 'bogo' || d.discount_type === 'combo') return false;
                                  if (d.applies_to === 'all') return true;
                                  if (d.applies_to === 'category' && d.target_ids?.includes(item.category_id)) return true;
                                  if (d.applies_to === 'items' && d.target_ids?.includes(item.id)) return true;
                                  return false;
                                });
                                if (disc) {
                                  const v = Number(disc.discount_value);
                                  const discounted = disc.discount_type === 'percentage'
                                    ? basePrice * (1 - v / 100)
                                    : Math.max(0, basePrice - v);
                                  finalPrice = discounted;
                                  hasDiscount = true;
                                }
                              }

                              return (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {isFrom && <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Starts from</span>}
                                  {hasDiscount && (
                                    <span className="text-[11px] text-slate-400 line-through decoration-slate-300 font-medium">
                                      {settings?.currency || '₹'}{basePrice.toFixed(2).replace(/\.00$/, '')}
                                    </span>
                                  )}
                                  <span className="font-bold whitespace-nowrap text-base" style={{ color: primaryColor }}>
                                    {settings?.currency || '₹'}{finalPrice.toFixed(2).replace(/\.00$/, '')}
                                  </span>
                                  {hasDiscount && basePrice > 0 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded ml-1" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                                      {Math.round(((basePrice - finalPrice) / basePrice) * 100)}% OFF
                                    </span>
                                  )}
                                </div>
                              );
                            })()}

                            {((item.variants && item.variants.length > 0) || (item.addons && item.addons.length > 0)) && (
                              <div className="flex flex-wrap gap-1.5 mt-0.5">
                                {item.variants && item.variants.length > 0 && (
                                  <span className="text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">
                                    +{item.variants.length} Variants
                                  </span>
                                )}
                                {item.addons && item.addons.length > 0 && (
                                  <span className="text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">
                                    +{item.addons.length} Add-ons
                                  </span>
                                )}
                              </div>
                            )}

                            {((item.available_days && item.available_days.length > 0) || (item.available_time_presets && item.available_time_presets.length > 0) || (item.custom_time_from && item.custom_time_to)) && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {item.available_days && item.available_days.length > 0 && (
                                  <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded shadow-sm max-w-[120px] truncate" title={item.available_days.join(', ')}>
                                    {item.available_days.length === 7 ? 'Everyday' : item.available_days.join(', ')}
                                  </span>
                                )}
                                {item.available_time_presets && item.available_time_presets.length > 0 && (
                                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md shadow-sm truncate max-w-full" title={item.available_time_presets.map(p => `${p} ${PRESET_TIMINGS[p] || ''}`).join(', ')}>
                                    {item.available_time_presets.map(p => `${p} ${PRESET_TIMINGS[p] || ''}`).join(', ')}
                                  </span>
                                )}
                                {(item.custom_time_from && item.custom_time_to) && (
                                  <span className="text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded shadow-sm max-w-[120px] truncate" title={`${item.custom_time_from} - ${item.custom_time_to}`}>
                                    {item.custom_time_from} - {item.custom_time_to}
                                  </span>
                                )}
                              </div>
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

        {/* --- Google Reviews Section --- */}
        {(shop.google_review_link || shop.review_widget_code) && (
          <div className="px-4 sm:px-6 md:px-8 max-w-4xl mx-auto pb-12 mt-8 border-t pt-8" style={{ borderColor: 'rgba(100, 116, 139, 0.1)' }}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: theme?.theme === 'dark' ? 'white' : 'inherit' }}>
              <Star size={20} className="text-amber-500 fill-amber-500" />
              Customer Reviews
            </h2>
            
            {shop.google_review_link && (
              <a 
                href={shop.google_review_link}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 px-4 rounded-xl font-bold text-center mb-6 transition-transform active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: theme?.theme === 'dark' ? '#1e293b' : 'white', color: primaryColor, border: `1px solid ${primaryColor}40` }}
              >
                Rate us on Google Maps <ExternalLink size={16} />
              </a>
            )}
            
            {shop.review_widget_code && (
              <div 
                className="w-full overflow-hidden rounded-xl bg-white/5"
                dangerouslySetInnerHTML={{ __html: shop.review_widget_code }}
              />
            )}
          </div>
        )}

      </div>

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

          {/* Google Maps & Reviews */}
          {shop.address && (
            <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
              {/* Google Maps link */}
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(shop.name + ' ' + (shop.address || ''))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                  <MapPin size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                    View on Google Maps
                  </p>
                  <p className="text-xs text-slate-400">Get directions</p>
                </div>
                <ExternalLink size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
              </a>

              {/* Google Reviews link */}
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(shop.name + ' ' + (shop.address || ''))}&tbm=lcl#lrd=,1`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-amber-50 text-amber-500">
                  <Star size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-amber-600 transition-colors">
                    Google Reviews
                  </p>
                  <p className="text-xs text-slate-400">Read & write reviews on Google</p>
                </div>
                <ExternalLink size={14} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
              </a>
            </div>
          )}

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

          {/* Availability Section */}
          <div>
            <h3 className="text-xs font-bold mb-3 opacity-70 uppercase tracking-wider">Availability</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'timing_Early Morning', label: 'Early Morning' },
                { id: 'timing_Morning', label: 'Morning' },
                { id: 'timing_Afternoon', label: 'Afternoon' },
                { id: 'timing_Evening', label: 'Evening' },
                { id: 'timing_Night', label: 'Night' },
                { id: 'timing_Mid-night', label: 'Mid-night' }
              ].map(filter => (
                <label 
                  key={filter.id}
                  className={`relative flex items-center justify-center py-2.5 px-2 rounded-xl border cursor-pointer transition-all text-center ${
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
                  <span className={`text-xs font-medium ${extraFilters.includes(filter.id) ? 'text-slate-900' : 'text-slate-600'}`}>
                    {filter.label}
                  </span>
                  {extraFilters.includes(filter.id) && (
                    <div className="absolute top-1.5 right-1.5">
                      <Check size={12} style={{ color: primaryColor }} />
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

      {/* Offer Details Modal */}
      <Modal
        isOpen={!!selectedDiscountForModal}
        onClose={() => setSelectedDiscountForModal(null)}
        title="Offer Details"
        className="bg-white text-slate-900"
      >
        {selectedDiscountForModal && (
          <div className="space-y-5 mt-2">
            <div className="flex flex-col items-center text-center pb-5 border-b border-slate-100">
              {(() => {
                const isCashLook = selectedDiscountForModal.discount_type === 'flat' || selectedDiscountForModal.discount_type === 'combo';
                return isCashLook ? (
                  <div 
                    className="min-w-[8rem] w-auto h-20 px-8 flex items-center justify-center shrink-0 text-white font-bold mb-4 transform hover:scale-105 transition-transform duration-300 relative overflow-hidden"
                    style={{ 
                      backgroundColor: '#16a34a',
                      borderRadius: '8px',
                      boxShadow: '0 12px 32px #16a34a60'
                    }}
                  >
                    <div className="absolute inset-1.5 border-2 border-white/30 border-dashed rounded-[4px]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite] pointer-events-none" />
                    <span className="text-3xl tracking-tight z-10 font-mono">
                      {settings?.currency || '₹'}{Number(selectedDiscountForModal.discount_value)}
                    </span>
                  </div>
                ) : (
                  <div 
                    className="min-w-[8rem] w-auto h-24 px-8 flex items-center justify-center shrink-0 text-white font-bold mb-4 transform hover:scale-105 transition-transform duration-300 relative overflow-hidden"
                    style={{ 
                      backgroundColor: primaryColor,
                      borderRadius: '16px',
                      boxShadow: `0 12px 32px ${primaryColor}60`
                    }}
                  >
                    <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-[inset_0_0_10px_rgba(0,0,0,0.1)]" />
                    <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-[inset_0_0_10px_rgba(0,0,0,0.1)]" />
                    <div className="absolute inset-y-2 left-6 border-l-2 border-white/30 border-dashed" />
                    <div className="absolute inset-y-2 right-6 border-r-2 border-white/30 border-dashed" />
                    
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite] pointer-events-none" />
                    <span className="text-3xl tracking-tight z-10 text-center px-2">
                      {selectedDiscountForModal.discount_type === 'percentage' 
                        ? `${Number(selectedDiscountForModal.discount_value)}%`
                        : `Buy ${selectedDiscountForModal.buy_quantity}\nGet ${selectedDiscountForModal.get_quantity}`}
                    </span>
                  </div>
                );
              })()}
              <h3 className="text-2xl font-bold font-heading text-slate-900">{selectedDiscountForModal.title}</h3>
              {selectedDiscountForModal.description && (
                <p className="text-sm text-slate-500 mt-2 max-w-[280px] leading-relaxed">{selectedDiscountForModal.description}</p>
              )}
              {selectedDiscountForModal.members_only && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider">
                  <Crown size={14} />
                  Members Only
                </div>
              )}
            </div>

            <div className="pt-2">
              <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14} className="text-amber-500" /> Valid For
              </h4>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 max-h-48 overflow-y-auto scrollbar-hide">
                {selectedDiscountForModal.applies_to === 'all' ? (
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                      <Check size={16} />
                    </span>
                    Entire Menu
                  </p>
                ) : selectedDiscountForModal.applies_to === 'category' ? (
                  <ul className="space-y-3">
                    {categories
                      .filter(c => selectedDiscountForModal.target_ids?.includes(c.id))
                      .map(c => (
                        <li key={c.id} className="text-sm font-semibold text-slate-700 flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                            <Check size={16} />
                          </span>
                          {c.name}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <ul className="space-y-3">
                    {categories.flatMap(c => c.items)
                      .filter(i => selectedDiscountForModal.target_ids?.includes(i.id))
                      .map(i => (
                        <li key={i.id} className="text-sm font-semibold text-slate-700 flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                            <Check size={16} />
                          </span>
                          {i.name}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={() => {
                  setActiveDiscountFilter(selectedDiscountForModal.id);
                  setSelectedDiscountForModal(null);
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }}
                className="w-full py-4 px-4 rounded-2xl font-bold text-white transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                style={{ 
                  backgroundColor: primaryColor,
                  boxShadow: `0 8px 24px ${primaryColor}50`
                }}
              >
                View Applicable Items
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* All Discounts Modal */}
      <Modal
        isOpen={isDiscountsModalOpen}
        onClose={() => setIsDiscountsModalOpen(false)}
        title="Active Offers"
        className="bg-white text-slate-900 max-w-md"
      >
        <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto scrollbar-hide">
          {activeDiscounts.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No active offers at the moment.</p>
          ) : (
            activeDiscounts.map(disc => (
              <div
                key={disc.id}
                onClick={() => {
                  setIsDiscountsModalOpen(false);
                  setSelectedDiscountForModal(disc);
                }}
                className="relative w-full flex shadow-sm rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-md active:scale-[0.98] group bg-white"
                style={{ border: `1px solid ${primaryColor}30` }}
              >
                {/* Left Ticket Stub */}
                <div 
                  className="relative w-24 flex flex-col items-center justify-center text-white p-3 shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {/* Cutouts for ticket effect */}
                  <div className="absolute -top-3 -right-3 w-6 h-6 bg-white rounded-full border-b border-l border-transparent z-10" style={{ borderColor: `${primaryColor}30` }} />
                  <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-white rounded-full border-t border-l border-transparent z-10" style={{ borderColor: `${primaryColor}30` }} />
                  
                  <div className="text-xl font-black tracking-tight drop-shadow-sm text-center">
                    {disc.discount_type === 'percentage' && `${Number(disc.discount_value)}%`}
                    {disc.discount_type === 'flat' && `${settings?.currency || '₹'}${Number(disc.discount_value)}`}
                    {disc.discount_type === 'bogo' && 'BOGO'}
                    {disc.discount_type === 'combo' && 'COMBO'}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-widest mt-0.5 opacity-90 text-center">
                    {['percentage', 'flat'].includes(disc.discount_type) && 'Off'}
                    {disc.discount_type === 'bogo' && `Buy ${disc.buy_quantity} Get ${disc.get_quantity}`}
                    {disc.discount_type === 'combo' && `${settings?.currency || '₹'}${Number(disc.discount_value)}`}
                  </div>
                </div>

                {/* Perforated line */}
                <div className="relative border-l-2 border-dashed border-slate-100 my-3" />

                {/* Right Ticket Body */}
                <div className="flex-1 p-3 flex flex-col justify-center relative bg-white overflow-hidden min-w-0">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <p className="font-extrabold text-slate-800 text-sm leading-tight truncate">
                      {disc.title}
                    </p>
                  </div>
                  
                  {disc.description && (
                    <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed mb-2 font-medium">
                      {disc.description}
                    </p>
                  )}
                  
                  <div className="mt-auto flex items-center justify-between">
                    {disc.members_only ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm flex items-center gap-1 shrink-0 bg-purple-100 text-purple-700">
                        <Crown size={10} className="shrink-0" />
                        Members Only
                      </span>
                    ) : (
                      <span 
                        className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm shrink-0"
                        style={{ color: primaryColor, backgroundColor: `${primaryColor}15` }}
                      >
                        Limited Offer
                      </span>
                    )}
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors ml-2 shrink-0">
                      View
                    </span>
                  </div>
                </div>
                
                {/* Constant shimmer effect spanning the whole card */}
                <div className="absolute inset-0 z-10 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite] pointer-events-none mix-blend-overlay" />
              </div>
            ))
          )}
        </div>
      </Modal>

      <LanguageSelectorModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        primaryColor={primaryColor}
      />
    </div>
  );
}
