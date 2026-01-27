import React, { useState, useMemo } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, Calendar, 
  ChevronDown, ArrowUpDown, Award, AlertCircle 
} from 'lucide-react';
import { AdData, CreatorBonusCalData, CreatorSettlement, EarningsSummary, TimeRangePreset } from '../types';
import { calculateCreatorSettlements } from '../services/dataService';
import { KpiCard } from './KpiCard';

interface EarningsTabProps {
  adData: AdData[];
  bonusCalData: CreatorBonusCalData[];
}

// Get date range for preset - aligned with Filters component
const getDateRangeForPreset = (preset: TimeRangePreset): { start: Date; end: Date } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (preset) {
    case 'this_week': {
      // Sunday to today (same as Filters)
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      return { start, end: today };
    }
    case 'last_week': {
      // Last Sunday to last Saturday (same as Filters)
      const end = new Date(today);
      end.setDate(today.getDate() - today.getDay() - 1); // Last Saturday
      const start = new Date(end);
      start.setDate(end.getDate() - 6); // Last Sunday
      return { start, end };
    }
    case 'this_month': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: firstDay, end: today };
    }
    case 'last_month': {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: firstDay, end: lastDay };
    }
    case 'this_quarter': {
      const quarter = Math.floor(today.getMonth() / 3);
      const firstDay = new Date(today.getFullYear(), quarter * 3, 1);
      return { start: firstDay, end: today };
    }
    default:
      return { start: today, end: today };
  }
};

