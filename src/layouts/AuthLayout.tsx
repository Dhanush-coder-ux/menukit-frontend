import { useState } from 'react';
import { Outlet } from 'react-router';
import { UtensilsCrossed, Languages } from 'lucide-react';
import { GoogleTranslate } from '@/components/GoogleTranslate';
import { LanguageSelectorModal } from '@/components/LanguageSelectorModal';

export function AuthLayout() {
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative overflow-hidden">
      <GoogleTranslate />

      {/* Language Toggle at Top Right */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <button
          onClick={() => setIsLanguageModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm hover:bg-white dark:hover:bg-slate-900 transition-all group"
        >
          <Languages size={18} className="text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Translate</span>
        </button>
      </div>

      {/* Background gradients */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-amber-200 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-primary/30">
            <UtensilsCrossed size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Menukit</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-center">Digital menus for modern restaurants</p>
          <div className="mt-4 px-3 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-bold rounded-full border border-primary-200 dark:border-primary-800 flex items-center gap-1.5">
            <Languages size={14} className="animate-pulse" />
            Available in multiple languages
          </div>
        </div>

        <Outlet />
      </div>

      <LanguageSelectorModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        primaryColor="#f97316"
      />
    </div>
  );
}
