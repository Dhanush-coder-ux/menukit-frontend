import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { 
  Coffee, 
  MenuSquare, 
  QrCode, 
  Eye, 
  ArrowRight,
  Clock,
  Search,
  ExternalLink,
  Plus
} from 'lucide-react';
import { api } from '@/services/api';
import { useShopStore } from '@/store/shopStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

export function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [topSearches, setTopSearches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const { shop, setShop } = useShopStore();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch shop if not loaded
        if (!shop) {
          const shopRes = await api.get('/shops/me');
          if (shopRes.data.id) {
            setShop(shopRes.data);
          }
        }

        // Fetch analytics
        const analyticsRes = await api.get('/analytics/dashboard');
        setStats(analyticsRes.data.overview);
        setActivities(analyticsRes.data.recent_activities);
        setTopSearches(analyticsRes.data.top_searches);
      } catch (error) {
        console.error('Failed to load dashboard data', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  // If no shop is created yet, prompt them to create one
  if (!shop?.id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-24 h-24 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-6">
          <Store className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-3xl font-heading font-bold mb-4">Welcome to Menukit!</h2>
        <p className="text-slate-500 max-w-md mb-8 text-lg">
          Let's get started by setting up your restaurant profile. It only takes a minute.
        </p>
        <Button size="lg" onClick={() => navigate('/shop-setup')}>
          Create Your Shop Profile
          <ArrowRight className="ml-2" size={18} />
        </Button>
      </div>
    );
  }

  const statCards = [
    { title: 'Total Menu Items', value: stats?.total_menu_items || 0, icon: Coffee, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { title: 'Categories', value: stats?.total_categories || 0, icon: MenuSquare, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { title: 'QR Scans', value: stats?.total_qr_scans || 0, icon: QrCode, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    { title: 'Menu Views', value: stats?.total_menu_views || 0, icon: Eye, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  ];

  return (
  <>
    {/* Dashboard Content */}
    <div className="space-y-8 animate-slide-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading">Overview</h2>
          <p className="text-slate-500">
            Welcome back! Here's what's happening at {shop.name}.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">
                    {stat.title}
                  </p>
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                    {stat.value}
                  </h3>
                </div>

                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 flex flex-col h-[450px]">
          <CardHeader className="shrink-0 pb-4">
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Your latest actions on the platform
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
            {activities.length > 0 ? (
              <div className="space-y-6">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4">
                    <div className="mt-1 bg-slate-100 dark:bg-slate-800 p-2 rounded-full text-slate-500">
                      <Clock size={16} />
                    </div>

                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {activity.details ||
                          activity.action.replace('_', ' ')}
                      </p>

                      <p className="text-xs text-slate-500">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">
                No recent activity found.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Searches */}
        <Card className="flex flex-col h-[450px]">
          <CardHeader className="shrink-0 pb-4">
            <CardTitle>Top Customer Searches</CardTitle>
            <CardDescription>
              What people are looking for
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
            {topSearches.length > 0 ? (
              <div className="space-y-4">
                {topSearches.map((search, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-500">
                        <Search size={14} />
                      </div>

                      <span className="text-sm font-medium capitalize">
                        {search.term}
                      </span>
                    </div>

                    <span className="text-xs font-semibold bg-primary-100 text-primary-700 px-2 py-1 rounded-full dark:bg-primary-900/30 dark:text-primary-400">
                      {search.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500">
                <Search
                  size={32}
                  className="mx-auto mb-3 text-slate-300"
                />
                <p className="text-sm">No search data yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>

    {/* FIXED FAB - OUTSIDE ANIMATED CONTAINER */}
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3">
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
            View Menu
          </span>

          <button
            onClick={() => {
              setIsFabOpen(false);
              window.open(`/shop/${shop.id}`, '_blank');
            }}
            className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          >
            <ExternalLink size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="bg-white dark:bg-slate-800 px-3 py-2 rounded-lg shadow text-xs font-medium">
            Get QR Code
          </span>

          <button
            onClick={() => {
              setIsFabOpen(false);
              navigate('/qr-code');
            }}
            className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          >
            <QrCode size={20} />
          </button>
        </div>
      </div>

      {/* Main FAB */}
      {/* Main FAB */}
        <button
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={`w-14 h-14 rounded-full shadow-lg mb-14 flex items-center justify-center text-white transition-all duration-300 ${
            isFabOpen ? 'bg-slate-800 rotate-45' : 'bg-primary hover:bg-primary-600 hover:scale-105'
          }`}
        >
          <Plus size={24} />
        </button>
    </div>
  </>
);
}

// Needed because we reference Store icon before it was imported in DashboardPage
import { Store } from 'lucide-react';
