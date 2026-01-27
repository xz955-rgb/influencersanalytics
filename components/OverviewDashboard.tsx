import React, { useMemo, useState, useEffect } from 'react';
import { AdData, CreatorTierData } from '../types';
import { KpiCard } from './KpiCard';
import { TierRewardsTracker } from './TierRewardsTracker';
import { 
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter, PieChart, Pie, ComposedChart,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Cell, ReferenceLine, ReferenceArea
} from 'recharts';
import { 
  ChevronDown, PieChart as PieIcon, Activity, TrendingUp, FilterX, Layers, 
  Check, CheckSquare, Square, ArrowUpDown, DollarSign, Calendar, Clock, 
  PlayCircle, PauseCircle, StopCircle, AlertCircle, Target, Zap, AlertTriangle, 
  AlertCircle as AlertIcon, TrendingDown, TrendingUp as TrendingUpIcon
} from 'lucide-react';

interface OverviewProps {
  data: AdData[];
  tierData: CreatorTierData[];
}

// 1. Consistent Color Palette
const PALETTE = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ef4444', // Red
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#d946ef', // Fuchsia
  '#64748b', // Slate
  '#a855f7', // Purple
  '#eab308', // Yellow
];
const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return percent > 0.05 ? (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  ) : null;
};

// Helper for duration formatting
const formatDuration = (ms: number) => {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
    return `${days} days`;
};

