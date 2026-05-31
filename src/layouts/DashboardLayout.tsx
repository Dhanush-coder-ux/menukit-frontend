import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router';
import { 
  LayoutDashboard, 
  Store, 
  MenuSquare, 
  Coffee, 
  Palette, 
  QrCode, 
  LineChart, 
  LogOut,
  User as UserIcon,
  MoreHorizontal,
  ChevronRight,
  Languages
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';
import { Modal } from '@/components/ui/Modal';
import { GoogleTranslate } from '@/components/GoogleTranslate';
import { LanguageSelectorModal } from '@/components/LanguageSelectorModal';

export function DashboardLayout() {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const location = useLocation();

  interface NavItem {
    name: string;
    path: string;
    icon: any;
    disabled?: boolean;
    label?: string;
  }

  const mainNavItems: NavItem[] = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Categories', path: '/categories', icon: MenuSquare },
    { name: 'Dishes', path: '/menu-items', icon: Coffee },
    { name: 'Shop', path: '/shop-setup', icon: Store },
  ];

  const moreNavItems = [
    { name: 'Customize Theme', path: '/customize', icon: Palette, disabled: true, label: 'Coming Soon' },
    { name: 'QR Code', path: '/qr-code', icon: QrCode },
    { name: 'Analytics', path: '/analytics', icon: LineChart },
  ];

  const allNavItems = [...mainNavItems, ...moreNavItems];

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-950 flex pb-16 lg:pb-0">
      <GoogleTranslate />
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col h-full">
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h1 className="text-xl font-heading font-bold text-primary">Menukit</h1>
          <button 
            onClick={() => setIsLanguageModalOpen(true)}
            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-primary-400 flex items-center justify-center text-white shadow-sm hover:bg-white/30 transition-colors"
            title="Change Language"
          >
            <Languages size={18} className='text-primary-500'/>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {allNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            
            return (
              <NavLink
                key={item.path}
                to={item.disabled ? '#' : item.path}
                onClick={(e) => {
                  if (item.disabled) {
                    e.preventDefault();
                  }
                }}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-colors relative overflow-hidden group",
                  isActive 
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
                  item.disabled && "cursor-not-allowed pointer-events-none"
                )}
              >
                <div className={cn("flex items-center", item.disabled && "opacity-40")}>
                  <Icon size={18} className={cn("mr-3", isActive ? "text-primary-600 dark:text-primary-400" : "text-slate-400")} />
                  {item.name}
                </div>
                {item.label && (
                  <span className="ml-auto text-[9px] font-extrabold uppercase tracking-widest bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 px-2.5 py-0.5 rounded-full ring-1 ring-amber-400/30 shadow-sm shadow-amber-400/20">
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center px-3 py-2 mb-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary-700 font-semibold text-sm mr-3">
              <UserIcon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {user?.email}
              </p>
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={18} className="mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Top Header */}
        <div className="lg:hidden flex items-center justify-between px-4 h-14 bg-white/20 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50 shrink-0 z-30 shadow-sm">
          <div className="w-8"></div> {/* Spacer for centering */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-sm">
              <QrCode size={14} className="text-white" />
            </div>
            <span className="text-base font-bold bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">
              Menukit
            </span>
          </div>
          <button 
            onClick={() => setIsLanguageModalOpen(true)}
            className="w-8 h-8 rounded-full bg-white/50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
          >
            <Languages size={18} />
          </button>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto animate-fade-in pb-4">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Mobile Bottom App Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200/50 dark:border-slate-800/50 z-40 flex justify-around items-center px-2 safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {mainNavItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-primary" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <Icon size={22} className={isActive ? "fill-primary/20" : ""} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </NavLink>
          );
        })}
        
        {/* More Button */}
        <button
          onClick={() => setIsMoreMenuOpen(true)}
          className={cn(
            "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          )}
        >
          <MoreHorizontal size={22} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>

      {/* More Menu Modal */}
      <Modal
        isOpen={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        title="More Options"
        className="mt-auto rounded-b-none sm:rounded-b-2xl sm:mt-0"
      >
        <div className="p-2 space-y-1">
          {moreNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            
            return (
              <NavLink
                key={item.path}
                to={item.disabled ? '#' : item.path}
                onClick={(e) => {
                  if (item.disabled) {
                    e.preventDefault();
                  } else {
                    setIsMoreMenuOpen(false);
                  }
                }}
                className={cn(
                  "flex items-center px-4 py-3.5 rounded-xl text-sm font-medium transition-all group",
                  isActive 
                    ? "bg-primary text-white shadow-md shadow-primary/25" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
                  item.disabled && "cursor-not-allowed pointer-events-none"
                )}
              >
                <div className={cn("flex items-center flex-1", item.disabled && "opacity-40")}>
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg mr-3 transition-colors",
                    isActive ? "bg-white/20 text-white" : "bg-slate-200/50 group-hover:bg-white dark:bg-slate-800 dark:group-hover:bg-slate-700 text-slate-500 group-hover:text-primary dark:text-slate-400"
                  )}>
                    <Icon size={18} className={isActive ? "text-white" : ""} />
                  </div>
                  <span>{item.name}</span>
                </div>
                {item.label && (
                  <span className="ml-2 text-[9px] font-extrabold uppercase tracking-widest bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 px-2.5 py-0.5 rounded-full ring-1 ring-amber-400/30 shadow-sm shadow-amber-400/20">
                    {item.label}
                  </span>
                )}
                {!item.disabled && (
                  <ChevronRight size={16} className={cn("opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0", isActive ? "opacity-100 translate-x-0 text-white/70" : "text-slate-400")} />
                )}
              </NavLink>
            );
          })}
          
          <div className="pt-2 mt-2">
            <div className="mx-2 mb-2 p-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/80 dark:to-slate-900 border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>
              <div className="flex items-center relative z-10">
                <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-950 flex items-center justify-center text-primary font-bold text-lg mr-4 shadow-sm border border-slate-100 dark:border-slate-800">
                  {user?.email?.charAt(0).toUpperCase() || <UserIcon size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {user?.email}
                  </p>
                  <div className="flex items-center mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary capitalize">
                      {user?.role}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => {
                setIsMoreMenuOpen(false);
                logout();
              }}
              className="flex items-center w-full px-4 py-3.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-all group"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg mr-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
                <LogOut size={18} />
              </div>
              Sign Out
            </button>
          </div>
        </div>
      </Modal>

      <LanguageSelectorModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        primaryColor="#f97316"
      />
    </div>
  );
}
