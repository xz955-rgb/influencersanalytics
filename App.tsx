import React, { useEffect, useState, useMemo } from 'react';
import { fetchData, fetchBonusCalData, fetchPostLinks, fetchCreatorBonusCalData, PostLinks } from './services/dataService';
import { AdData, FilterState, CreatorTierData, CreatorBonusCalData } from './types';
import { Filters } from './components/Filters';
import { OverviewDashboard } from './components/OverviewDashboard';
import { LifecyclePerformance } from './components/LifecyclePerformance';
import { EarningsTab } from './components/EarningsTab';
import { LayoutDashboard, LineChart, DollarSign, Loader2, Menu } from 'lucide-react';

const App: React.FC = () => {
  const [data, setData] = useState<AdData[]>([]);
  const [tierData, setTierData] = useState<CreatorTierData[]>([]);
  const [bonusCalData, setBonusCalData] = useState<CreatorBonusCalData[]>([]);
  const [postLinks, setPostLinks] = useState<Map<string, PostLinks>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'lifecycle' | 'earnings'>('overview');

  // Filters State
  const [filters, setFilters] = useState<FilterState>({
    startDate: '',
    endDate: '',
    creators: [],
    platforms: [],
    categories: [],
    themes: []
  });

  // Load Data
  useEffect(() => {
    Promise.all([fetchData(), fetchBonusCalData(), fetchPostLinks(), fetchCreatorBonusCalData()])
      .then(([adData, tierBonusData, linksData, creatorBonusData]) => {
        setData(adData);
        setTierData(tierBonusData);
        setPostLinks(linksData);
        setBonusCalData(creatorBonusData);
        // Initialize Date Filters
        if (adData.length > 0) {
            const minDate = new Date(Math.min(...adData.map(i => i.date.getTime())));
            const maxDate = new Date(Math.max(...adData.map(i => i.date.getTime())));
            setFilters(prev => ({
                ...prev,
                startDate: minDate.toISOString().split('T')[0],
                endDate: maxDate.toISOString().split('T')[0]
            }));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load analytics data. Please try again later.");
        setLoading(false);
      });
  }, []);

  // Compute Unique Options for Filters
  const uniqueOptions = useMemo(() => {
    const getUniques = (key: keyof AdData) => Array.from(new Set(data.map(d => String(d[key])))).sort();
    return {
      creators: getUniques('creatorName'),
      platforms: getUniques('platform'),
      categories: getUniques('category'),
      themes: getUniques('theme')
    };
  }, [data]);

  // Filter tierData by current month - don't show old month's data
  const currentMonthTierData = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const filtered = tierData.filter(d => d.dataMonth === currentMonth);
    // If no data for current month, return empty array (will show message in TierRewardsTracker)
    return filtered;
  }, [tierData]);

  // Apply Filters
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const dateMatch = (!filters.startDate || item.date >= new Date(filters.startDate)) &&
                        (!filters.endDate || item.date <= new Date(filters.endDate));
      const creatorMatch = filters.creators.length === 0 || filters.creators.includes(item.creatorName);
      const platformMatch = filters.platforms.length === 0 || filters.platforms.includes(item.platform);
      const categoryMatch = filters.categories.length === 0 || filters.categories.includes(item.category);
      const themeMatch = filters.themes.length === 0 || filters.themes.includes(item.theme);

      return dateMatch && creatorMatch && platformMatch && categoryMatch && themeMatch;
    });
  }, [data, filters]);

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-indigo-600">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-slate-800">Loading Analytics...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside 
        className={`${isSidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 ease-in-out relative z-20 flex-shrink-0 bg-white border-r border-slate-200 shadow-xl lg:shadow-none`}
      >
        <div className="h-full overflow-hidden">
            <Filters 
                filters={filters} 
                setFilters={setFilters} 
                uniqueOptions={uniqueOptions} 
            />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
            >
                <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                Influencer Analytics
            </h1>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button 
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <LayoutDashboard className="w-4 h-4" /> Overview
            </button>
            <button 
                onClick={() => setActiveTab('lifecycle')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'lifecycle' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <LineChart className="w-4 h-4" /> Lifecycle
            </button>
            <button 
                onClick={() => setActiveTab('earnings')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'earnings' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <DollarSign className="w-4 h-4" /> Earnings
            </button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
            <div className="max-w-7xl mx-auto pb-10">
                {activeTab !== 'earnings' && (
                  <div className="mb-6">
                      <h2 className="text-2xl font-bold text-slate-800">
                          {activeTab === 'overview' && 'Dashboard Overview'}
                          {activeTab === 'lifecycle' && 'Cumulative Lifecycle Analysis'}
                      </h2>
                      <p className="text-slate-500 text-sm">
                          Showing data for {filteredData.length} records based on current filters.
                      </p>
                  </div>
                )}

                {activeTab === 'overview' && <OverviewDashboard data={filteredData} tierData={currentMonthTierData} postLinks={postLinks} />}
                {activeTab === 'lifecycle' && <LifecyclePerformance data={filteredData} />}
                {activeTab === 'earnings' && <EarningsTab adData={data} bonusCalData={bonusCalData} />}
            </div>
        </main>
      </div>
    </div>
  );
};

export default App;
