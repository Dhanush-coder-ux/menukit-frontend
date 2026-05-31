import { Outlet } from 'react-router';
import { UtensilsCrossed } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative overflow-hidden">
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
        </div>
        
        <Outlet />
      </div>
    </div>
  );
}
