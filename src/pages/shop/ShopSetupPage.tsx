import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Store, MapPin, Phone, UploadCloud, Save, Settings, ChevronRight, Check, Edit2, Clock, Star } from 'lucide-react';
import { api } from '@/services/api';
import { useShopStore } from '@/store/shopStore';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { TimePicker } from '@/components/ui/TimePicker';

export function ShopSetupPage() {
  const { shop, setShop } = useShopStore();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [viewMode, setViewMode] = useState<'summary' | 'edit'>('edit');

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(h, 10));
    date.setMinutes(parseInt(m, 10));
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    welcome_message: '',
    phone: '',
    whatsapp: '',
    address: '',
    logo_url: '',
    banner_url: '',
    opening_time: '',
    closing_time: '',
    latitude: '',
    longitude: '',
    google_review_link: '',
  });

  const [settingsData, setSettingsData] = useState({
    currency: '₹',
    language: 'en',
    show_prices: true,
    show_offers: true,
    is_discoverable: true,
    show_menus_in_discovery: true,
  });

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  useEffect(() => {
    const fetchShop = async () => {
      try {
        setIsLoading(true);
        const res = await api.get('/shops/me');
        if (res.data && res.data.id) {
          setShop(res.data);
          const loadedShop = res.data;
          setFormData({
            name: loadedShop.name || '',
            description: loadedShop.description || '',
            welcome_message: loadedShop.welcome_message || '',
            phone: loadedShop.phone || '',
            whatsapp: loadedShop.whatsapp || '',
            address: loadedShop.address || '',
            logo_url: loadedShop.logo_url || '',
            banner_url: loadedShop.banner_url || '',
            opening_time: loadedShop.opening_time || '',
            closing_time: loadedShop.closing_time || '',
            latitude: loadedShop.latitude?.toString() || '',
            longitude: loadedShop.longitude?.toString() || '',
            google_review_link: loadedShop.google_review_link || '',
          });
          if (loadedShop.settings) {
            setSettingsData({
              currency: loadedShop.settings.currency || '₹',
              language: loadedShop.settings.language || 'en',
              show_prices: loadedShop.settings.show_prices !== false,
              show_offers: loadedShop.settings.show_offers !== false,
              is_discoverable: loadedShop.settings.is_discoverable !== false,
              show_menus_in_discovery: loadedShop.settings.show_menus_in_discovery !== false,
            });
          }
          setViewMode('summary');
        }
      } catch (error) {
        // If 404, it means the shop doesn't exist yet, which is fine for a new user
        console.error('Failed to load shop details', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShop();
  }, [setShop]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSettingsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettingsData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    const setUploading = type === 'logo' ? setIsUploadingLogo : setIsUploadingBanner;
    setUploading(true);

    try {
      const formDataObj = new FormData();
      formDataObj.append('file', file);
      formDataObj.append('folder', type === 'logo' ? 'logos' : 'banners');

      const res = await api.post('/upload/image', formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const newUrl = res.data.url;
      setFormData(prev => ({ ...prev, [`${type}_url`]: newUrl }));
      
      // Auto-save the new image URL if the shop exists
      if (shop?.id) {
        const updateRes = await api.put('/shops/me', { ...formData, [`${type}_url`]: newUrl });
        setShop(updateRes.data);
      }
      
      toast.success(`${type === 'logo' ? 'Logo' : 'Banner'} uploaded and saved successfully!`);
    } catch (error) {
      toast.error(`Failed to upload ${type}`);
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1 && !formData.name) {
      toast.error('Shop name is required');
      return;
    }
    // Auto-save contact & timing details when moving past step 2
    if (currentStep === 2 && shop?.id) {
      try {
        const payload: any = { ...formData };
        payload.latitude = payload.latitude ? parseFloat(payload.latitude) : null;
        payload.longitude = payload.longitude ? parseFloat(payload.longitude) : null;
        
        const res = await api.put('/shops/me', payload);
        setShop(res.data);
      } catch (err: any) {
        console.error('Save error:', err);
        toast.error('Failed to save contact details');
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentStep < 4) {
      handleNext();
      return;
    }

    if (!formData.name) {
      toast.error('Shop name is required');
      return;
    }

    setIsLoading(true);
    try {
      const payload: any = { ...formData };
      payload.latitude = payload.latitude ? parseFloat(payload.latitude) : null;
      payload.longitude = payload.longitude ? parseFloat(payload.longitude) : null;

      let res;
      if (shop?.id) {
        res = await api.put('/shops/me', payload);
      } else {
        res = await api.post('/shops', payload);
      }
      
      // Update settings
      const settingsRes = await api.put('/shops/me/settings', settingsData);
      
      // Update local store with combined data
      setShop({ ...res.data, settings: settingsRes.data });
      toast.success('Shop profile updated successfully!');
      setViewMode('summary');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save shop details');
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { num: 1, title: 'Basic Info', icon: <Store size={18} /> },
    { num: 2, title: 'Contact', icon: <Phone size={18} /> },
    { num: 3, title: 'Branding', icon: <UploadCloud size={18} /> },
    { num: 4, title: 'Settings', icon: <Settings size={18} /> },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fade-in pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold font-heading text-slate-900 dark:text-white">Shop Setup</h2>
          <p className="text-slate-500">Configure your restaurant's digital presence</p>
        </div>
        {viewMode === 'summary' && (
          <button 
            onClick={() => setViewMode('edit')} 
            className="w-10 h-10 rounded-full bg-green-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors shrink-0"
            title="Edit Shop Details"
          >
            <Edit2 size={18} color='green'/>
          </button>
        )}
      </div>

      {viewMode === 'summary' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="h-40 sm:h-48 w-full bg-slate-100 dark:bg-slate-800 relative">
            {shop?.banner_url ? (
              <img src={shop.banner_url} alt="Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <Store size={48} className="opacity-20" />
              </div>
            )}
            <div className="absolute -bottom-12 left-6 sm:left-8 p-1 bg-white dark:bg-slate-900 rounded-2xl">
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {shop?.logo_url ? (
                  <img src={shop.logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Store size={32} />
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="pt-16 pb-6 px-6 sm:px-8">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{shop?.name}</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">{shop?.description || 'No description provided.'}</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="text-slate-400 shrink-0 mt-0.5" size={18} />
                <span className="text-slate-700 dark:text-slate-300">{shop?.address || 'No address set'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="text-slate-400 shrink-0" size={18} />
                <span className="text-slate-700 dark:text-slate-300">{shop?.phone || 'No phone set'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-green-500 font-bold shrink-0 text-center w-[18px]">W</span>
                <span className="text-slate-700 dark:text-slate-300">{shop?.whatsapp || 'No WhatsApp set'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="text-slate-400 shrink-0" size={18} />
                <span className="text-slate-700 dark:text-slate-300">
                  {shop?.opening_time ? formatTime(shop.opening_time) : '--:--'} to {shop?.closing_time ? formatTime(shop.closing_time) : '--:--'}
                </span>
              </div>
            </div>
            
            {shop?.welcome_message && (
              <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm italic text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
                "{shop.welcome_message}"
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Progress Stepper */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full -z-10"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary transition-all duration-300 rounded-full -z-10"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        ></div>
        
        {steps.map((step) => (
          <div key={step.num} className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (step.num < currentStep || (step.num > currentStep && formData.name)) {
                  setCurrentStep(step.num);
                }
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 shadow-sm
                ${currentStep === step.num ? 'bg-primary text-white scale-110 shadow-primary/30 ring-4 ring-primary/20' : 
                  currentStep > step.num ? 'bg-primary text-white' : 'bg-white text-slate-400 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}
            >
              {currentStep > step.num ? <Check size={18} /> : step.icon}
            </button>
            <span className={`text-xs font-medium ${currentStep === step.num ? 'text-primary' : 'text-slate-400'}`}>
              {step.title}
            </span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 sm:p-8">
        
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-xl font-bold font-heading mb-4 text-slate-800 dark:text-white">Basic Information</h3>
            <Input
              label="Shop Name *"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Hotel Saravana Bhavan"
              required
            />
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="A short description about your restaurant..."
                className="flex w-full rounded-xl border border-input bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[100px] resize-y"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Welcome Message</label>
              <textarea
                name="welcome_message"
                value={formData.welcome_message}
                onChange={handleChange}
                placeholder="Message shown to customers when they scan the QR code..."
                className="flex w-full rounded-xl border border-input bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[80px] resize-y"
              />
            </div>
          </div>
        )}

        {/* Step 2: Contact Details */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-xl font-bold font-heading mb-4 text-slate-800 dark:text-white">Contact & Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 9876543210"
                leftIcon={<Phone size={16} />}
              />
              <Input
                label="WhatsApp Number"
                name="whatsapp"
                value={formData.whatsapp}
                onChange={handleChange}
                placeholder="+91 9876543210"
                leftIcon={<Phone size={16} className="text-green-500" />}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center">
                <MapPin size={16} className="mr-1.5" /> Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Full address of the restaurant..."
                className="flex w-full rounded-xl border border-input bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[80px] resize-y"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <TimePicker
                label="Opening Time"
                value={formData.opening_time}
                onChange={(val) => setFormData(prev => ({ ...prev, opening_time: val }))}
                placeholder="e.g. 09:00 AM"
              />
              <TimePicker
                label="Closing Time"
                value={formData.closing_time}
                onChange={(val) => setFormData(prev => ({ ...prev, closing_time: val }))}
                placeholder="e.g. 10:00 PM"
              />
            </div>

            {/* Coordinates for Map Discovery */}
            <div className="space-y-1.5 mt-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin size={15} className="text-orange-500" />
                Map Coordinates
                <span className="text-xs font-normal text-slate-400 ml-1">(for store discovery)</span>
              </label>
              <div className="grid grid-cols-2 gap-3 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-800/20">
                <Input
                  label="Latitude"
                  name="latitude"
                  type="number"
                  step="0.000001"
                  value={formData.latitude}
                  onChange={handleChange}
                  placeholder="e.g. 12.9716"
                />
                <Input
                  label="Longitude"
                  name="longitude"
                  type="number"
                  step="0.000001"
                  value={formData.longitude}
                  onChange={handleChange}
                  placeholder="e.g. 77.5946"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                💡 Find on{' '}
                <a
                  href="https://maps.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-500 hover:underline"
                >
                  Google Maps
                </a>{' '}
                → right-click your location → copy coordinates.
              </p>
            </div>

            {/* Google Reviews */}
            <div className="space-y-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <Star size={15} className="text-amber-500 fill-amber-500" />
                  Google Reviews
                </label>
                <Input
                  label="Google Review Link (Optional)"
                  name="google_review_link"
                  value={formData.google_review_link}
                  onChange={handleChange}
                  placeholder="e.g. https://g.page/r/Cdfg.../review"
                />
                <p className="text-xs text-slate-400 mt-1 mb-3">
                  This will add a "Rate us on Google" button to your menu, redirecting customers to your Google review page.{' '}
                  <a href="https://support.google.com/business/answer/7030623" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline font-medium">
                    Learn how to find your link
                  </a>
                </p>
              </div>
            </div>

          </div>
        )}


        {/* Step 3: Branding */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-xl font-bold font-heading mb-4 text-slate-800 dark:text-white">Branding</h3>
            <p className="text-sm text-slate-500 mb-4">Upload your restaurant logo and banner to personalize your digital menu.</p>
            
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Logo Upload */}
              <div className="flex flex-col items-start gap-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Shop Logo</label>
                <div 
                  className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden relative group cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => logoInputRef.current?.click()}
                >
                  {formData.logo_url ? (
                    <>
                      <img src={formData.logo_url} alt="Logo" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <UploadCloud className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <UploadCloud className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                      <span className="text-xs text-slate-500">Upload Logo</span>
                    </div>
                  )}
                  {isUploadingLogo && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={logoInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'logo')} 
                />
              </div>

              {/* Banner Upload */}
              <div className="flex-1 flex flex-col items-start gap-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Shop Banner</label>
                <div 
                  className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden relative group cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => bannerInputRef.current?.click()}
                >
                  {formData.banner_url ? (
                    <>
                      <img src={formData.banner_url} alt="Banner" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <UploadCloud className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <UploadCloud className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                      <span className="text-xs text-slate-500">Upload Banner Image (1200x400 rec.)</span>
                    </div>
                  )}
                  {isUploadingBanner && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={bannerInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'banner')} 
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Settings */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-xl font-bold font-heading mb-4 text-slate-800 dark:text-white">Shop Settings</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Currency Symbol</label>
                <SearchableSelect
                  options={[
                    { id: '₹', name: 'Indian Rupee (₹)' },
                    { id: '$', name: 'US Dollar ($)' },
                    { id: '€', name: 'Euro (€)' },
                    { id: '£', name: 'British Pound (£)' },
                    { id: '¥', name: 'Japanese Yen (¥)' },
                    { id: 'AED', name: 'Emirati Dirham (AED)' }
                  ]}
                  value={settingsData.currency}
                  onChange={(val) => handleSettingsChange({ target: { name: 'currency', value: val } } as any)}
                  showSearch={false}
                  className="bg-slate-50 dark:bg-slate-800/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Menu Language</label>
                <select
                  name="language"
                  value={settingsData.language}
                  onChange={handleSettingsChange}
                  disabled
                  className="flex h-11 w-full rounded-xl border border-input bg-slate-100 dark:bg-slate-800/80 text-slate-500 px-3 py-2 text-sm transition-colors cursor-not-allowed"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="hi">Hindi</option>
                  <option value="ar">Arabic</option>
                </select>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Switch
                label="Show Prices on Menu"
                description="If disabled, customers will see the items but not their prices."
                checked={settingsData.show_prices}
                onChange={(c) => setSettingsData({ ...settingsData, show_prices: c })}
                disabled
              />
              
              <Switch
                label="Show Offers & Discounts"
                description="Display original price crossed out next to offer price."
                checked={settingsData.show_offers}
                onChange={(c) => setSettingsData({ ...settingsData, show_offers: c })}
                disabled
              />

              <Switch
                label="Enable Store Discovery"
                description="Allow customers to find your restaurant on the public discovery map."
                checked={settingsData.is_discoverable}
                onChange={(c) => setSettingsData({ ...settingsData, is_discoverable: c })}
              />
              
              {settingsData.is_discoverable && (
                <Switch
                  label="Show Menu on Discovery Map"
                  description="Display the 'Shop Menus' button on the discovery page."
                  checked={settingsData.show_menus_in_discovery}
                  onChange={(c) => setSettingsData({ ...settingsData, show_menus_in_discovery: c })}
                />
              )}
            </div>
          </div>
        )}

        {/* Navigation Actions */}
        <div className="flex justify-between items-center pt-8 mt-8 border-t border-slate-100 dark:border-slate-800">
          <Button 
            type="button" 
            variant="secondary" 
            onClick={() => {
              if (currentStep > 1) {
                setCurrentStep(prev => prev - 1);
              } else if (shop?.id) {
                setViewMode('summary');
              }
            }}
          >
            {currentStep === 1 && shop?.id ? 'Cancel' : 'Back'}
          </Button>
          
          {currentStep < 4 ? (
            <Button type="submit">
              <span className="flex items-center">
                Next Step <ChevronRight size={18} className="ml-2" />
              </span>
            </Button>
          ) : (
            <Button type="submit" isLoading={isLoading} leftIcon={<Save size={18} />}>
              Save Shop Profile
            </Button>
          )}
        </div>
      </form>
      </>
      )}
    </div>
  );
}
