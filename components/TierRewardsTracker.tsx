import React, { useMemo, useState } from 'react';
import { AdData, CreatorTierData, TierProgress, TierLevel, RushAnalysis, PostEfficiency } from '../types';
import { Target, AlertTriangle, CheckCircle, XCircle, Calendar, ChevronDown, User, Clock, Zap } from 'lucide-react';

interface TierRewardsTrackerProps {
  tierData: CreatorTierData[];
  adData: AdData[];
}

export const TierRewardsTracker: React.FC<TierRewardsTrackerProps> = ({ tierData, adData }) => {
  const [selectedCreator, setSelectedCreator] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Get all available months from tier data, sorted descending (newest first)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    tierData.forEach(t => {
      if (t.dataMonth) months.add(t.dataMonth);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [tierData]);

  // Get current month in YYYY-MM format
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Auto-select the latest month if no month selected, or reset if selected month is no longer available
  React.useEffect(() => {
    if (availableMonths.length > 0) {
      if (!selectedMonth || !availableMonths.includes(selectedMonth)) {
        setSelectedMonth(availableMonths[0]);
      }
    }
  }, [availableMonths, selectedMonth]);

  // Filter tier data by selected month
  const filteredTierData = useMemo(() => {
    if (!selectedMonth) return tierData;
    return tierData.filter(t => t.dataMonth === selectedMonth);
  }, [tierData, selectedMonth]);

  // Check if selected month is current month (for showing days remaining)
  const isCurrentMonth = selectedMonth === currentMonth;

  // Calculate days remaining (only meaningful for current month)
  const daysRemaining = useMemo(() => {
    if (!isCurrentMonth) {
      return 0; // Historical month - no days remaining
    }
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const diffTime = endOfMonth.getTime() - now.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }, [isCurrentMonth]);

  // Format month for display (e.g., "2026-01" -> "January 2026")
  const formatMonthDisplay = (monthStr: string): string => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Per-post metrics using last 3 days (only for current month)
  const postEfficiencyByCreator = useMemo(() => {
    const result = new Map<string, PostEfficiency[]>();
    
    // Only calculate for current month since rush analysis is forward-looking
    if (!isCurrentMonth) return result;
    
    const allDates = adData.map(d => d.date.getTime());
    if (allDates.length === 0) return result;
    const latestDate = Math.max(...allDates);
    const threeDaysAgo = latestDate - (3 * 24 * 60 * 60 * 1000);
    
    const creatorPostData = new Map<string, Map<string, { 
      spend: number; gmv: number; earning: number; dates: Set<string>;
    }>>();
    
    adData.forEach(d => {
      if (d.date.getTime() < threeDaysAgo) return;
      
      if (!creatorPostData.has(d.creatorName)) {
        creatorPostData.set(d.creatorName, new Map());
      }
      const postMap = creatorPostData.get(d.creatorName)!;
      
      if (!postMap.has(d.contentName)) {
        postMap.set(d.contentName, { spend: 0, gmv: 0, earning: 0, dates: new Set() });
      }
      
      const post = postMap.get(d.contentName)!;
      post.spend += d.spend;
      post.gmv += d.gmv;
      post.earning += d.earning;
      post.dates.add(d.date.toISOString().split('T')[0]);
    });
    
    creatorPostData.forEach((postMap, creatorName) => {
      const posts: PostEfficiency[] = [];
      
      postMap.forEach((data, contentName) => {
        const daysWithData = data.dates.size;
        posts.push({
          contentName,
          totalSpend: data.spend,
          totalGmv: data.gmv,
          totalEarning: data.earning,
          roas: data.spend > 0 ? data.gmv / data.spend : 0,
          roi: data.spend > 0 ? data.earning / data.spend : 0,
          daysWithData,
          isNewPost: daysWithData < 3,
          avgDailyGmv: daysWithData > 0 ? data.gmv / daysWithData : 0,
        });
      });
      
      // Sort by ROAS descending (best performers first)
      posts.sort((a, b) => b.roas - a.roas);
      result.set(creatorName, posts);
    });
    
    return result;
  }, [adData, isCurrentMonth]);

  const tierProgressList = useMemo((): TierProgress[] => {
    return filteredTierData.map(creator => {
      const { creatorName, currentShippedRevenue, tiers } = creator;
      const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);
      
      let currentTier: TierLevel | null = null;
      let nextTier: TierLevel | null = null;
      
      for (let i = sortedTiers.length - 1; i >= 0; i--) {
        if (currentShippedRevenue >= sortedTiers[i].threshold) {
          currentTier = sortedTiers[i];
          nextTier = sortedTiers[i + 1] || null;
          break;
        }
      }
      
      if (!currentTier && sortedTiers.length > 0) {
        nextTier = sortedTiers[0];
      }
      
      const currentBonus = currentTier?.bonus || 0;
      const gapToNextTier = nextTier ? nextTier.threshold - currentShippedRevenue : 0;
      const dailyGmvNeeded = nextTier && daysRemaining > 0 ? gapToNextTier / daysRemaining : 0;
      
      // Calculate rush analysis only for current month (forward-looking)
      let rushAnalysis: RushAnalysis | null = null;
      
      if (nextTier && gapToNextTier > 0 && isCurrentMonth) {
        const posts = postEfficiencyByCreator.get(creatorName) || [];
        
        if (posts.length > 0) {
          const totalSpend = posts.reduce((sum, p) => sum + p.totalSpend, 0);
          const totalGmv = posts.reduce((sum, p) => sum + p.totalGmv, 0);
          const totalEarning = posts.reduce((sum, p) => sum + p.totalEarning, 0);
          
          const avgRoas = totalSpend > 0 ? totalGmv / totalSpend : 0;
          const avgRoi = totalSpend > 0 ? totalEarning / totalSpend : 0;
          
          if (avgRoas > 0) {
            const estimatedExtraSpend = gapToNextTier / avgRoas;
            const extraBonus = nextTier.bonus - currentBonus;
            const extraCost = estimatedExtraSpend * (1 - avgRoi);
            const netGain = extraBonus - extraCost;
            
            let recommendation: 'rush' | 'consider' | 'skip';
            if (netGain > 0) recommendation = 'rush';
            else if (netGain > -extraBonus * 0.5) recommendation = 'consider';
            else recommendation = 'skip';
            
            rushAnalysis = { estimatedExtraSpend, netGain, recommendation, avgRoas, avgRoi, posts };
          }
        }
      }
      
      return {
        creatorName, currentRevenue: currentShippedRevenue, currentTier, currentBonus,
        nextTier, gapToNextTier, daysRemaining, dailyGmvNeeded, rushAnalysis,
      };
    });
  }, [filteredTierData, daysRemaining, postEfficiencyByCreator, isCurrentMonth]);

  React.useEffect(() => {
    if (tierProgressList.length > 0 && !selectedCreator) {
      setSelectedCreator(tierProgressList[0].creatorName);
    }
  }, [tierProgressList, selectedCreator]);

  if (tierProgressList.length === 0) {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Creator Rewards Tier Tracker</h3>
              <p className="text-xs text-slate-500">
                <Calendar className="w-3 h-3 inline mr-1" />
                {selectedMonth ? formatMonthDisplay(selectedMonth) : 'No month selected'}
              </p>
            </div>
          </div>
          {/* Month selector */}
          {availableMonths.length > 0 && (
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setSelectedCreator(''); // Reset creator when month changes
                }}
                className="appearance-none bg-white border border-slate-300 rounded-lg py-2 pl-3 pr-8 text-sm font-medium text-slate-700 shadow-sm"
              >
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {formatMonthDisplay(month)}
                    {month === currentMonth ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg border border-amber-100 p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h4 className="font-semibold text-slate-700 mb-2">No Tier Data for {formatMonthDisplay(selectedMonth) || 'This Month'}</h4>
          <p className="text-sm text-slate-500">
            Bonus Cal data for {formatMonthDisplay(selectedMonth) || 'the selected month'} is not available.<br />
            {availableMonths.length > 1 ? 'Try selecting a different month.' : 'Please update the Google Sheet with this month\'s data.'}
          </p>
        </div>
      </div>
    );
  }

  const currentProgress = tierProgressList.find(p => p.creatorName === selectedCreator) || tierProgressList[0];
  const currentTierData = filteredTierData.find(t => t.creatorName === selectedCreator) || filteredTierData[0];

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Creator Rewards Tier Tracker</h3>
            <p className="text-xs text-slate-500">
              <Calendar className="w-3 h-3 inline mr-1" />
              {isCurrentMonth ? `${daysRemaining} days remaining this month` : formatMonthDisplay(selectedMonth)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Month selector */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedCreator(''); // Reset creator when month changes
              }}
              className="appearance-none bg-white border border-slate-300 rounded-lg py-2 pl-3 pr-8 text-sm font-medium text-slate-700 shadow-sm"
            >
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {formatMonthDisplay(month)}
                  {month === currentMonth ? ' (Current)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Creator selector */}
          <div className="relative">
            <select
              value={selectedCreator}
              onChange={(e) => setSelectedCreator(e.target.value)}
              className="appearance-none bg-white border border-slate-300 rounded-lg py-2 pl-3 pr-8 text-sm font-medium text-slate-700 shadow-sm"
            >
              {tierProgressList.map((p) => (
                <option key={p.creatorName} value={p.creatorName}>{p.creatorName}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      <CreatorTierCard progress={currentProgress} tiers={currentTierData.tiers} daysRemaining={daysRemaining} isCurrentMonth={isCurrentMonth} />
    </div>
  );
};

const CreatorTierCard: React.FC<{ progress: TierProgress; tiers: TierLevel[]; daysRemaining: number; isCurrentMonth: boolean }> = ({ progress, tiers, daysRemaining, isCurrentMonth }) => {
  const { currentRevenue, currentTier, currentBonus, nextTier, gapToNextTier, dailyGmvNeeded, rushAnalysis } = progress;

  const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);
  const maxThreshold = sortedTiers.length > 0 ? sortedTiers[sortedTiers.length - 1].threshold : currentRevenue;
  const progressPercent = maxThreshold > 0 ? (currentRevenue / maxThreshold) * 100 : 0;

  return (
    <div className="bg-white rounded-lg border border-amber-100 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-semibold text-slate-800">{progress.creatorName}</h4>
          <p className="text-xs text-slate-500">{currentTier ? `${currentTier.name} Achieved` : 'No tier reached yet'}</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-amber-600">${currentRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-slate-500">Current Shipped Revenue</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-5 bg-amber-100 rounded-full overflow-hidden relative">
          <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" style={{ width: `${Math.min(100, progressPercent)}%` }} />
          {sortedTiers.map((tier) => (
            <div key={tier.name} className={`absolute top-0 h-full w-0.5 ${currentRevenue >= tier.threshold ? 'bg-green-600' : 'bg-amber-600'}`}
              style={{ left: `${maxThreshold > 0 ? (tier.threshold / maxThreshold) * 100 : 0}%` }} />
          ))}
        </div>
        <div className="relative h-4 mt-1">
          {sortedTiers.map((tier) => (
            <span key={tier.name}
              className={`absolute text-[10px] -translate-x-1/2 ${currentRevenue >= tier.threshold ? 'text-green-600 font-semibold' : 'text-slate-400'}`}
              style={{ left: `${maxThreshold > 0 ? (tier.threshold / maxThreshold) * 100 : 0}%` }}>
              {tier.name}: ${(tier.threshold / 1000).toFixed(0)}K
            </span>
          ))}
        </div>
      </div>

      {/* Stats - Overview */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {isCurrentMonth ? (
          // Current month: show gap, daily needed, and next tier bonus
          nextTier ? (
            <>
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-100 text-center">
                <div className="text-xs text-slate-500 mb-1">Gap to {nextTier.name}</div>
                <div className="text-xl font-bold text-orange-600">${gapToNextTier.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 text-center">
                <div className="text-xs text-slate-500 mb-1">Daily Sales Needed</div>
                <div className="text-xl font-bold text-blue-600">${dailyGmvNeeded.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-100 text-center">
                <div className="text-xs text-slate-500 mb-1">Next Tier Bonus</div>
                <div className="text-xl font-bold text-purple-600">${nextTier.bonus.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400">Current: ${currentBonus.toLocaleString()}</div>
              </div>
            </>
          ) : (
            <div className="col-span-3 bg-green-50 rounded-lg p-3 border border-green-200 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <span className="text-green-700 font-semibold">Maximum Tier Achieved! Current Bonus: ${currentBonus.toLocaleString()}</span>
            </div>
          )
        ) : (
          // Historical month: show final results
          <>
            <div className="bg-green-50 rounded-lg p-3 border border-green-100 text-center">
              <div className="text-xs text-slate-500 mb-1">Final Tier</div>
              <div className="text-xl font-bold text-green-600">{currentTier?.name || 'None'}</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100 text-center">
              <div className="text-xs text-slate-500 mb-1">Final Bonus</div>
              <div className="text-xl font-bold text-amber-600">${currentBonus.toLocaleString()}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-center">
              <div className="text-xs text-slate-500 mb-1">Final Revenue</div>
              <div className="text-xl font-bold text-slate-600">${currentRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
          </>
        )}
      </div>

      {/* Rush analysis only shown for current month */}
      {isCurrentMonth && rushAnalysis && nextTier && (
        <RushAnalysisPanel analysis={rushAnalysis} bonusIncrease={nextTier.bonus - currentBonus} gapToNextTier={gapToNextTier} daysRemaining={daysRemaining} />
      )}
    </div>
  );
};

interface RushAnalysisPanelProps {
  analysis: RushAnalysis;
  bonusIncrease: number;
  gapToNextTier: number;
  daysRemaining: number;
}

const RushAnalysisPanel: React.FC<RushAnalysisPanelProps> = ({ analysis, bonusIncrease, gapToNextTier, daysRemaining }) => {
  const { posts } = analysis;
  const [showPostDetails, setShowPostDetails] = useState(false);

  // Calculate projected GMV and projected spend for each post
  const totalCurrentSpend = posts.reduce((sum, p) => sum + p.totalSpend, 0);
  const totalDaysWithData = posts.reduce((sum, p) => sum + p.daysWithData, 0);
  const avgDaysWithData = posts.length > 0 ? totalDaysWithData / posts.length : 1;
  
  const postsWithProjection = posts.map(p => {
    const projectedGmv = p.avgDailyGmv * daysRemaining;
    // Calculate projected ad spend for natural GMV: use avg daily spend * daysRemaining
    const avgDailySpend = p.daysWithData > 0 ? p.totalSpend / p.daysWithData : 0;
    const projectedSpend = avgDailySpend * daysRemaining;
    return { ...p, projectedGmv, projectedSpend, extraSpend: 0, extraGmv: 0, extraCost: 0 };
  });

  const totalProjectedGmv = postsWithProjection.reduce((sum, p) => sum + p.projectedGmv, 0);
  const totalProjectedSpend = postsWithProjection.reduce((sum, p) => sum + p.projectedSpend, 0);
  const shortfall = Math.max(0, gapToNextTier - totalProjectedGmv);
  const canReachNaturally = shortfall === 0;

  // If shortfall > 0, calculate extra spend needed per post (by spend ratio)
  if (shortfall > 0) {
    postsWithProjection.forEach(p => {
      const spendRatio = totalCurrentSpend > 0 ? p.totalSpend / totalCurrentSpend : 1 / posts.length;
      const allocatedGmv = shortfall * spendRatio;
      p.extraGmv = allocatedGmv;
      p.extraSpend = p.roas > 0 ? allocatedGmv / p.roas : 0;
      p.extraCost = p.extraSpend * (1 - p.roi);
    });
  }

  const totalExtraSpend = postsWithProjection.reduce((sum, p) => sum + p.extraSpend, 0);
  const totalExtraCost = postsWithProjection.reduce((sum, p) => sum + p.extraCost, 0);
  const netGain = bonusIncrease - totalExtraCost;
  const worthRushing = netGain > 0;

  return (
    <div className={`rounded-lg border-2 p-4 ${canReachNaturally ? 'bg-emerald-50 border-emerald-300' : worthRushing ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
      
      {/* Status & Conclusion */}
      <div className="flex items-start gap-3 mb-4">
        {canReachNaturally ? (
          <>
            <CheckCircle className="w-8 h-8 text-emerald-500 flex-shrink-0" />
            <div>
              <div className="text-xl font-bold text-emerald-700">On Track Naturally!</div>
              <div className="text-sm text-slate-600">Projected GMV will reach the tier without extra spend</div>
            </div>
          </>
        ) : worthRushing ? (
          <>
            <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
            <div>
              <div className="text-xl font-bold text-green-700">Worth Rushing!</div>
              <div className="text-sm text-slate-600 mt-1">
                <span className="font-semibold">Bonus</span> <span className="text-emerald-600 font-bold">+${bonusIncrease.toLocaleString()}</span>
                <span className="mx-2">vs</span>
                <span className="font-semibold">Extra Cost</span> <span className="text-orange-600 font-bold">${totalExtraCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="mx-2">=</span>
                <span className="font-semibold">Net</span> <span className="text-green-600 font-bold">+${netGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
            <div>
              <div className="text-xl font-bold text-red-700">Not Worth Rushing</div>
              <div className="text-sm text-slate-600 mt-1">
                <span className="font-semibold">Bonus</span> <span className="text-emerald-600 font-bold">+${bonusIncrease.toLocaleString()}</span>
                <span className="mx-2">vs</span>
                <span className="font-semibold">Extra Cost</span> <span className="text-orange-600 font-bold">${totalExtraCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="mx-2">=</span>
                <span className="font-semibold">Net</span> <span className="text-red-600 font-bold">${netGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <div className="bg-white/70 rounded p-2 text-center">
          <div className="text-[10px] text-slate-500">Projected GMV</div>
          <div className="text-sm font-bold text-blue-600">${totalProjectedGmv.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-white/70 rounded p-2 text-center">
          <div className="text-[10px] text-slate-500">Projected Ad Spend</div>
          <div className="text-sm font-bold text-indigo-600">${totalProjectedSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-white/70 rounded p-2 text-center">
          <div className="text-[10px] text-slate-500">Shortfall</div>
          <div className={`text-sm font-bold ${shortfall > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {shortfall > 0 ? `$${shortfall.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'None'}
          </div>
        </div>
        <div className="bg-white/70 rounded p-2 text-center">
          <div className="text-[10px] text-slate-500">Extra Spend Needed</div>
          <div className="text-sm font-bold text-orange-600">
            {totalExtraSpend > 0 ? `$${totalExtraSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
          </div>
        </div>
        <div className="bg-white/70 rounded p-2 text-center">
          <div className="text-[10px] text-slate-500">Extra Cost</div>
          <div className="text-sm font-bold text-red-600">
            {totalExtraCost > 0 ? `$${totalExtraCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
          </div>
        </div>
      </div>

      {/* Per-Post Table - Collapsed by default */}
      <div className="bg-white/60 rounded-lg p-3">
        <button 
          onClick={() => setShowPostDetails(!showPostDetails)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            <h5 className="text-xs font-semibold text-slate-700">Per-Post Breakdown ({posts.length} posts)</h5>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showPostDetails ? 'rotate-180' : ''}`} />
        </button>
        
        {showPostDetails && (
          <>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="text-left py-1 font-medium">Post</th>
                    <th className="text-right py-1 font-medium w-10">Days</th>
                    <th className="text-right py-1 font-medium w-12">ROAS</th>
                    <th className="text-right py-1 font-medium w-12">ROI</th>
                    <th className="text-right py-1 font-medium w-16">Proj. GMV</th>
                    <th className="text-right py-1 font-medium w-16">Proj. Spend</th>
                    {shortfall > 0 && (
                      <>
                        <th className="text-right py-1 font-medium w-16">Extra Spend</th>
                        <th className="text-right py-1 font-medium w-14">Extra Cost</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {postsWithProjection.map((p, idx) => (
                    <tr key={p.contentName} className={idx % 2 === 0 ? 'bg-slate-50/50' : ''}>
                      <td className="py-1.5 pr-2">
                        <div className="truncate max-w-[120px] font-medium text-slate-700" title={p.contentName}>{p.contentName}</div>
                      </td>
                      <td className="text-right py-1.5">
                        <span className={`flex items-center justify-end gap-0.5 ${p.isNewPost ? 'text-amber-600' : 'text-slate-500'}`}>
                          {p.isNewPost && <Clock className="w-3 h-3" />}{p.daysWithData}
                        </span>
                      </td>
                      <td className="text-right py-1.5">
                        <span className={`font-semibold ${p.roas >= 10 ? 'text-green-600' : p.roas >= 5 ? 'text-blue-600' : 'text-slate-600'}`}>
                          {p.roas.toFixed(1)}x
                        </span>
                      </td>
                      <td className="text-right py-1.5">
                        <span className={`font-semibold ${p.roi >= 1 ? 'text-green-600' : p.roi >= 0.5 ? 'text-blue-600' : 'text-slate-600'}`}>
                          {p.roi.toFixed(2)}x
                        </span>
                      </td>
                      <td className="text-right py-1.5 text-blue-600">${p.projectedGmv.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="text-right py-1.5 text-indigo-600">${p.projectedSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      {shortfall > 0 && (
                        <>
                          <td className="text-right py-1.5 text-orange-600 font-medium">${p.extraSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="text-right py-1.5 text-red-500">${p.extraCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        </>
                      )}
                    </tr>
                  ))}
                  {/* Total */}
                  <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                    <td className="py-2 text-slate-700">Total</td>
                    <td className="text-right py-2 text-slate-500">-</td>
                    <td className="text-right py-2 text-slate-500">-</td>
                    <td className="text-right py-2 text-slate-500">-</td>
                    <td className="text-right py-2 text-blue-600">${totalProjectedGmv.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="text-right py-2 text-indigo-600">${totalProjectedSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    {shortfall > 0 && (
                      <>
                        <td className="text-right py-2 text-orange-600">${totalExtraSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="text-right py-2 text-red-600">${totalExtraCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      </>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
              <span><Clock className="w-3 h-3 inline text-amber-500" /> &lt;3 days (less reliable)</span>
              <span><span className="text-green-600 font-semibold">Green</span>: High</span>
              <span><span className="text-blue-600 font-semibold">Blue</span>: Medium</span>
            </div>
          </>
        )}
      </div>

      {/* Calculation Logic */}
      {!canReachNaturally && (
        <div className="mt-3 bg-white/50 rounded p-2 text-[10px] text-slate-500">
          <strong>Logic:</strong> Shortfall allocated by current spend ratio → Each post: Extra Spend = GMV / ROAS, Extra Cost = Spend × (1 - ROI)
        </div>
      )}
    </div>
  );
};

export default TierRewardsTracker;
