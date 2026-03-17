import React, { useEffect, useState, useMemo } from 'react';
import { fetchData, fetchBonusCalData, fetchPostLinks, fetchCreatorBonusCalData, fetchMonthlyEarningCalData, PostLinks } from './services/dataService';
import { AdData, FilterState, CreatorTierData, CreatorBonusCalData, MonthlyEarningRow } from './types';
import { Filters } from './components/Filters';
import { OverviewDashboard } from './components/OverviewDashboard';
import { LifecyclePerformance } from './components/LifecyclePerformance';
import { EarningsTab } from './components/EarningsTab';
import { LayoutDashboard, LineChart, DollarSign, Loader2, Menu, Lock } from 'lucide-react';

const ACCESS_CODE = '24564837';

const LoginGate: React.FC<{ onAuth: () => void }> = ({ onAuth }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === ACCESS_CODE) {
      sessionStorage.setItem('authed', '1');
      onAuth();
    } else {
      setError(true);
      setTimeout(() => setError(false), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-indigo-500 rounded-xl flex items-center justify-center mb-4 shadow-lg">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Influencer Analytics</h1>
          <p className="text-sm text-slate-300 mt-1">Enter access code to continue</p>
        </div>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access Code"
          autoFocus
          className={`w-full px-4 py-3 rounded-lg bg-white/10 border text-white placeholder-slate-400 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${error ? 'border-red-500 shake' : 'border-white/20'}`}
        />
        <button type="submit" className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors shadow-lg">
          Enter
        </button>
        {error && <p className="text-red-400 text-sm text-center mt-3">Incorrect code</p>}
      </form>
    </div>
  );
};

const App: React.FC = () => {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('authed') === '1');

  if (!authed) return <LoginGate onAuth={() => setAuthed(true)} />;

  return <Dashboard />;
};

const Dashboard: React.FC = () => {
  const [data, setData] = useState<AdData[]>([]);
  const [tierData, setTierData] = useState<CreatorTierData[]>([]);
  const [bonusCalData, setBonusCalData] = useState<CreatorBonusCalData[]>([]);
  const [monthlyEarningData, setMonthlyEarningData] = useState<MonthlyEarningRow[]>([]);
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
    Promise.all([
      fetchData(),
      fetchBonusCalData(),
      fetchPostLinks(),
      fetchCreatorBonusCalData(),
      fetchMonthlyEarningCalData().catch(() => [] as MonthlyEarningRow[]),
    ])
      .then(([adData, tierBonusData, linksData, creatorBonusData, monthlyData]) => {
        setData(adData);
        setTierData(tierBonusData);
        setPostLinks(linksData);
        setBonusCalData(creatorBonusData);
        setMonthlyEarningData(monthlyData);
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

  // Pass full tierData to components - month filtering is now handled inside TierRewardsTracker
  // This allows users to view historical months via the month selector

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

                {activeTab === 'overview' && <OverviewDashboard data={filteredData} tierData={tierData} postLinks={postLinks} bonusCalData={bonusCalData} monthlyEarningData={monthlyEarningData} />}
                {activeTab === 'lifecycle' && <LifecyclePerformance data={filteredData} />}
                {activeTab === 'earnings' && <EarningsTab adData={data} bonusCalData={bonusCalData} monthlyEarningData={monthlyEarningData} />}
            </div>
        </main>
      </div>
    </div>
  );
};

export default App;