// Format date as YYYY-MM-DD for input
const formatDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const EarningsTab: React.FC<EarningsTabProps> = ({ adData, bonusCalData }) => {
  // Time range state
  const [timePreset, setTimePreset] = useState<TimeRangePreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  // Sorting state
  const [sortField, setSortField] = useState<keyof CreatorSettlement>('adSpend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    if (timePreset === 'custom' && customStartDate && customEndDate) {
      return {
        startDate: new Date(customStartDate),
        endDate: new Date(customEndDate),
      };
    }
    const range = getDateRangeForPreset(timePreset);
    return { startDate: range.start, endDate: range.end };
  }, [timePreset, customStartDate, customEndDate]);

  // Determine if this is a monthly period (use Bonus Cal commission)
  const isMonthlyPeriod = timePreset === 'this_month' || timePreset === 'last_month';

  // Check if we have Bonus Cal data for this period
  // - "This Month" (January 2026): Full Bonus Cal data available
  // - "This Week" / "Last Week": Use ad data earning + prorated bonus diff
  // - "Last Month" / "This Quarter": No historical Bonus Cal data yet
  const hasValidBonusCalData = timePreset === 'this_month' || timePreset === 'this_week' || timePreset === 'last_week';
  const hasFullBonusCalData = timePreset === 'this_month'; // Only this month has complete data

  // Calculate earnings summary (only if we have valid data)
  const earningsSummary: EarningsSummary = useMemo(() => {
    if (!hasValidBonusCalData) {
      // Return empty summary for periods without Bonus Cal data
      return {
        totalSpend: 0,
        totalEarning: 0,
        totalCommission: 0,
        totalBonusDiff: 0,
        totalProfit: 0,
        totalMarginTecdo: 0,
        creatorSettlements: [],
      };
    }
    return calculateCreatorSettlements(adData, bonusCalData, startDate, endDate, isMonthlyPeriod);
  }, [adData, bonusCalData, startDate, endDate, isMonthlyPeriod, hasValidBonusCalData]);

  // Sort settlements
  const sortedSettlements = useMemo(() => {
    const sorted = [...earningsSummary.creatorSettlements];
    sorted.sort((a, b) => {
      const aVal = a[sortField] as number;
      const bVal = b[sortField] as number;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [earningsSummary.creatorSettlements, sortField, sortDirection]);

  const handleSort = (field: keyof CreatorSettlement) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handlePresetChange = (preset: TimeRangePreset) => {
    setTimePreset(preset);
    if (preset !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    const absValue = Math.abs(value);
    const prefix = value < 0 ? '-' : '';
    if (absValue >= 1000) {
      return `${prefix}$${(absValue / 1000).toFixed(1)}K`;
    }
    return `${prefix}$${absValue.toFixed(0)}`;
  };

  // Format full currency
  const formatFullCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Period label
  const periodLabel = useMemo(() => {
    const start = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} - ${end}`;
  }, [startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              Earnings & Settlement
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Track creator settlements, margins, and bonus distributions
            </p>
          </div>
          
          {/* Time Range Selector - Dropdown */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={timePreset}
                onChange={(e) => handlePresetChange(e.target.value as TimeRangePreset)}
                className="appearance-none bg-white border border-slate-300 rounded-lg py-2 pl-3 pr-10 text-sm font-medium text-slate-700 shadow-sm cursor-pointer hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="this_week">This Week</option>
                <option value="last_week">Last Week</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="custom">Custom Range</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            
            {/* Custom date inputs - only show when custom is selected */}
            {timePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate || formatDateInput(startDate)}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate || formatDateInput(endDate)}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Period indicator */}
        <div className="mt-3 flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <span className="text-slate-600">Period: <strong className="text-indigo-600">{periodLabel}</strong></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">{Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} days</span>
          {hasValidBonusCalData && (
            <>
              <span className="text-slate-300">|</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${hasFullBonusCalData ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                Commission: {hasFullBonusCalData ? 'Bonus Cal' : 'Ad Data'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* No Data State */}
      {!hasValidBonusCalData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-amber-800 mb-2">Historical Data Not Available</h3>
          <p className="text-sm text-amber-700 max-w-md mx-auto">
            Bonus Cal data for <strong>{timePreset === 'last_month' ? 'Last Month' : timePreset === 'this_quarter' ? 'This Quarter' : 'this period'}</strong> is not yet available.
            <br /><br />
            Available periods:
            <br />• <strong>This Month</strong> - Full Bonus Cal data
            <br />• <strong>This Week / Last Week</strong> - Ad data + prorated Bonus Diff
            <br /><br />
            Historical data will be added to a separate table for accurate quarterly/monthly settlement tracking.
          </p>
          <button
            onClick={() => setTimePreset('this_month')}
            className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
          >
            View This Month Data
          </button>
        </div>
      )}

      {/* KPI Cards - only show when data is available */}
      {hasValidBonusCalData && (
      <div className="grid grid-cols-5 gap-4">
        {/* Ad Spend */}
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
          <p className="text-xs font-medium text-rose-600 mb-2">Ad Spend</p>
          <p className="text-2xl font-bold text-rose-700">{formatFullCurrency(earningsSummary.totalSpend)}</p>
        </div>
        
        {/* Total Earning */}
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <p className="text-xs font-medium text-emerald-600 mb-2">Total Earning</p>
          <p className="text-2xl font-bold text-emerald-700">{formatFullCurrency(earningsSummary.totalCommission + earningsSummary.totalBonusDiff)}</p>
          <div className="mt-2 pt-2 border-t border-emerald-200 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Commission</span>
              <span className="font-medium text-blue-600">{formatFullCurrency(earningsSummary.totalCommission)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Bonus Diff</span>
              <span className="font-medium text-amber-600">{formatFullCurrency(earningsSummary.totalBonusDiff)}</span>
            </div>
          </div>
        </div>
        
        {/* Total Profit */}
        <div className={`p-4 rounded-xl ${earningsSummary.totalProfit >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-xs font-medium mb-2 ${earningsSummary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Total Profit</p>
          <p className={`text-2xl font-bold ${earningsSummary.totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatFullCurrency(earningsSummary.totalProfit)}</p>
          <p className="text-xs text-slate-500 mt-2">Earning - Spend</p>
        </div>
        
        {/* Margin (Tecdo) */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200">
          <p className="text-xs font-medium text-indigo-600 mb-2">Margin (Tecdo)</p>
          <p className={`text-2xl font-bold ${earningsSummary.totalMarginTecdo >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{formatFullCurrency(earningsSummary.totalMarginTecdo)}</p>
          <p className="text-xs text-slate-500 mt-2">{earningsSummary.totalProfit >= 0 ? '50% of profit' : 'absorbs all loss'}</p>
        </div>
        
        {/* Stats */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <p className="text-xs font-medium text-slate-600 mb-2">Summary</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Profitable</span>
              <span className="font-bold text-green-600">{earningsSummary.creatorSettlements.filter(s => s.isProfitable).length}/{earningsSummary.creatorSettlements.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Period</span>
              <span className="font-bold text-slate-700">{Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} days</span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Creator Details Table - only show when data is available */}
      {hasValidBonusCalData && (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-800">Creator Settlement Details</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Creator
                </th>
                <th 
                  className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600"
                  onClick={() => handleSort('adSpend')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Ad Spend <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600"
                  onClick={() => handleSort('commissionEarning')}
                  title="Commission-Ads from Bonus Cal (prorated)"
                >
                  <div className="flex items-center justify-end gap-1">
                    Commission <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600"
                  onClick={() => handleSort('bonusDiffWeekly')}
                  title="Bonus Diff prorated by period"
                >
                  <div className="flex items-center justify-end gap-1">
                    Bonus Diff <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Earning
                </th>
                <th 
                  className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600"
                  onClick={() => handleSort('profit')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Total Profit <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600"
                  onClick={() => handleSort('marginTecdo')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Margin <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {sortedSettlements.map((settlement, idx) => {
                const totalEarning = settlement.commissionEarning + settlement.bonusDiffWeekly;
                return (
                <tr key={settlement.creatorName} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${settlement.isProfitable ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm font-medium text-slate-900">{settlement.creatorName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-slate-700">
                    {formatFullCurrency(settlement.adSpend)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-blue-600">
                    {formatFullCurrency(settlement.commissionEarning)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-amber-600" title={`Projected: ${formatFullCurrency(settlement.totalTierBonus)} - Organic: ${formatFullCurrency(settlement.organicTierBonus)} = ${formatFullCurrency(settlement.bonusDiff)} (Monthly)`}>
                    {formatFullCurrency(settlement.bonusDiffWeekly)}
                    <div className="text-[9px] text-slate-400">
                      {formatCurrency(settlement.totalTierBonus)} - {formatCurrency(settlement.organicTierBonus)}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-emerald-600 font-semibold">
                    {formatFullCurrency(totalEarning)}
                  </td>
                  <td className={`px-3 py-3 whitespace-nowrap text-right text-sm font-mono font-bold ${settlement.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {formatFullCurrency(settlement.profit)}
                  </td>
                  <td className={`px-3 py-3 whitespace-nowrap text-right text-sm font-mono font-bold ${settlement.marginTecdo >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                    {formatFullCurrency(settlement.marginTecdo)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-center">
                    {settlement.isProfitable ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <TrendingUp className="w-3 h-3 mr-1" /> Profit
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <TrendingDown className="w-3 h-3 mr-1" /> Loss
                      </span>
                    )}
                  </td>
                </tr>
              );})}
              
              {/* Total row */}
              <tr className="bg-slate-100 font-bold">
                <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-900">
                  Total ({sortedSettlements.length} creators)
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-slate-900">
                  {formatFullCurrency(earningsSummary.totalSpend)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-blue-600">
                  {formatFullCurrency(earningsSummary.totalCommission)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-amber-600">
                  {formatFullCurrency(earningsSummary.totalBonusDiff)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-emerald-600">
                  {formatFullCurrency(earningsSummary.totalCommission + earningsSummary.totalBonusDiff)}
                </td>
                <td className={`px-3 py-3 whitespace-nowrap text-right text-sm font-mono ${earningsSummary.totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatFullCurrency(earningsSummary.totalProfit)}
                </td>
                <td className={`px-3 py-3 whitespace-nowrap text-right text-sm font-mono ${earningsSummary.totalMarginTecdo >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                  {formatFullCurrency(earningsSummary.totalMarginTecdo)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-center">
                  -
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Calculation Notes - only show when data is available */}
      {hasValidBonusCalData && (
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
        <h4 className="text-sm font-semibold text-amber-800 mb-2">Calculation Logic</h4>
        <div className="text-xs text-amber-700 space-y-2">
          <div>
            <p className="font-semibold mb-1">Data Sources:</p>
            <p className="ml-2">• <strong>Ad Spend:</strong> From main ad data table (filtered by period)</p>
            <p className="ml-2">• <strong>Commission:</strong></p>
            <p className="ml-4">- Monthly: Bonus Cal → Commission-Ads (shipped revenue based)</p>
            <p className="ml-4">- Weekly/Other: Ad data → earning (discounted GMV × creator ratio)</p>
          </div>
          <div>
            <p className="font-semibold mb-1">Bonus Diff:</p>
            <p className="ml-2">= Projected Tier Bonus - Organic Tier Bonus</p>
            <p className="ml-2 text-amber-600">Weekly: prorated by period ratio (e.g., 7/30 for a week)</p>
          </div>
          <div>
            <p className="font-semibold mb-1">Formulas:</p>
            <p className="ml-2">• <strong>Total Earning</strong> = Commission + Bonus Diff</p>
            <p className="ml-2">• <strong>Total Profit</strong> = Total Earning - Ad Spend</p>
          </div>
          <div>
            <p className="font-semibold mb-1">Margin (Tecdo):</p>
            <p className="ml-2">• <strong>If Total Profit &gt; 0:</strong> Margin = 50% × Total Profit</p>
            <p className="ml-2">• <strong>If Total Profit &lt; 0:</strong> Margin = Total Profit (Tecdo absorbs all loss)</p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
