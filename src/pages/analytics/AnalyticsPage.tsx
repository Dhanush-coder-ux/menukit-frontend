import { useState, useEffect } from 'react';
import { QrCode, Eye, Search, CalendarDays, Filter } from 'lucide-react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Modal } from '@/components/ui/Modal';

export function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<number>(30);
  const [activeBar, setActiveBar] = useState<number | null>(null);
  
  const [viewAllModal, setViewAllModal] = useState<{isOpen: boolean, type: 'views' | 'searches' | null}>({isOpen: false, type: null});
  const [modalSearch, setModalSearch] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.get('/analytics/dashboard');
        setData(res.data);
      } catch (error) {
        console.error('Failed to fetch analytics', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  // Filter data based on selected range
  const filteredScans = data?.daily_scans?.slice(-dateFilter) || [];
  const maxScans = filteredScans.length > 0 
    ? Math.max(...filteredScans.map((d: any) => d.count)) 
    : 10;

  return (
    <div className="space-y-6 max-w-6xl animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading">Analytics & Reports</h2>
          <p className="text-slate-500">Track your menu's performance and customer behavior.</p>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <QrCode size={18} className="mr-2 text-purple-500" />
              Total Scans
            </CardTitle>
            <CardDescription>All time QR scans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-900 dark:text-white">
              {data?.overview?.total_qr_scans || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Eye size={18} className="mr-2 text-orange-500" />
              Menu Views
            </CardTitle>
            <CardDescription>Total page and item views</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-900 dark:text-white">
              {data?.overview?.total_menu_views || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center text-lg">
            <CalendarDays size={18} className="mr-2 text-primary" />
            Scan Activity
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <div className="w-36">
              <SearchableSelect
                options={[
                  { id: '7', name: 'Last 7 Days' },
                  { id: '14', name: 'Last 14 Days' },
                  { id: '30', name: 'Last 30 Days' },
                ]}
                value={dateFilter.toString()}
                onChange={(val) => setDateFilter(Number(val))}
                showSearch={false}
                className="h-9 bg-slate-100 dark:bg-slate-800 border-none shadow-none"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredScans.length > 0 ? (
            <div className="h-56 flex items-end gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 relative">
              {/* Y-axis lines could go here */}
              {filteredScans.map((day: any, i: number) => {
                const height = maxScans > 0 ? `${(day.count / maxScans) * 100}%` : '0%';
                // Show fewer labels depending on range
                const showLabel = dateFilter <= 7 || i % Math.ceil(filteredScans.length / 7) === 0 || i === filteredScans.length - 1;
                
                return (
                  <div 
                    key={i} 
                    className="flex-1 flex flex-col items-center group relative h-full justify-end"
                    onClick={() => setActiveBar(activeBar === i ? null : i)}
                    onMouseLeave={() => setActiveBar(null)}
                  >
                    <div 
                      className="w-full max-w-[40px] bg-primary/20 dark:bg-primary-900/40 hover:bg-primary rounded-t-md transition-all relative cursor-pointer border border-primary/10"
                      style={{ height: height === '0%' ? '4px' : height }}
                    >
                      {/* Tooltip */}
                      <div className={`absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs py-1.5 px-3 rounded-lg transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg ${activeBar === i ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}>
                        <span className="font-bold">{day.count} scans</span><br/>
                        <span className="text-slate-300">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-transparent border-t-slate-900"></div>
                      </div>
                    </div>
                    {/* Date Label */}
                    <div className="h-8 mt-2 flex items-center justify-center overflow-visible">
                      {showLabel && (
                        <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                          {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400">
              No scan data available for this period.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Viewed Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye size={18} className="mr-2 text-slate-500" />
              Most Viewed Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.top_items?.length > 0 ? (
              <div className="space-y-4">
                {data.top_items.slice(0, 5).map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="font-medium text-sm">{item.name}</span>
                    <div className="flex items-center">
                      <div className="w-32 h-2 bg-slate-100 dark:bg-slate-800 rounded-full mr-3 overflow-hidden">
                        <div 
                          className="h-full bg-primary" 
                          style={{ width: `${(item.count / data.top_items[0].count) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-semibold w-8 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
                {data.top_items.length > 5 && (
                  <button 
                    onClick={() => { setViewAllModal({isOpen: true, type: 'views'}); setModalSearch(''); }}
                    className="w-full py-2 mt-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    +{data.top_items.length - 5} more items
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">No view data available yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Top Searches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search size={18} className="mr-2 text-slate-500" />
              Top Searches
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.top_searches?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.top_searches.slice(0, 5).map((search: any, i: number) => {
                  // Calculate size based on count relative to max
                  const maxCount = data.top_searches[0].count;
                  const ratio = search.count / maxCount;
                  const sizeClass = ratio > 0.8 ? 'text-sm font-semibold bg-primary-100 dark:bg-primary-900/40' 
                                  : ratio > 0.4 ? 'text-xs font-medium bg-slate-100 dark:bg-slate-800' 
                                  : 'text-[11px] bg-slate-50 dark:bg-slate-800/50';
                  
                  return (
                    <span key={i} className={`px-3 py-1.5 rounded-full text-slate-700 dark:text-slate-300 flex items-center gap-2 ${sizeClass}`}>
                      {search.term}
                      <span className="text-[10px] opacity-60 bg-white/50 dark:bg-black/20 px-1.5 rounded-full">{search.count}</span>
                    </span>
                  );
                })}
                {data.top_searches.length > 5 && (
                  <button
                    onClick={() => { setViewAllModal({isOpen: true, type: 'searches'}); setModalSearch(''); }}
                    className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                  >
                    +{data.top_searches.length - 5} more
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">No search data available yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View All Modal */}
      <Modal
        isOpen={viewAllModal.isOpen}
        onClose={() => {
          setViewAllModal({isOpen: false, type: null});
          setModalSearch('');
        }}
        title={viewAllModal.type === 'views' ? 'All Viewed Items' : 'All Searches'}
        className="max-w-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
      >
        <div className="mt-4">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all"
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {viewAllModal.type === 'views' && data?.top_items && (
              data.top_items
                .filter((item: any) => item.name.toLowerCase().includes(modalSearch.toLowerCase()))
                .length > 0 ? (
                  data.top_items
                    .filter((item: any) => item.name.toLowerCase().includes(modalSearch.toLowerCase()))
                    .map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="font-medium text-sm">{item.name}</span>
                        <div className="flex items-center">
                          <div className="w-32 h-2 bg-slate-100 dark:bg-slate-800 rounded-full mr-3 overflow-hidden">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: `${(item.count / data.top_items[0].count) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-semibold w-8 text-right">{item.count}</span>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-slate-500 py-4 text-center">No items match your search.</p>
                )
            )}

            {viewAllModal.type === 'searches' && data?.top_searches && (
              data.top_searches.filter((search: any) => search.term.toLowerCase().includes(modalSearch.toLowerCase())).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {data.top_searches
                    .filter((search: any) => search.term.toLowerCase().includes(modalSearch.toLowerCase()))
                    .map((search: any, i: number) => {
                      const maxCount = data.top_searches[0].count;
                      const ratio = search.count / maxCount;
                      const sizeClass = ratio > 0.8 ? 'text-sm font-semibold bg-primary-100 dark:bg-primary-900/40' 
                                      : ratio > 0.4 ? 'text-xs font-medium bg-slate-100 dark:bg-slate-800' 
                                      : 'text-[11px] bg-slate-50 dark:bg-slate-800/50';
                      return (
                        <span key={i} className={`px-3 py-1.5 rounded-full text-slate-700 dark:text-slate-300 flex items-center gap-2 ${sizeClass}`}>
                          {search.term}
                          <span className="text-[10px] opacity-60 bg-white/50 dark:bg-black/20 px-1.5 rounded-full">{search.count}</span>
                        </span>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-slate-500 py-4 text-center">No searches match your search.</p>
              )
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