export const OverviewDashboard: React.FC<OverviewProps> = ({ data, tierData }) => {
  // ----------------------------------------------------------------------
  // 1. KPI Calculations & Global Stats
  // ----------------------------------------------------------------------
  const kpis = useMemo(() => {
    const totalSpend = data.reduce((sum, item) => sum + item.spend, 0);
    const totalGmv = data.reduce((sum, item) => sum + item.gmv, 0);
    const totalEarning = data.reduce((sum, item) => sum + item.earning, 0);
    const overallRoi = totalSpend > 0 ? totalEarning / totalSpend : 0;
    // Count unique posts
    const uniquePosts = new Set(data.map(d => d.contentName)).size;
    return { totalSpend, totalGmv, totalEarning, overallRoi, uniquePosts };
  }, [data]);

  // Determine Latest Date in the current dataset
  const latestDateTimestamp = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.max(...data.map(d => d.date.getTime()));
  }, [data]);

  const latestDateObj = useMemo(() => new Date(latestDateTimestamp), [latestDateTimestamp]);

  // Pre-calculate start dates for all posts to determine duration
  const postStartDates = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(d => {
       const current = map.get(d.contentName);
       if (!current || d.date.getTime() < current) {
           map.set(d.contentName, d.date.getTime());
       }
    });
    return map;
  }, [data]);

  // ----------------------------------------------------------------------
  // 2. Latest Day Analysis
  // ----------------------------------------------------------------------
  const latestDayData = useMemo(() => {
    if (!latestDateTimestamp) return [];
    return data
      .filter(d => d.date.getTime() === latestDateTimestamp)
      .sort((a, b) => b.roi - a.roi); // Sort by ROI from high to low
  }, [data, latestDateTimestamp]);

  const latestDayStats = useMemo(() => {
    const spend = latestDayData.reduce((s, i) => s + i.spend, 0);
    const earning = latestDayData.reduce((s, i) => s + i.earning, 0);
    const roi = spend > 0 ? earning / spend : 0;
    const count = latestDayData.length;
    return { spend, earning, roi, count };
  }, [latestDayData]);

  // Strategy Matrix Data
  const [selectedStrategyType, setSelectedStrategyType] = useState<'cow' | 'scale' | 'alert' | 'test' | null>(null);
  
  const strategyMatrixData = useMemo(() => {
      // Calculate Avg Spend to determine "High Spend" vs "Low Spend"
      const spends = latestDayData.map(d => d.spend);
      const avgSpend = spends.length > 0 ? spends.reduce((a, b) => a + b, 0) / spends.length : 0;
      const spendThreshold = avgSpend;

      let counts = { scale: 0, cow: 0, alert: 0, test: 0 };

      const processed = latestDayData.map(d => {
          let status = '';
          let color = '';
          let type: 'cow' | 'scale' | 'alert' | 'test' = 'test';
          
          // Fixed logic: Cash Cow must have ROI >= 1 AND high spend
          if (d.roi >= 1) {
              if (d.spend >= spendThreshold) {
                  status = 'Cash Cow (Maintain)';
                  color = '#10b981'; // Emerald
                  counts.cow++;
                  type = 'cow';
              } else {
                  status = 'Opportunity (Scale Up)';
                  color = '#3b82f6'; // Blue
                  counts.scale++;
                  type = 'scale';
              }
          } else {
              if (d.spend >= spendThreshold) {
                  status = 'Inefficient (Reduce)';
                  color = '#ef4444'; // Red
                  counts.alert++;
                  type = 'alert';
              } else {
                  status = 'Testing / Watch';
                  color = '#f59e0b'; // Amber
                  counts.test++;
                  type = 'test';
              }
          }
          return { ...d, strategyStatus: status, strategyColor: color, strategyType: type };
      });

      // Sort: if strategy type selected, put those first
      const sorted = [...processed];
      if (selectedStrategyType) {
          sorted.sort((a, b) => {
              if (a.strategyType === selectedStrategyType && b.strategyType !== selectedStrategyType) return -1;
              if (a.strategyType !== selectedStrategyType && b.strategyType === selectedStrategyType) return 1;
              return b.roi - a.roi; // Then by ROI
          });
      }

      return { data: sorted, counts, threshold: spendThreshold };
  }, [latestDayData, selectedStrategyType]);


  // ----------------------------------------------------------------------
  // 3. Breakdown Analysis (Charts)
  // ----------------------------------------------------------------------
  const [breakdownView, setBreakdownView] = useState<'trend' | 'distribution' | 'multi-metric'>('trend');
  const [compDimension, setCompDimension] = useState<'creatorName' | 'category' | 'theme'>('category');
  const [compMetric, setCompMetric] = useState<'spend' | 'roi' | 'earning'>('roi');
  const [focusEntity, setFocusEntity] = useState<string>(''); 
  const [topN, setTopN] = useState<number>(5);
  const [selectedPost, setSelectedPost] = useState<string | null>(null); 

  useEffect(() => {
    setFocusEntity('');
  }, [compDimension]);

  const getColorForEntity = (name: string, allEntities: string[]) => {
    const index = allEntities.indexOf(name);
    return index >= 0 ? PALETTE[index % PALETTE.length] : '#94a3b8';
  };

  const allEntitiesSorted = useMemo(() => {
    const totals = data.reduce((acc, item) => {
      const key = item[compDimension] || 'Unknown';
      if (!acc[key]) acc[key] = 0;
      acc[key] += item.spend; 
      return acc;
    }, {} as Record<string, number>);
    return Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  }, [data, compDimension]);

  const availableEntitiesAlpha = useMemo(() => {
    return [...allEntitiesSorted].sort();
  }, [allEntitiesSorted]);

  const targetEntities = useMemo(() => {
    if (focusEntity) return [focusEntity];
    if (topN === -1) return allEntitiesSorted; 
    return allEntitiesSorted.slice(0, topN);
  }, [focusEntity, topN, allEntitiesSorted]);

  const distributionData = useMemo(() => {
    const grouped = data.reduce((acc, item) => {
      const key = item[compDimension] || 'Unknown';
      if (!acc[key]) acc[key] = 0;
      if (compMetric === 'earning') acc[key] += item.earning;
      else acc[key] += item.spend; 
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data, compDimension, compMetric]);

  const trendData = useMemo(() => {
    const groupedByDate = new Map<number, Record<string, { spend: number, earning: number }>>();

    data.forEach(d => {
      const entityName = d[compDimension] || 'Unknown';
      if (!targetEntities.includes(entityName)) return;

      const dateKey = new Date(d.date.getFullYear(), d.date.getMonth(), d.date.getDate()).getTime();
      if (!groupedByDate.has(dateKey)) groupedByDate.set(dateKey, {});
      
      const dayRecord = groupedByDate.get(dateKey)!;
      if (!dayRecord[entityName]) dayRecord[entityName] = { spend: 0, earning: 0 };
      
      dayRecord[entityName].spend += d.spend;
      dayRecord[entityName].earning += d.earning;
    });

    const result = Array.from(groupedByDate.entries()).map(([date, entities]) => {
      const row: any = { timestamp: date, dateStr: new Date(date).toLocaleDateString() };
      Object.entries(entities).forEach(([entity, val]) => {
        if (compMetric === 'roi') {
            row[entity] = val.spend > 0 ? val.earning / val.spend : 0;
        } else if (compMetric === 'earning') {
            row[entity] = val.earning;
        } else {
            row[entity] = val.spend;
        }
        // Always include spend and earning for multi-metric view
        row[`${entity}_spend`] = val.spend;
        row[`${entity}_earning`] = val.earning;
        row[`${entity}_roi`] = val.spend > 0 ? val.earning / val.spend : 0;
      });
      return row;
    }).sort((a: any, b: any) => Number(a.timestamp) - Number(b.timestamp));

    return { data: result, keys: targetEntities };
  }, [data, compDimension, compMetric, targetEntities]);

  // Multi-metric aggregated data (all metrics combined)
  const multiMetricData = useMemo(() => {
    const groupedByDate = new Map<number, { spend: number, earning: number, count: number }>();

    data.forEach(d => {
      const entityName = d[compDimension] || 'Unknown';
      if (!targetEntities.includes(entityName)) return;

      const dateKey = new Date(d.date.getFullYear(), d.date.getMonth(), d.date.getDate()).getTime();
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, { spend: 0, earning: 0, count: 0 });
      }
      
      const day = groupedByDate.get(dateKey)!;
      day.spend += d.spend;
      day.earning += d.earning;
      day.count += 1;
    });

    return Array.from(groupedByDate.entries())
      .map(([date, values]) => ({
        timestamp: date,
        dateStr: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        spend: values.spend,
        earning: values.earning,
        roi: values.spend > 0 ? values.earning / values.spend : 0,
        count: values.count
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data, compDimension, targetEntities]);

  const handlePieClick = (entry: any) => {
    if (entry && entry.name) {
        setFocusEntity(entry.name);
        setBreakdownView('trend');
    }
  };


  // ----------------------------------------------------------------------
  // 4. Deep Dive Analysis
  // ----------------------------------------------------------------------
  const [drillDimension, setDrillDimension] = useState<'platform' | 'category' | 'theme' | 'all'>('category');
  const [drillValue, setDrillValue] = useState<string>('');
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'spend', direction: 'desc' });
  const [deepDiveRoiFilter, setDeepDiveRoiFilter] = useState<'all' | 'high' | 'low'>('all');
  const [deepDiveUseLogScale, setDeepDiveUseLogScale] = useState(false);

  const drillOptions = useMemo(() => {
    if (drillDimension === 'all') return [];
    const options = new Set(data.map(d => String(d[drillDimension])));
    return Array.from(options).sort();
  }, [data, drillDimension]);

  useEffect(() => {
    if (drillDimension === 'all') return;
    if ((!drillValue || !drillOptions.includes(drillValue)) && drillOptions.length > 0) {
      setDrillValue(drillOptions[0]);
    }
  }, [drillOptions, drillValue, drillDimension]);

  const segmentData = useMemo(() => {
    let filtered = data;
    
    if (drillDimension === 'all') {
      filtered = data;
    } else if (drillValue) {
      filtered = data.filter(d => String(d[drillDimension]) === drillValue);
    } else {
      return [];
    }
    
    // Apply ROI filter
    if (deepDiveRoiFilter === 'high') {
      filtered = filtered.filter(d => d.roi >= 1);
    } else if (deepDiveRoiFilter === 'low') {
      filtered = filtered.filter(d => d.roi < 1);
    }
    
    return filtered.map(d => ({
      ...d,
      timestamp: d.date.getTime(),
      scatterKey: `${d.contentName}-${d.date.getTime()}`
    }));
  }, [data, drillDimension, drillValue, deepDiveRoiFilter]);

  // Dynamic Y-Axis Scaling Logic for Daily Performance Chart
  const scatterYDomain = useMemo(() => {
    // 1. If posts are selected, zoom to their range
    if (selectedPosts.length > 0) {
        const selectedData = segmentData.filter(d => selectedPosts.includes(d.contentName));
        if (selectedData.length > 0) {
            const rois = selectedData.map(d => d.roi);
            const min = Math.min(...rois);
            const max = Math.max(...rois);
            
            // Add 10% padding for visual comfort
            const padding = (max - min) * 0.1 || 0.5; // Default 0.5 padding if min==max
            const finalMin = Math.max(0, min - padding);
            const finalMax = max + padding;
            
            return [Number(finalMin.toFixed(2)), Number(finalMax.toFixed(2))];
        }
    }

    // 2. Use log scale if enabled
    if (deepDiveUseLogScale && segmentData.length > 0) {
      const rois = segmentData.map(d => d.roi).filter(r => r > 0);
      if (rois.length > 0) {
        const minRoi = Math.max(0.01, Math.min(...rois) * 0.5);
        const maxRoi = Math.max(...rois) * 1.5;
        return [minRoi, maxRoi];
      }
    }

    // 3. Default Scale Cap (Request: max 3)
    return [0, 3];
  }, [segmentData, selectedPosts, deepDiveUseLogScale]);

  // Aggregated Data for Deep Dive Leaderboard
  const postsInSegmentAggregated = useMemo(() => {
    const stats: Record<string, { 
        spend: number, earning: number, creator: string, platform: string, 
        minTime: number, maxTime: number, status: string
    }> = {};
    
    // Calculate total spend per creator for spend percentage
    const creatorTotalSpend: Record<string, number> = {};
    segmentData.forEach(item => {
        creatorTotalSpend[item.creatorName] = (creatorTotalSpend[item.creatorName] || 0) + item.spend;
    });
    
    segmentData.forEach(item => {
        if (!stats[item.contentName]) {
            stats[item.contentName] = { 
                spend: 0, earning: 0, creator: item.creatorName, platform: item.platform,
                minTime: item.date.getTime(), maxTime: item.date.getTime(),
                status: item.status
            };
        }
        const s = stats[item.contentName];
        s.spend += item.spend;
        s.earning += item.earning;
        s.minTime = Math.min(s.minTime, item.date.getTime());
        s.maxTime = Math.max(s.maxTime, item.date.getTime());
        // Keep the most recent status
        if (item.date.getTime() >= s.maxTime) {
            s.status = item.status;
        }
    });

    const list = Object.entries(stats).map(([name, val]) => {
        const creatorTotal = creatorTotalSpend[val.creator] || 0;
        return {
            contentName: name,
            ...val,
            roi: val.spend > 0 ? val.earning / val.spend : 0,
            durationDays: Math.floor((val.maxTime - val.minTime) / (1000 * 60 * 60 * 24)) + 1,
            // Status: Use actual status from data, fallback to derived status
            isActive: val.status === 'run' || (val.status === 'unknown' && val.maxTime === latestDateTimestamp),
            // Spend percentage of creator's total
            spendPercent: creatorTotal > 0 ? (val.spend / creatorTotal) * 100 : 0
        };
    });

    return list.sort((a, b) => {
        const valA = (a as any)[sortConfig.key];
        const valB = (b as any)[sortConfig.key];
        if (typeof valA === 'string' && typeof valB === 'string') {
             return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        // boolean sort (active first)
        if (typeof valA === 'boolean' && typeof valB === 'boolean') {
             return sortConfig.direction === 'asc' ? (valA === valB ? 0 : valA ? -1 : 1) : (valA === valB ? 0 : valA ? 1 : -1);
        }
        return sortConfig.direction === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [segmentData, sortConfig, latestDateTimestamp]);

  const postNamesInSegment = useMemo(() => postsInSegmentAggregated.map(p => p.contentName), [postsInSegmentAggregated]);

  useEffect(() => {
    if (postNamesInSegment.length > 0) {
       setSelectedPosts(postNamesInSegment.slice(0, Math.min(5, postNamesInSegment.length)));
    } else {
      setSelectedPosts([]);
    }
  }, [postNamesInSegment, drillValue, drillDimension]);

  const togglePostSelection = (postName: string) => {
      setSelectedPosts(prev => {
          if (prev.includes(postName)) {
              return prev.filter(p => p !== postName);
          } else {
              return [...prev, postName];
          }
      });
  };

  const handleSelectAll = () => {
    if (selectedPosts.length === postNamesInSegment.length) {
        setSelectedPosts([]);
    } else {
        setSelectedPosts(postNamesInSegment);
    }
  };

  const handleSort = (key: string) => {
      setSortConfig(prev => ({
          key,
          direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const multiPostData = useMemo(() => {
    if (selectedPosts.length === 0) return [];
    
    const grouped = new Map<number, Record<string, { spend: number, roi: number, earning: number }>>();

    segmentData.forEach(d => {
        if (!selectedPosts.includes(d.contentName)) return;

        if (!grouped.has(d.timestamp)) grouped.set(d.timestamp, {});
        const dayRecord = grouped.get(d.timestamp)!;
        
        dayRecord[d.contentName] = { 
            spend: d.spend, 
            roi: d.roi,
            earning: d.earning
        };
    });

    return Array.from(grouped.entries())
        .map(([ts, posts]) => {
            const row: any = { timestamp: ts, dateStr: new Date(ts).toLocaleDateString() };
            Object.entries(posts).forEach(([postName, metrics]) => {
                row[`${postName}_spend`] = metrics.spend;
                row[`${postName}_roi`] = metrics.roi;
                row[`${postName}_earning`] = metrics.earning;
            });
            return row;
        })
        .sort((a, b) => a.timestamp - b.timestamp);
  }, [segmentData, selectedPosts]);

  // ----------------------------------------------------------------------
  // Interaction Handlers
  // ----------------------------------------------------------------------
  const scrollToDeepDive = () => {
    const element = document.getElementById('deep-dive-section');
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSnapshotClick = (postName: string) => {
    setDrillDimension('all');
    setSelectedPosts([postName]);
    scrollToDeepDive();
  };

  const handleStrategyCardClick = (type: 'cow' | 'scale' | 'alert' | 'test') => {
     const targetPosts = strategyMatrixData.data
        .filter(d => d.strategyType === type)
        .map(d => d.contentName);
     
     if (targetPosts.length > 0) {
        setDrillDimension('all');
        setSelectedPosts(targetPosts);
        scrollToDeepDive();
     }
  };
  
  const handleMatrixDotClick = (data: any) => {
     if (data && data.contentName) {
         setDrillDimension('all');
         setSelectedPosts([data.contentName]);
         scrollToDeepDive();
     }
  };

  const handleKpiClick = () => {
      setDrillDimension('all');
      scrollToDeepDive();
  };

  // ----------------------------------------------------------------------
  // Render Helpers
  // ----------------------------------------------------------------------

  const CustomTooltipTrend = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg z-50">
          <p className="font-bold text-slate-800 mb-2">
            {typeof label === 'number' ? new Date(label).toLocaleDateString() : label}
          </p>
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex justify-between gap-4 text-xs mb-1">
              <span style={{ color: p.color }} className="font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                {p.name}:
              </span>
              <span className="font-mono text-slate-600">
                {p.dataKey === 'roi' || (compMetric === 'roi' && !p.dataKey.includes('_'))
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

  const CustomTooltipScatter = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg z-50 max-w-xs">
          <p className="font-bold text-slate-800 text-sm mb-1 line-clamp-2">{d.contentName}</p>
          <p className="text-xs text-slate-500 mb-2">{d.date.toLocaleDateString()} • {d.creatorName}</p>
          <div className="grid grid-cols-2 gap-x-3 text-xs">
            <span>ROI:</span> <span className={`font-mono font-bold ${d.roi >= 1 ? 'text-green-600' : 'text-red-500'}`}>{d.roi.toFixed(2)}x</span>
            <span>Spend:</span> <span className="font-mono text-slate-700">${d.spend.toLocaleString()}</span>
            <span>Earning:</span> <span className="font-mono text-slate-700">${d.earning.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomTooltipMatrix = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
          const d = payload[0].payload;
          return (
              <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg z-50 max-w-xs">
                  <div className="mb-2 border-b border-slate-100 pb-2">
                      <p className="font-bold text-slate-800 text-sm line-clamp-2">{d.contentName}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold inline-block mt-1" style={{backgroundColor: `${d.strategyColor}20`, color: d.strategyColor}}>
                          {d.strategyStatus}
                      </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 text-xs">
                      <span className="text-slate-500">Daily ROI:</span> <span className="font-bold">{d.roi.toFixed(2)}x</span>
                      <span className="text-slate-500">Daily Spend:</span> <span className="font-mono">${d.spend.toLocaleString()}</span>
                  </div>
              </div>
          );
      }
      return null;
  };

  const CustomTooltipMulti = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg z-50 max-w-[250px]">
          <p className="font-bold text-slate-800 mb-2">{new Date(label).toLocaleDateString()}</p>
          {payload.map((p: any, idx: number) => {
             const rawKey = p.dataKey as string;
             const isRoi = rawKey.endsWith('_roi');
             const name = rawKey.replace(isRoi ? '_roi' : '_spend', '');
             return (
                <div key={idx} className="flex justify-between items-center gap-2 text-xs mb-1">
                    <div className="flex items-center gap-1 overflow-hidden">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: p.color}}></span>
                        <span className="truncate text-slate-600" title={name}>{name}</span>
                    </div>
                    <span className="font-mono font-medium whitespace-nowrap">
                        {isRoi ? `${Number(p.value).toFixed(2)}x` : `$${Number(p.value).toLocaleString()}`}
                    </span>
                </div>
             );
          })}
        </div>
      );
    }
    return null;
  };

  // Strategy Alerts
  const [alertViewMode, setAlertViewMode] = useState<'posts' | 'content'>('posts');
  const [alertPage, setAlertPage] = useState(0);
  const ALERTS_PER_PAGE = 6;
  
  const strategyAlerts = useMemo(() => {
    const alerts: Array<{
      type: 'warning' | 'opportunity';
      title: string;
      description: string;
      posts: Array<{ 
        name: string; 
        creator: string; 
        days: number; 
        spend: number; 
        spendPercent: number; 
        lifecycleRoi: number;
        recentRoi: number; // 近3天平均ROI
        latestRoi: number; // 最新一天ROI
        trend: 'up' | 'down' | 'stable';
      }>;
    }> = [];

    // Group by creator
    const creatorData = new Map<string, AdData[]>();
    data.forEach(d => {
      if (!creatorData.has(d.creatorName)) {
        creatorData.set(d.creatorName, []);
      }
      creatorData.get(d.creatorName)!.push(d);
    });

    // Analyze each post with TREND and RECENT performance
    creatorData.forEach((posts, creator) => {
      const postGroups = new Map<string, AdData[]>();
      posts.forEach(p => {
        if (!postGroups.has(p.contentName)) {
          postGroups.set(p.contentName, []);
        }
        postGroups.get(p.contentName)!.push(p);
      });

      postGroups.forEach((postData, postName) => {
        postData.sort((a, b) => a.date.getTime() - b.date.getTime());
        if (postData.length < 2) return;

        const latestData = postData[postData.length - 1];
        const lifecycleRoi = latestData.cumulativeRoi;
        const latestRoi = latestData.roi;
        
        // Calculate recent ROI (last 3 days average)
        const recentDays = postData.slice(-3);
        const recentRoi = recentDays.reduce((sum, d) => sum + d.roi, 0) / recentDays.length;
        
        // Calculate trend: compare recent vs older performance
        const olderDays = postData.slice(0, -3);
        const olderRoi = olderDays.length > 0 
          ? olderDays.reduce((sum, d) => sum + d.roi, 0) / olderDays.length 
          : recentRoi;
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (recentRoi > olderRoi * 1.15) trend = 'up';
        else if (recentRoi < olderRoi * 0.85) trend = 'down';
        
        const totalCreatorSpend = posts.reduce((sum, p) => sum + p.spend, 0);
        const postSpend = latestData.cumulativeSpend;
        const spendPercent = totalCreatorSpend > 0 ? (postSpend / totalCreatorSpend) * 100 : 0;

        // Skip posts with no recent activity
        if (latestData.spend === 0) return;

        const postInfo = {
          name: postName,
          creator,
          days: postData.length,
          spend: postSpend,
          spendPercent,
          lifecycleRoi,
          recentRoi,
          latestRoi,
          trend
        };

        // WARNING conditions - Consider reducing spend:
        // 1. Recent ROI < 1 AND trend is DOWN AND high spend percentage
        // 2. OR lifecycle ROI < 0.8 (consistently bad) AND high spend
        if (
          (recentRoi < 1 && trend === 'down' && spendPercent >= 15) ||
          (lifecycleRoi < 0.8 && spendPercent >= 10)
        ) {
          alerts.push({
            type: 'warning',
            title: trend === 'down' ? '下降趋势' : '持续低效',
            description: trend === 'down' 
              ? `近期ROI ${recentRoi.toFixed(2)}x 且呈下降趋势`
              : `累计ROI仅 ${lifecycleRoi.toFixed(2)}x`,
            posts: [postInfo]
          });
        }

        // OPPORTUNITY conditions - Consider increasing spend:
        // 1. Recent ROI >= 1.2 AND trend is UP AND low spend percentage
        // 2. OR lifecycle ROI >= 1.5 AND still low spend (proven performer)
        else if (
          (recentRoi >= 1.2 && trend === 'up' && spendPercent < 20) ||
          (lifecycleRoi >= 1.5 && spendPercent < 15)
        ) {
          alerts.push({
            type: 'opportunity',
            title: trend === 'up' ? '上升趋势' : '稳定高效',
            description: trend === 'up'
              ? `近期ROI ${recentRoi.toFixed(2)}x 且呈上升趋势`
              : `累计ROI ${lifecycleRoi.toFixed(2)}x，可加大投入`,
            posts: [postInfo]
          });
        }
      });
    });

    // Sort: by severity/opportunity score
    alerts.sort((a, b) => {
      // Warnings first
      if (a.type === 'warning' && b.type === 'opportunity') return -1;
      if (a.type === 'opportunity' && b.type === 'warning') return 1;
      // Within same type, sort by spend percentage (higher = more important)
      return b.posts[0].spendPercent - a.posts[0].spendPercent;
    });

    return alerts; // No limit - pagination handled in UI
  }, [data]);

  // Content Insights (Theme/Category performance) - with date context
  const contentInsights = useMemo(() => {
    const insights: Array<{
      type: 'theme' | 'category';
      name: string;
      avgRoi: number;
      recentRoi: number;
      totalSpend: number;
      recentSpend: number;
      postCount: number;
      trend: 'up' | 'down' | 'stable';
      dateRange: string;
      recentDays: number;
    }> = [];

    // Get date range for "recent" (last 7 days)
    const recentCutoff = new Date(latestDateTimestamp);
    recentCutoff.setDate(recentCutoff.getDate() - 7);

    // Group by theme
    const themeData = new Map<string, AdData[]>();
    data.forEach(d => {
      if (!themeData.has(d.theme)) {
        themeData.set(d.theme, []);
      }
      themeData.get(d.theme)!.push(d);
    });

    themeData.forEach((posts, theme) => {
      if (posts.length < 3) return;
      
      const totalSpend = posts.reduce((sum, p) => sum + p.spend, 0);
      const totalEarning = posts.reduce((sum, p) => sum + p.earning, 0);
      const avgRoi = totalSpend > 0 ? totalEarning / totalSpend : 0;
      
      // Recent performance (last 7 days)
      const recentPosts = posts.filter(p => p.date.getTime() >= recentCutoff.getTime());
      const recentSpend = recentPosts.reduce((sum, p) => sum + p.spend, 0);
      const recentEarning = recentPosts.reduce((sum, p) => sum + p.earning, 0);
      const recentRoi = recentSpend > 0 ? recentEarning / recentSpend : 0;
      
      // Older performance (before last 7 days)
      const olderPosts = posts.filter(p => p.date.getTime() < recentCutoff.getTime());
      const olderSpend = olderPosts.reduce((sum, p) => sum + p.spend, 0);
      const olderEarning = olderPosts.reduce((sum, p) => sum + p.earning, 0);
      const olderRoi = olderSpend > 0 ? olderEarning / olderSpend : 0;
      
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (recentPosts.length > 0 && olderPosts.length > 0) {
        if (recentRoi > olderRoi * 1.15) trend = 'up';
        else if (recentRoi < olderRoi * 0.85) trend = 'down';
      }
      
      // Get date range
      const dates = posts.map(p => p.date.getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      const dateRange = `${minDate.toLocaleDateString(undefined, {month:'short', day:'numeric'})} - ${maxDate.toLocaleDateString(undefined, {month:'short', day:'numeric'})}`;
      
      insights.push({
        type: 'theme',
        name: theme,
        avgRoi,
        recentRoi,
        totalSpend,
        recentSpend,
        postCount: new Set(posts.map(p => p.contentName)).size,
        trend,
        dateRange,
        recentDays: recentPosts.length
      });
    });

    // Sort by recent ROI to highlight current best performers
    return insights.sort((a, b) => b.recentRoi - a.recentRoi).slice(0, 8);
  }, [data, latestDateTimestamp]);

  return (
    <div className="space-y-8">
      {/* 1. Global KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Total Ad Spend" value={kpis.totalSpend} type="currency" color="blue" />
        <KpiCard title="Total GMV" value={kpis.totalGmv} type="currency" color="green" />
        <KpiCard title="Total Earning" value={kpis.totalEarning} type="currency" color="emerald" />
        <KpiCard title="Overall ROI" value={kpis.overallRoi} type="percent" color="indigo" />
        <KpiCard 
            title="Total Active Posts" 
            value={kpis.uniquePosts} 
            color="amber" 
            onClick={handleKpiClick} 
        />
      </div>

      {/* Tier Rewards Tracker */}
      {tierData.length > 0 && (
        <TierRewardsTracker tierData={tierData} adData={data} />
      )}

      {/* Strategy Alerts Section - Compact */}
      {(strategyAlerts.length > 0 || contentInsights.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertIcon className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800">Strategy Insights</h3>
            </div>
            <div className="flex bg-slate-100 rounded p-0.5 text-xs">
              <button
                onClick={() => setAlertViewMode('posts')}
                className={`px-2 py-1 rounded transition-all ${alertViewMode === 'posts' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
              >
                Posts
              </button>
              <button
                onClick={() => setAlertViewMode('content')}
                className={`px-2 py-1 rounded transition-all ${alertViewMode === 'content' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
              >
                Content
              </button>
            </div>
          </div>
          
          {alertViewMode === 'posts' ? (
            <div>
              {strategyAlerts.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">
                  当前筛选条件下无策略建议
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {strategyAlerts
                      .slice(alertPage * ALERTS_PER_PAGE, (alertPage + 1) * ALERTS_PER_PAGE)
                      .map((alert, idx) => {
                        const post = alert.posts[0];
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setDrillDimension('all');
                              setSelectedPosts([post.name]);
                              scrollToDeepDive();
                            }}
                            className={`p-3 rounded border cursor-pointer hover:shadow-md transition-all ${
                              alert.type === 'warning' ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-green-50 border-green-200 hover:bg-green-100'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1">
                                {alert.type === 'warning' ? (
                                  <AlertTriangle className="w-3 h-3 text-red-600" />
                                ) : (
                                  <TrendingUpIcon className="w-3 h-3 text-green-600" />
                                )}
                                <span className={`text-[10px] font-bold ${alert.type === 'warning' ? 'text-red-700' : 'text-green-700'}`}>
                                  {alert.title}
                                </span>
                                <span className={`text-[10px] ${
                                  post.trend === 'up' ? 'text-green-500' : post.trend === 'down' ? 'text-red-500' : 'text-slate-400'
                                }`}>
                                  {post.trend === 'up' ? '↑' : post.trend === 'down' ? '↓' : '→'}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs font-medium text-slate-800 truncate" title={post.name}>{post.name}</div>
                            <div className="grid grid-cols-3 gap-1 mt-2 text-[10px]">
                              <div>
                                <div className="text-slate-400">最新</div>
                                <div className={`font-bold ${post.latestRoi >= 1 ? 'text-green-600' : 'text-red-500'}`}>
                                  {post.latestRoi.toFixed(2)}x
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-400">近3天</div>
                                <div className={`font-bold ${post.recentRoi >= 1 ? 'text-green-600' : 'text-red-500'}`}>
                                  {post.recentRoi.toFixed(2)}x
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-400">累计</div>
                                <div className={`font-bold ${post.lifecycleRoi >= 1 ? 'text-green-600' : 'text-red-500'}`}>
                                  {post.lifecycleRoi.toFixed(2)}x
                                </div>
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                              {post.creator} • 占博主支出 {post.spendPercent.toFixed(0)}%
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  {/* Pagination */}
                  {strategyAlerts.length > ALERTS_PER_PAGE && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <button
                        onClick={() => setAlertPage(p => Math.max(0, p - 1))}
                        disabled={alertPage === 0}
                        className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                      >
                        ← 上一页
                      </button>
                      <span className="text-xs text-slate-500">
                        {alertPage + 1} / {Math.ceil(strategyAlerts.length / ALERTS_PER_PAGE)} 页
                        （共 {strategyAlerts.length} 条）
                      </span>
                      <button
                        onClick={() => setAlertPage(p => Math.min(Math.ceil(strategyAlerts.length / ALERTS_PER_PAGE) - 1, p + 1))}
                        disabled={alertPage >= Math.ceil(strategyAlerts.length / ALERTS_PER_PAGE) - 1}
                        className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                      >
                        下一页 →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div>
              <div className="text-[10px] text-slate-500 mb-2">
                基于当前筛选数据 • 近7天为"近期" • 按近期ROI排序
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {contentInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      insight.recentRoi >= 1.2 ? 'bg-green-50 border-green-200' : 
                      insight.recentRoi >= 1 ? 'bg-emerald-50 border-emerald-200' : 
                      insight.recentRoi >= 0.8 ? 'bg-amber-50 border-amber-200' :
                      'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-800">{insight.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        insight.trend === 'up' ? 'bg-green-100 text-green-700' : 
                        insight.trend === 'down' ? 'bg-red-100 text-red-700' : 
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {insight.trend === 'up' ? '↑ 上升' : insight.trend === 'down' ? '↓ 下降' : '→ 稳定'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <div className="text-[10px] text-slate-500">近7天 ROI</div>
                        <div className={`text-base font-bold ${insight.recentRoi >= 1 ? 'text-green-600' : 'text-red-500'}`}>
                          {insight.recentRoi.toFixed(2)}x
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">整体 ROI</div>
                        <div className={`text-base font-bold ${insight.avgRoi >= 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {insight.avgRoi.toFixed(2)}x
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-[10px] text-slate-500 space-y-0.5">
                      <div className="flex justify-between">
                        <span>帖子数:</span>
                        <span className="font-medium text-slate-700">{insight.postCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>近7天支出:</span>
                        <span className="font-medium text-slate-700">${insight.recentSpend.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>总支出:</span>
                        <span className="font-medium text-slate-700">${insight.totalSpend.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Latest Daily Snapshot & Budget Matrix */}
      {latestDateTimestamp > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* 2a. Daily Stats & List */}
            <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-indigo-600" />
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Latest Daily Snapshot</h3>
                                <p className="text-xs text-slate-500 font-medium">{latestDateObj.toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
                            </div>
                        </div>
                        <div className="hidden sm:flex gap-3 text-sm">
                            <div className="px-2 py-1 bg-white rounded border border-slate-200">
                                <span className="text-slate-400 text-[10px] uppercase block">Spend</span>
                                <span className="font-bold text-slate-800 text-xs">${latestDayStats.spend.toLocaleString()}</span>
                            </div>
                            <div className="px-2 py-1 bg-white rounded border border-slate-200">
                                <span className="text-slate-400 text-[10px] uppercase block">ROI</span>
                                <span className={`font-bold text-xs ${latestDayStats.roi >= 1 ? 'text-green-600' : 'text-red-600'}`}>{latestDayStats.roi.toFixed(2)}x</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Post</th>
                                <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Duration</th>
                                <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-500 uppercase">Spend</th>
                                <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-500 uppercase">Earn</th>
                                <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-500 uppercase">Daily ROI</th>
                                <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-500 uppercase border-l border-slate-100">Life ROI</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {strategyMatrixData.data.map((post) => {
                                const startTime = postStartDates.get(post.contentName) || latestDateTimestamp;
                                const durationDays = Math.floor((latestDateTimestamp - startTime) / (1000 * 60 * 60 * 24)) + 1;
                                return (
                                    <tr 
                                        key={post.id} 
                                        className="hover:bg-indigo-50/50 transition-colors cursor-pointer"
                                        onClick={() => handleSnapshotClick(post.contentName)}
                                    >
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <div className="text-xs font-medium text-slate-900 truncate max-w-[150px]" title={post.contentName}>{post.contentName}</div>
                                            <div className="text-[10px] text-slate-500">{post.creatorName}</div>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-500">
                                            {durationDays} days
                                        </td>
                                        <td className="px-4 py-2 text-right text-xs font-mono text-slate-700">${post.spend.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right text-xs font-mono text-slate-700">${post.earning.toLocaleString()}</td>
                                        <td className={`px-4 py-2 text-right text-xs font-bold font-mono ${post.roi >= 1 ? 'text-green-600' : 'text-red-500'}`}>{post.roi.toFixed(2)}x</td>
                                        <td className={`px-4 py-2 text-right text-xs font-mono font-medium border-l border-slate-100 ${post.cumulativeRoi >= 1 ? 'text-emerald-600' : 'text-rose-500'}`}>{post.cumulativeRoi.toFixed(2)}x</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 2b. Budget Strategy Matrix */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col h-[500px]">
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Target className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-lg font-bold text-slate-800">Budget Strategy Matrix</h3>
                    </div>
                    <p className="text-xs text-slate-500">
                        Visualizing active posts by "Scale vs. Test" logic.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-4">
                     <div 
                        onClick={() => {
                            setSelectedStrategyType(selectedStrategyType === 'cow' ? null : 'cow');
                            handleStrategyCardClick('cow');
                        }}
                        className={`border p-2 rounded flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-md transition-all ${
                            selectedStrategyType === 'cow'
                                ? 'bg-emerald-100 border-emerald-300 shadow-md'
                                : 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100/50'
                        }`}
                     >
                        <span className="text-emerald-700 font-bold text-lg">{strategyMatrixData.counts.cow}</span>
                        <span className="text-[10px] text-emerald-600 uppercase font-bold">Cash Cows</span>
                     </div>
                     <div 
                        onClick={() => {
                            setSelectedStrategyType(selectedStrategyType === 'scale' ? null : 'scale');
                            handleStrategyCardClick('scale');
                        }}
                        className={`border p-2 rounded flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-md transition-all ${
                            selectedStrategyType === 'scale'
                                ? 'bg-blue-100 border-blue-300 shadow-md'
                                : 'bg-blue-50 border-blue-100 hover:bg-blue-100/50'
                        }`}
                     >
                        <span className="text-blue-700 font-bold text-lg">{strategyMatrixData.counts.scale}</span>
                        <span className="text-[10px] text-blue-600 uppercase font-bold">Scale Up</span>
                     </div>
                     <div 
                        onClick={() => {
                            setSelectedStrategyType(selectedStrategyType === 'alert' ? null : 'alert');
                            handleStrategyCardClick('alert');
                        }}
                        className={`border p-2 rounded flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-md transition-all ${
                            selectedStrategyType === 'alert'
                                ? 'bg-red-100 border-red-300 shadow-md'
                                : 'bg-red-50 border-red-100 hover:bg-red-100/50'
                        }`}
                     >
                        <span className="text-red-700 font-bold text-lg">{strategyMatrixData.counts.alert}</span>
                        <span className="text-[10px] text-red-600 uppercase font-bold">Reduce</span>
                     </div>
                     <div 
                        onClick={() => {
                            setSelectedStrategyType(selectedStrategyType === 'test' ? null : 'test');
                            handleStrategyCardClick('test');
                        }}
                        className={`border p-2 rounded flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-md transition-all ${
                            selectedStrategyType === 'test'
                                ? 'bg-amber-100 border-amber-300 shadow-md'
                                : 'bg-amber-50 border-amber-100 hover:bg-amber-100/50'
                        }`}
                     >
                        <span className="text-amber-700 font-bold text-lg">{strategyMatrixData.counts.test}</span>
                        <span className="text-[10px] text-amber-600 uppercase font-bold">Testing</span>
                     </div>
                </div>

                <div className="flex-1 min-h-0 relative border border-slate-100 rounded-lg bg-slate-50/30">
                     <ResponsiveContainer width="100%" height="100%">
                         <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                             <CartesianGrid strokeDasharray="3 3" />
                             <XAxis type="number" dataKey="roi" name="ROI" stroke="#94a3b8" fontSize={10} label={{ value: 'Daily ROI', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                             <YAxis type="number" dataKey="spend" name="Spend" stroke="#94a3b8" fontSize={10} label={{ value: 'Daily Spend', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                             <Tooltip content={<CustomTooltipMatrix />} />
                             <ReferenceLine x={1} stroke="#94a3b8" strokeDasharray="3 3" />
                             <ReferenceLine y={strategyMatrixData.threshold} stroke="#94a3b8" strokeDasharray="3 3" label={{value: 'Avg Spend', fontSize: 9, position: 'insideTopLeft', fill: '#94a3b8'}}/>
                             
                             <Scatter data={strategyMatrixData.data} onClick={handleMatrixDotClick} className="cursor-pointer">
                                {strategyMatrixData.data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.strategyColor} />
                                ))}
                             </Scatter>
                         </ScatterChart>
                     </ResponsiveContainer>
                     <div className="absolute top-2 right-2 flex flex-col gap-1 pointer-events-none opacity-60">
                         <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> High Spend, ROI &gt; 1</span>
                         <span className="text-[9px] font-bold text-red-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> High Spend, ROI &lt; 1</span>
                     </div>
                </div>
            </div>

          </div>
      )}

      {/* 3. Breakdown Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[520px]">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-2">
                {breakdownView === 'trend' ? <TrendingUp className="w-5 h-5 text-indigo-600" /> : breakdownView === 'distribution' ? <PieIcon className="w-5 h-5 text-indigo-600" /> : <Activity className="w-5 h-5 text-indigo-600" />}
                <h3 className="text-lg font-bold text-slate-800">
                    {breakdownView === 'trend' ? 'Performance Trend by Segment' : breakdownView === 'distribution' ? 'Total Composition' : 'Multi-Metric Analysis'}
                </h3>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
                <div className="flex bg-slate-100 rounded-lg p-1 mr-1">
                    <button onClick={() => setBreakdownView('trend')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${breakdownView === 'trend' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <TrendingUp className="w-3 h-3" /> Trend
                    </button>
                    <button onClick={() => setBreakdownView('distribution')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${breakdownView === 'distribution' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <PieIcon className="w-3 h-3" /> Dist.
                    </button>
                    <button onClick={() => setBreakdownView('multi-metric')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${breakdownView === 'multi-metric' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Activity className="w-3 h-3" /> Multi
                    </button>
                </div>

                <select value={compDimension} onChange={(e) => setCompDimension(e.target.value as any)} className="bg-white border border-slate-300 text-slate-700 py-1.5 px-2 rounded-md text-xs shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="category">Category</option>
                    <option value="creatorName">Creator</option>
                    <option value="theme">Theme</option>
                </select>

                <select value={topN} onChange={(e) => setTopN(Number(e.target.value))} className="bg-white border border-slate-300 text-slate-700 py-1.5 px-2 rounded-md text-xs shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                    <option value={5}>Top 5</option>
                    <option value={10}>Top 10</option>
                    <option value={20}>Top 20</option>
                    <option value={-1}>All</option>
                </select>

                <div className="relative max-w-[140px]">
                    <select value={focusEntity} onChange={(e) => setFocusEntity(e.target.value)} className={`w-full appearance-none border py-1.5 px-2 pr-6 rounded-md text-xs shadow-sm focus:ring-indigo-500 focus:border-indigo-500 ${focusEntity ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium' : 'bg-white border-slate-300 text-slate-700'}`}>
                        <option value="">Select Entity...</option>
                        {availableEntitiesAlpha.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    {focusEntity ? (
                        <button onClick={() => setFocusEntity('')} className="absolute right-6 top-1.5 text-indigo-400 hover:text-indigo-600"><FilterX className="w-3 h-3" /></button>
                    ) : (
                        <ChevronDown className="absolute right-2 top-2 w-3 h-3 text-slate-400 pointer-events-none" />
                    )}
                </div>

                {breakdownView !== 'multi-metric' && (
                    <select value={compMetric} onChange={(e) => setCompMetric(e.target.value as any)} className="bg-white border border-slate-300 text-slate-700 py-1.5 px-2 rounded-md text-xs shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="roi">ROI</option>
                        <option value="spend">Spend</option>
                        <option value="earning">Earning</option>
                    </select>
                )}
            </div>
        </div>
        
        <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
                {breakdownView === 'multi-metric' ? (
                    <ComposedChart data={multiMetricData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
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
                        <Tooltip content={<CustomTooltipTrend />} />
                        <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                        <ReferenceLine yAxisId="right" y={1} stroke="#ef4444" strokeDasharray="3 3" />
                        <Bar yAxisId="left" dataKey="spend" fill="#6366f1" name="Spend" opacity={0.7} />
                        <Bar yAxisId="left" dataKey="earning" fill="#10b981" name="Earning" opacity={0.7} />
                        <Line yAxisId="right" type="monotone" dataKey="roi" stroke="#ec4899" strokeWidth={2} name="ROI" dot={{ r: 3 }} />
                    </ComposedChart>
                ) : breakdownView === 'trend' ? (
                    compMetric === 'roi' ? (
                        <LineChart data={trendData.data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="timestamp" type="number" domain={['auto', 'auto']} tickFormatter={(u) => new Date(u).toLocaleDateString(undefined, {month:'short', day:'numeric'})} fontSize={12} stroke="#94a3b8" />
                            <YAxis fontSize={12} stroke="#94a3b8" />
                            <Tooltip content={<CustomTooltipTrend />} />
                            <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                            <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="3 3" />
                            {trendData.keys.map((key, index) => (
                                <Line 
                                    key={key}
                                    type="monotone" 
                                    dataKey={key} 
                                    stroke={getColorForEntity(key, allEntitiesSorted)} 
                                    strokeWidth={focusEntity === key ? 3 : 2}
                                    dot={focusEntity === key}
                                    activeDot={{ r: 6 }}
                                    strokeOpacity={focusEntity && focusEntity !== key ? 0.3 : 1}
                                />
                            ))}
                        </LineChart>
                    ) : (
                        <BarChart data={trendData.data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="timestamp" type="number" domain={['auto', 'auto']} tickFormatter={(u) => new Date(u).toLocaleDateString(undefined, {month:'short', day:'numeric'})} fontSize={12} stroke="#94a3b8" />
                            <YAxis fontSize={12} stroke="#94a3b8" />
                            <Tooltip content={<CustomTooltipTrend />} />
                            <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                            {trendData.keys.map((key, index) => (
                                <Bar 
                                    key={key}
                                    dataKey={key} 
                                    stackId={focusEntity ? undefined : "a"}
                                    fill={getColorForEntity(key, allEntitiesSorted)} 
                                    fillOpacity={focusEntity && focusEntity !== key ? 0.3 : 1}
                                />
                            ))}
                        </BarChart>
                    )
                ) : (
                    <PieChart>
                        <Pie data={distributionData} cx="50%" cy="50%" labelLine={false} label={renderCustomizedLabel} outerRadius={130} fill="#8884d8" dataKey="value" onClick={handlePieClick} className="cursor-pointer focus:outline-none">
                            {distributionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getColorForEntity(entry.name, allEntitiesSorted)} className="hover:opacity-80 transition-opacity" />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltipTrend />} />
                        <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '12px'}} />
                    </PieChart>
                )}
            </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Deep Dive Analysis Section */}
      <div id="deep-dive-section" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-20">
        {/* Header & Filter */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-bold text-slate-800">Deep Dive: Segment Analysis</h3>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                    <div className="flex gap-2 items-center bg-white border border-slate-300 rounded-lg p-1 shadow-sm">
                        <select value={drillDimension} onChange={(e) => setDrillDimension(e.target.value as any)} className="bg-transparent border-none text-slate-700 py-1 px-2 text-sm focus:ring-0 font-medium">
                            <option value="category">Category</option>
                            <option value="platform">Platform</option>
                            <option value="theme">Theme</option>
                            <option value="all">View All Posts</option>
                        </select>
                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                        <div className={`relative ${drillDimension === 'all' ? 'opacity-50 pointer-events-none' : ''}`}>
                            <select value={drillValue} onChange={(e) => setDrillValue(e.target.value)} className="w-40 appearance-none bg-transparent border-none text-slate-700 py-1 px-2 pr-6 text-sm focus:ring-0">
                                {drillDimension === 'all' ? <option>All Posts Selected</option> : drillOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <ChevronDown className="absolute right-1 top-1.5 w-3 h-3 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* 4a. Visualization Charts (Charts moved ABOVE table as requested) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 border-b border-slate-200">
            {/* Left: Time vs ROI Scatter */}
            <div className="p-6 border-r border-slate-100 h-[500px] flex flex-col">
                <div className="flex justify-between items-start mb-4 flex-shrink-0">
                    <div>
                        <h4 className="font-semibold text-slate-700 mb-2">Daily Performance Visualization</h4>
                        <div className="flex flex-wrap gap-2 items-center">
                            <select
                                value={deepDiveRoiFilter}
                                onChange={(e) => setDeepDiveRoiFilter(e.target.value as any)}
                                className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                            >
                                <option value="all">All ROI</option>
                                <option value="high">ROI ≥ 1x</option>
                                <option value="low">ROI &lt; 1x</option>
                            </select>
                            <button
                                onClick={() => setDeepDiveUseLogScale(!deepDiveUseLogScale)}
                                className={`px-2 py-1 text-xs rounded border transition-colors ${
                                    deepDiveUseLogScale 
                                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700' 
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {deepDiveUseLogScale ? 'Log Scale' : 'Linear'}
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-col items-end text-[10px] text-slate-400">
                        <span>X = Date | Y = ROI | Size = Spend</span>
                        <span>Click dot to toggle selection</span>
                    </div>
                </div>
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis type="number" dataKey="timestamp" name="Date" domain={['auto', 'auto']} tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'})} stroke="#94a3b8" fontSize={10} />
                            <YAxis 
                                type="number" 
                                dataKey="roi" 
                                name="ROI" 
                                domain={scatterYDomain as any}
                                scale={deepDiveUseLogScale ? 'log' : 'linear'}
                                allowDataOverflow={true}
                                tick={{fontSize: 10}} 
                                stroke="#94a3b8" 
                            />
                            <ZAxis type="number" dataKey="spend" range={[50, 600]} name="Spend" />
                            <Tooltip content={<CustomTooltipScatter />} cursor={{ strokeDasharray: '3 3' }} />
                            <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="3 3" />
                            <Scatter name="Daily Posts" data={segmentData} onClick={(data) => togglePostSelection(data.contentName)} className="cursor-pointer">
                                {segmentData.map((entry, index) => {
                                    const isSelected = selectedPosts.includes(entry.contentName);
                                    const roiColor = entry.roi >= 1 ? '#10b981' : entry.roi >= 0.5 ? '#f59e0b' : '#ef4444';
                                    return (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={isSelected ? getColorForEntity(entry.contentName, postNamesInSegment) : roiColor} 
                                            fillOpacity={isSelected ? 0.9 : 0.6}
                                            stroke={isSelected ? 'white' : 'none'}
                                            strokeWidth={isSelected ? 2 : 0}
                                        />
                                    );
                                })}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Right: Multi-Post Comparison */}
            <div className="p-6 bg-slate-50/30 flex flex-col h-[500px] overflow-hidden">
                <div className="mb-4 flex justify-between items-center">
                    <h4 className="font-semibold text-slate-700">Trend Comparison ({selectedPosts.length} selected)</h4>
                    <span className="text-xs text-slate-400">Click charts or table rows to select</span>
                </div>

                <div className="flex-1 flex flex-col gap-4 min-h-0">
                    {/* Top Chart: ROI Line */}
                    <div className="flex-1 bg-white rounded-lg border border-slate-200 p-2 shadow-sm relative min-h-0">
                        <h5 className="text-[10px] font-bold text-slate-500 absolute top-2 left-2 z-10">ROI TRENDS</h5>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={multiPostData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="timestamp" type="number" domain={['auto', 'auto']} tickFormatter={(u) => new Date(u).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})} fontSize={10} stroke="#94a3b8" />
                                <YAxis fontSize={10} stroke="#94a3b8" />
                                <Tooltip content={<CustomTooltipMulti />} />
                                <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="3 3" />
                                {selectedPosts.map((post) => (
                                    <Line 
                                        key={post}
                                        type="monotone" 
                                        dataKey={`${post}_roi`} 
                                        stroke={getColorForEntity(post, postNamesInSegment)} 
                                        strokeWidth={1.5}
                                        dot={{r:1.5}}
                                        connectNulls
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Bottom Chart: Spend Bar */}
                    <div className="flex-1 bg-white rounded-lg border border-slate-200 p-2 shadow-sm relative min-h-0">
                        <h5 className="text-[10px] font-bold text-slate-500 absolute top-2 left-2 z-10">AD SPEND</h5>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={multiPostData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="timestamp" type="number" domain={['auto', 'auto']} tickFormatter={(u) => new Date(u).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})} fontSize={10} stroke="#94a3b8" />
                                <YAxis fontSize={10} stroke="#94a3b8" tickFormatter={(value) => `$${value}`} />
                                <Tooltip content={<CustomTooltipMulti />} />
                                {selectedPosts.map((post) => (
                                    <Bar 
                                        key={post}
                                        dataKey={`${post}_spend`} 
                                        fill={getColorForEntity(post, postNamesInSegment)} 
                                        barSize={Math.max(2, 40 / selectedPosts.length)}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>

        {/* 4b. Top Posts Leaderboard Table (Moved BELOW charts) */}
        <div className="overflow-x-auto bg-slate-50/20">
            <div className="min-w-full inline-block align-middle">
                <div className="overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">
                                    <div className="flex items-center justify-center">
                                         <button onClick={handleSelectAll} className="hover:text-indigo-600">
                                            {selectedPosts.length === postNamesInSegment.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                         </button>
                                    </div>
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('contentName')}>
                                    <div className="flex items-center gap-1">Post Name <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('isActive')}>
                                    <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('durationDays')}>
                                    <div className="flex items-center gap-1">Duration <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('spend')}>
                                    <div className="flex items-center justify-end gap-1">Ad Spend <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('earning')}>
                                    <div className="flex items-center justify-end gap-1">Earnings <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('roi')}>
                                    <div className="flex items-center justify-end gap-1">ROI <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('spendPercent')}>
                                    <div className="flex items-center justify-end gap-1">博主占比 <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {postsInSegmentAggregated.slice(0, 50).map((post, idx) => {
                                const isSelected = selectedPosts.includes(post.contentName);
                                return (
                                    <tr 
                                        key={post.contentName} 
                                        onClick={() => togglePostSelection(post.contentName)}
                                        className={`hover:bg-indigo-50/50 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}
                                    >
                                        <td className="px-6 py-3 whitespace-nowrap text-center">
                                            <div className={`w-4 h-4 rounded border mx-auto flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: getColorForEntity(post.contentName, postNamesInSegment) }}></span>
                                                <div>
                                                    <div className="text-sm font-medium text-slate-900 truncate max-w-[200px] sm:max-w-xs" title={post.contentName}>{post.contentName}</div>
                                                    <div className="text-xs text-slate-500">{post.creator} • {post.platform}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap">
                                            {post.status === 'run' ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    <PlayCircle className="w-3 h-3 mr-1" /> Run
                                                </span>
                                            ) : post.status === 'paused' ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                                    <PauseCircle className="w-3 h-3 mr-1" /> Paused
                                                </span>
                                            ) : post.status === 'stopped' ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                                    <StopCircle className="w-3 h-3 mr-1" /> Stopped
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                    {post.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-600">
                                            <div className="flex items-center gap-1" title={`${new Date(post.minTime).toLocaleDateString()} - ${new Date(post.maxTime).toLocaleDateString()}`}>
                                                <Clock className="w-3 h-3 text-slate-400" />
                                                <span>{formatDuration(post.maxTime - post.minTime)}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {new Date(post.minTime).toLocaleDateString(undefined, {month:'short', day:'numeric'})} - {new Date(post.maxTime).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-slate-700 font-mono">
                                            ${post.spend.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-slate-700 font-mono">
                                            ${post.earning.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-bold font-mono">
                                            <span className={post.roi >= 1 ? 'text-green-600' : 'text-red-500'}>
                                                {post.roi.toFixed(2)}x
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-mono">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${post.spendPercent >= 30 ? 'bg-red-500' : post.spendPercent >= 15 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                                        style={{ width: `${Math.min(100, post.spendPercent)}%` }}
                                                    />
                                                </div>
                                                <span className={`${post.spendPercent >= 30 ? 'text-red-600 font-bold' : post.spendPercent >= 15 ? 'text-amber-600' : 'text-slate-600'}`}>
                                                    {post.spendPercent.toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {postsInSegmentAggregated.length > 50 && (
                        <div className="px-6 py-3 text-xs text-center text-slate-400 border-t border-slate-100">
                            Showing top 50 of {postsInSegmentAggregated.length} posts
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};