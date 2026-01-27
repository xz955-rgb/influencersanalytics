import React, { useState, useMemo } from 'react';
import { AdData } from '../types';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceLine, Legend, ComposedChart, Bar, Line } from 'recharts';
import { TrendingUp, BarChart3, LogIn } from 'lucide-react';

interface DailyPerformanceProps {
  data: AdData[];
}

export const DailyPerformance: React.FC<DailyPerformanceProps> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'scatter' | 'multi-metric'>('scatter');
  const [useLogScale, setUseLogScale] = useState(false); // Default to linear scale
  const [selectedPost, setSelectedPost] = useState<string | null>(null);

  // Format data for chart - filter out 0 ROI for log scale
  const chartData = useMemo(() => {
    const mapped = data.map(d => ({
      ...d,
      timestamp: d.date.getTime(),
    }));
    // For log scale, filter out ROI <= 0 as log can't handle them
    return useLogScale ? mapped.filter(d => d.roi > 0) : mapped;
  }, [data, useLogScale]);

  // Calculate log scale domain for better visibility
  const roiValues = chartData.map(d => d.roi).filter(r => r > 0);
  const minRoi = roiValues.length > 0 ? Math.min(...roiValues) : 0.01;
  const maxRoi = roiValues.length > 0 ? Math.max(...roiValues) : 10;
  
  // For log scale, we'll use a custom domain that better separates low and high values
  const logDomain = useMemo(() => {
    if (!useLogScale || roiValues.length === 0) return [0, 'auto'];
    const logMin = Math.max(0.01, minRoi * 0.5);
    const logMax = maxRoi * 1.5;
    return [logMin, logMax];
  }, [useLogScale, minRoi, maxRoi, roiValues.length]);

  // Multi-metric data grouped by date
  const multiMetricData = useMemo(() => {
    const grouped = new Map<number, { spend: number; earning: number; roi: number; count: number }>();
    
    chartData.forEach(d => {
      const dateKey = new Date(d.date.getFullYear(), d.date.getMonth(), d.date.getDate()).getTime();
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, { spend: 0, earning: 0, roi: 0, count: 0 });
      }
      const day = grouped.get(dateKey)!;
      day.spend += d.spend;
      day.earning += d.earning;
      day.count += 1;
    });

    return Array.from(grouped.entries())
      .map(([timestamp, values]) => ({
        timestamp,
        dateStr: new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        spend: values.spend,
        earning: values.earning,
        roi: values.spend > 0 ? values.earning / values.spend : 0,
        count: values.count
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [chartData]);

  // Selected post data
  const selectedPostData = useMemo(() => {
    if (!selectedPost) return null;
    return chartData
      .filter(d => d.contentName === selectedPost)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(d => ({
        timestamp: d.timestamp,
        dateStr: d.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        spend: d.spend,
        earning: d.earning,
        roi: d.roi,
        cumulativeSpend: d.cumulativeSpend,
        cumulativeEarning: d.cumulativeEarning,
        cumulativeRoi: d.cumulativeRoi
      }));
  }, [selectedPost, chartData]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg z-50 max-w-xs">
          <p className="font-bold text-slate-800 text-sm mb-1 line-clamp-2">{d.contentName}</p>
          <p className="text-slate-500 text-xs mb-2">{d.date.toLocaleDateString()} • {d.creatorName}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-slate-500">ROI:</span>
            <span className={`font-mono font-bold ${d.roi >= 1 ? 'text-green-600' : 'text-red-500'}`}>{d.roi.toFixed(2)}x</span>
            <span className="text-slate-500">Spend:</span>
            <span className="font-mono text-slate-700">${d.spend.toLocaleString()}</span>
            <span className="text-slate-500">Earning:</span>
            <span className="font-mono text-slate-700">${d.earning.toLocaleString()}</span>
            <span className="text-slate-500">Platform:</span>
            <span className="text-slate-700">{d.platform}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomTooltipMulti = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg z-50">
          <p className="font-bold text-slate-800 text-sm mb-2">{label}</p>
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex justify-between gap-4 text-xs mb-1">
              <span style={{ color: p.color }} className="font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                {p.name}:
              </span>
              <span className="font-mono text-slate-700">
                {p.dataKey === 'roi' 
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

  const platforms = Array.from(new Set(chartData.map(d => d.platform)));
  const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  // Get unique posts for selection
  const uniquePosts = Array.from(new Set(chartData.map(d => d.contentName))).sort();

  return (
    <div className="space-y-6">
      {/* Main Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[600px] flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-slate-800">
              {viewMode === 'scatter' ? 'Daily ROI vs Spend' : 'Daily Performance: Multi-Metric View'}
            </h3>
            {viewMode === 'scatter' && (
              <button
                onClick={() => setUseLogScale(!useLogScale)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  useLogScale 
                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="Toggle logarithmic scale for better visibility of low ROI data"
              >
                <LogIn className="w-3 h-3 inline mr-1" />
                {useLogScale ? 'Log Scale' : 'Linear'}
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('scatter')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                  viewMode === 'scatter' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <BarChart3 className="w-3 h-3" /> Scatter
              </button>
              <button
                onClick={() => setViewMode('multi-metric')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                  viewMode === 'multi-metric' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <TrendingUp className="w-3 h-3" /> Multi-Metric
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 w-full min-h-0">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
              <div className="text-center">
                <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500">No data available for the selected filters</p>
                {useLogScale && <p className="text-xs text-slate-400 mt-1">Try switching to Linear scale (ROI = 0 is hidden in Log scale)</p>}
              </div>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'scatter' ? (
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  type="number" 
                  dataKey="timestamp" 
                  name="Date" 
                  domain={['auto', 'auto']}
                  tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <YAxis 
                  type="number" 
                  dataKey="roi" 
                  name="ROI" 
                  unit="x" 
                  domain={useLogScale ? logDomain : [0, Math.max(3, maxRoi * 1.1)]}
                  scale={useLogScale ? 'log' : 'linear'}
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <ZAxis type="number" dataKey="spend" range={[50, 600]} name="Spend" />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Legend />
                <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Break Even (ROI=1)', fill: '#ef4444', fontSize: 10, position: 'insideRight' }} />
                
                {platforms.map((platform, index) => (
                    <Scatter 
                        key={platform} 
                        name={platform} 
                        data={chartData.filter(d => d.platform === platform)} 
                        fill={colors[index % colors.length]} 
                        fillOpacity={0.7}
                        onClick={(data: any) => data && data.contentName && setSelectedPost(data.contentName)}
                        className="cursor-pointer"
                    />
                ))}
              </ScatterChart>
            ) : (
              <ComposedChart data={multiMetricData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
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
                  label={{ value: 'ROI (x)', angle: 90, position: 'insideRight', fontSize: 10 }}
                />
                <Tooltip content={<CustomTooltipMulti />} />
                <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                <ReferenceLine yAxisId="right" y={1} stroke="#ef4444" strokeDasharray="3 3" />
                <Bar yAxisId="left" dataKey="spend" fill="#6366f1" name="Spend" opacity={0.7} />
                <Bar yAxisId="left" dataKey="earning" fill="#10b981" name="Earning" opacity={0.7} />
                <Line yAxisId="right" type="monotone" dataKey="roi" stroke="#ec4899" strokeWidth={2} name="ROI" dot={{ r: 3 }} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Selected Post Detail Panel */}
      {selectedPost && selectedPostData && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h4 className="text-lg font-bold text-slate-800">{selectedPost}</h4>
              <p className="text-sm text-slate-500">Post Performance Details</p>
            </div>
            <button
              onClick={() => setSelectedPost(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Total Spend</div>
              <div className="text-lg font-bold text-slate-800">
                ${selectedPostData.reduce((sum, d) => sum + d.spend, 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Total Earning</div>
              <div className="text-lg font-bold text-green-600">
                ${selectedPostData.reduce((sum, d) => sum + d.earning, 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Avg Daily ROI</div>
              <div className="text-lg font-bold text-indigo-600">
                {(selectedPostData.reduce((sum, d) => sum + d.roi, 0) / selectedPostData.length).toFixed(2)}x
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Lifecycle ROI</div>
              <div className={`text-lg font-bold ${selectedPostData[selectedPostData.length - 1]?.cumulativeRoi >= 1 ? 'text-green-600' : 'text-red-500'}`}>
                {selectedPostData[selectedPostData.length - 1]?.cumulativeRoi.toFixed(2)}x
              </div>
            </div>
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={selectedPostData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="timestamp" 
                  type="number" 
                  domain={['auto', 'auto']}
                  tickFormatter={(u) => new Date(u).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                  fontSize={10} 
                  stroke="#94a3b8" 
                />
                <YAxis 
                  yAxisId="left"
                  fontSize={10} 
                  stroke="#94a3b8"
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  fontSize={10} 
                  stroke="#94a3b8"
                />
                <Tooltip content={<CustomTooltipMulti />} />
                <Legend wrapperStyle={{fontSize: '10px', paddingTop: '10px'}} />
                <ReferenceLine yAxisId="right" y={1} stroke="#ef4444" strokeDasharray="3 3" />
                <Bar yAxisId="left" dataKey="spend" fill="#6366f1" name="Spend" opacity={0.7} />
                <Bar yAxisId="left" dataKey="earning" fill="#10b981" name="Earning" opacity={0.7} />
                <Line yAxisId="right" type="monotone" dataKey="roi" stroke="#ec4899" strokeWidth={2} name="ROI" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
