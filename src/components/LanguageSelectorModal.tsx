import { useState, useMemo, useEffect } from 'react';
import { Search, Languages, X, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mr', name: 'Marathi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'bn', name: 'Bengali' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
];

interface LanguageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryColor: string;
}

export function LanguageSelectorModal({ isOpen, onClose, primaryColor }: LanguageSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLang, setCurrentLang] = useState('en');

  // Try to detect the current language from cookie on mount
  useEffect(() => {
    if (isOpen) {
      const match = document.cookie.match(/googtrans=\/en\/([^;]+)/);
      if (match && match[1]) {
        setCurrentLang(match[1]);
      }
    }
  }, [isOpen]);

  const filteredLanguages = useMemo(() => {
    return LANGUAGES.filter(lang => 
      lang.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleSelect = (code: string) => {
    setCurrentLang(code);
    
    // Set the cookie directly as a fallback
    document.cookie = `googtrans=/en/${code}; path=/`;
    document.cookie = `googtrans=/en/${code}; path=/; domain=${window.location.hostname}`;
    
    const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
    if (select) {
      select.value = code;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      sessionStorage.setItem('lang_reloading', 'true');
      window.location.reload();
    }
    
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose Language" className="max-w-md">
      <div className="p-4 pt-2">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search language..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 transition-all text-sm"
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

        <div className="max-h-[50vh] overflow-y-auto space-y-1 pr-1 scrollbar-thin">
          {filteredLanguages.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No languages found matching "{searchQuery}"
            </div>
          ) : (
            filteredLanguages.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                  currentLang === lang.code 
                    ? 'bg-slate-50 border border-slate-200 font-semibold' 
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: currentLang === lang.code ? `${primaryColor}15` : '#f1f5f9' }}
                  >
                    <Languages size={16} style={{ color: currentLang === lang.code ? primaryColor : '#94a3b8' }} />
                  </div>
                  <span className={currentLang === lang.code ? 'text-slate-900' : 'text-slate-600'}>
                    {lang.name}
                  </span>
                </div>
                {currentLang === lang.code && (
                  <Check size={18} style={{ color: primaryColor }} />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
