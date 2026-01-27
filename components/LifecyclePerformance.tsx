import React, { useState, useMemo } from 'react';
import { AdData } from '../types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend, ComposedChart, Bar, Area } from 'recharts';
import { TrendingUp, List, X, Search, PlayCircle, PauseCircle, StopCircle, HelpCircle } from 'lucide-react';

interface LifecyclePerformanceProps {
  data: AdData[];
}

export const LifecyclePerformance: React.FC<LifecyclePerformanceProps> = ({ data }) => {
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'overview'>('timeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'top10' | 'bottom10' | 'active' | 'paused'>('all');

  // Latest date in data
  const latestDateTimestamp = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.max(...data.map(d => d.date.getTime()));
  }, [data]);

  // Get unique posts
  const uniquePosts = useMemo(() => {
    return Array.from(new Set(data.map(d => d.contentName))).sort();
  }, [data]);

  // Group data by post for timeline view
  const postsData = useMemo(() => {
    const grouped = new Map<string, AdData[]>();
    data.forEach(d => {
      if (!grouped.has(d.contentName)) {
        grouped.set(d.contentName, []);
      }
      grouped.get(d.contentName)!.push(d);
    });

    const result: Array<{ 
      postName: string; 
      data: AdData[]; 
      totalSpend: number; 
      totalEarning: number; 
      finalRoi: number;
      status: string; // from actual data
      creator: string;
    }> = [];
    grouped.forEach((postData, postName) => {
      postData.sort((a, b) => a.date.getTime() - b.date.getTime());
      const last = postData[postData.length - 1];
      
      // Get status from the most recent data point
      // If status is 'unknown', derive from spending behavior
      let status = last.status;
      if (status === 'unknown') {
        // Derive status: if latest day has spend > 0, assume 'run', otherwise 'paused'
        if (last.date.getTime() === latestDateTimestamp && last.spend > 0) {
          status = 'run';
        } else {
          status = 'paused';
        }
      }
      
      result.push({
        postName,
        data: postData,
        totalSpend: last.cumulativeSpend,
        totalEarning: last.cumulativeEarning,
        finalRoi: last.cumulativeRoi,
        status,
        creator: last.creatorName
      });
    });

    return result.sort((a, b) => b.totalSpend - a.totalSpend);
  }, [data, latestDateTimestamp]);

  // Filtered posts data
  const filteredPostsData = useMemo(() => {
    let filtered = postsData;
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.postName.toLowerCase().includes(query) ||
        p.creator.toLowerCase().includes(query)
      );
    }
    
    // Apply filter mode
    switch (filterMode) {
      case 'top10':
        filtered = [...filtered].sort((a, b) => b.finalRoi - a.finalRoi).slice(0, 10);
        break;
      case 'bottom10':
        filtered = [...filtered].sort((a, b) => a.finalRoi - b.finalRoi).slice(0, 10);
        break;
      case 'active':
        filtered = filtered.filter(p => p.status === 'run');
        break;
      case 'paused':
        filtered = filtered.filter(p => p.status === 'paused' || p.status === 'stopped');
        break;
    }
    
    return filtered;
  }, [postsData, searchQuery, filterMode]);

  // Selected post timeline data
  const selectedPostTimeline = useMemo(() => {
    if (!selectedPost) return [];
    const postData = postsData.find(p => p.postName === selectedPost);
    if (!postData) return [];
    
    return postData.data.map(d => ({
      timestamp: d.date.getTime(),
      dateStr: d.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      cumulativeRoi: d.cumulativeRoi,
      cumulativeSpend: d.cumulativeSpend,
      cumulativeEarning: d.cumulativeEarning,
      dailySpend: d.spend,
      dailyEarning: d.earning,
      dailyRoi: d.roi
    }));
  }, [selectedPost, postsData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg z-50">
          <p className="font-bold text-slate-800 text-sm mb-2">{new Date(label).toLocaleDateString()}</p>
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex justify-between gap-4 text-xs mb-1">
              <span style={{ color: p.color }} className="font-medium">{p.name}:</span>
              <span className="font-mono text-slate-700">
                {p.dataKey.includes('roi') || p.dataKey.includes('Roi')
                  ? `${Number(p.value).toFixed(2)}x`
                  : `$${Number(p.value).toLocaleString()}`
                }
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Main View */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-slate-800">Post Lifecycle Analysis</h3>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                  viewMode === 'timeline' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <TrendingUp className="w-3 h-3" /> Timeline
              </button>
              <button
                onClick={() => setViewMode('overview')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                  viewMode === 'overview' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <List className="w-3 h-3" /> Overview
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'timeline' ? (
          <div className="space-y-4">
            {/* Post Selector - Simple search for timeline view */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <select
                value={selectedPost || ''}
                onChange={(e) => setSelectedPost(e.target.value || null)}
                className="flex-1 max-w-md border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">-- Select post --</option>
                {postsData
                  .filter(p => !searchQuery || p.postName.toLowerCase().includes(searchQuery.toLowerCase()) || p.creator.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(post => (
                  <option key={post.postName} value={post.postName}>
                    {post.postName} ({post.finalRoi.toFixed(2)}x) [{post.status}]
                  </option>
                ))}
              </select>
            </div>

            {/* Timeline Chart */}
            {selectedPost && selectedPostTimeline.length > 0 ? (
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={selectedPostTimeline} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="timestamp" 
                      type="number" 
                      domain={['auto', 'auto']}
                      tickFormatter={(u) => new Date(u).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                      fontSize={12} 
                      stroke="#94a3b8" 
                    />
                    <YAxis 
                      yAxisId="left"
                      fontSize={12} 
                      stroke="#94a3b8"
                      label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      fontSize={12} 
                      stroke="#94a3b8"
                      label={{ value: 'Cumulative ROI (x)', angle: 90, position: 'insideRight', fontSize: 10 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                    <ReferenceLine yAxisId="right" y={1} stroke="#ef4444" strokeDasharray="3 3" />
                    <Area 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="cumulativeSpend" 
                      fill="#6366f1" 
                      fillOpacity={0.2} 
                      stroke="#6366f1" 
                      strokeWidth={2}
                      name="Cumulative Spend"
                    />
                    <Area 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="cumulativeEarning" 
                      fill="#10b981" 
                      fillOpacity={0.2} 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Cumulative Earning"
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="cumulativeRoi" 
                      stroke="#ec4899" 
                      strokeWidth={3} 
                      name="Cumulative ROI"
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[500px] flex items-center justify-center bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">Select a post above to view its lifecycle timeline</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search and Filters for Overview */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search posts or creators..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as any)}
                className="text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Posts ({postsData.length})</option>
                <option value="top10">Top 10 ROI</option>
                <option value="bottom10">Bottom 10 ROI</option>
                <option value="active">Active Only</option>
                <option value="paused">Paused Only</option>
              </select>
              <span className="text-xs text-slate-500">
                Showing {filteredPostsData.length} posts
              </span>
            </div>
            
            <div className="h-[450px] overflow-y-auto">
              <div className="space-y-3">
                {filteredPostsData.map((post, idx) => (
                  <div
                    key={post.postName}
                    className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedPost(post.postName);
                      setViewMode('timeline');
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {post.status === 'run' ? (
                            <PlayCircle className="w-4 h-4 text-green-500" title="Running" />
                          ) : post.status === 'paused' ? (
                            <PauseCircle className="w-4 h-4 text-amber-500" title="Paused" />
                          ) : post.status === 'stopped' ? (
                            <StopCircle className="w-4 h-4 text-red-500" title="Stopped" />
                          ) : (
                            <HelpCircle className="w-4 h-4 text-slate-400" title="Unknown" />
                          )}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            post.status === 'run' ? 'bg-green-100 text-green-700' :
                            post.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                            post.status === 'stopped' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {post.status.toUpperCase()}
                          </span>
                          <h4 className="font-semibold text-slate-800 line-clamp-1">{post.postName}</h4>
                        </div>
                        <p className="text-xs text-slate-500">
                          {post.creator} • {post.data.length} days • 
                          {new Date(post.data[0].date).toLocaleDateString()} - {new Date(post.data[post.data.length - 1].date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <div className={`text-lg font-bold ${post.finalRoi >= 1 ? 'text-green-600' : 'text-red-500'}`}>
                          {post.finalRoi.toFixed(2)}x
                        </div>
                        <div className="text-xs text-slate-500">Lifecycle ROI</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-slate-100">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Total Spend</div>
                        <div className="text-sm font-semibold text-slate-800">${post.totalSpend.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Total Earning</div>
                        <div className="text-sm font-semibold text-green-600">${post.totalEarning.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Avg Daily ROI</div>
                        <div className="text-sm font-semibold text-indigo-600">
                          {(post.data.reduce((sum, d) => sum + d.roi, 0) / post.data.length).toFixed(2)}x
                        </div>
                      </div>
                    </div>

                    {/* Mini timeline bar */}
                    <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${post.finalRoi >= 1 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, post.finalRoi * 50)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selected Post Detail (if in timeline view) */}
      {selectedPost && selectedPostTimeline.length > 0 && viewMode === 'timeline' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-bold text-slate-800">Daily Breakdown: {selectedPost}</h4>
            <button
              onClick={() => setSelectedPost(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Daily Spend</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Daily Earning</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Daily ROI</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Cum. Spend</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Cum. Earning</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Cum. ROI</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {selectedPostTimeline.map((day, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-sm text-slate-700">{day.dateStr}</td>
                    <td className="px-4 py-2 text-sm text-right font-mono">${day.dailySpend.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-right font-mono text-green-600">${day.dailyEarning.toLocaleString()}</td>
                    <td className={`px-4 py-2 text-sm text-right font-mono font-bold ${day.dailyRoi >= 1 ? 'text-green-600' : 'text-red-500'}`}>
                      {day.dailyRoi.toFixed(2)}x
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-mono">${day.cumulativeSpend.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-right font-mono text-green-600">${day.cumulativeEarning.toLocaleString()}</td>
                    <td className={`px-4 py-2 text-sm text-right font-mono font-bold ${day.cumulativeRoi >= 1 ? 'text-green-600' : 'text-red-500'}`}>
                      {day.cumulativeRoi.toFixed(2)}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
