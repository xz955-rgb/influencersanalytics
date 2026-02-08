import React, { useState, useMemo } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, Calendar, 
  ChevronDown, ArrowUpDown, AlertCircle, ChevronRight 
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
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      return { start, end: today };
    }
    case 'last_week': {
      const end = new Date(today);
      end.setDate(today.getDate() - today.getDay() - 1);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
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

const formatDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const EarningsTab: React.FC<EarningsTabProps> = ({ adData, bonusCalData }) => {
  const [timePreset, setTimePreset] = useState<TimeRangePreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [sortField, setSortField] = useState<keyof CreatorSettlement>('adSpend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [emailMonthFilter, setEmailMonthFilter] = useState<string>(''); // For email section month filter

  const { startDate, endDate } = useMemo(() => {
    if (timePreset === 'custom' && customStartDate && customEndDate) {
      return { startDate: new Date(customStartDate), endDate: new Date(customEndDate) };
    }
    const range = getDateRangeForPreset(timePreset);
    return { startDate: range.start, endDate: range.end };
  }, [timePreset, customStartDate, customEndDate]);

  const isMonthlyPeriod = timePreset === 'this_month' || timePreset === 'last_month';

  // Get the month string (YYYY-MM) for the selected period
  const selectedMonth = useMemo(() => {
    const year = startDate.getFullYear();
    const month = startDate.getMonth() + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  }, [startDate]);

  // Get available months from Bonus Cal data
  const availableBonusCalMonths = useMemo(() => {
    const months = new Set<string>();
    bonusCalData.forEach(d => {
      if (d.dataMonth) months.add(d.dataMonth);
    });
    return Array.from(months).sort().reverse(); // Most recent first
  }, [bonusCalData]);

  // Filter Bonus Cal data by selected month - ONLY use data for the matching month
  const filteredBonusCalData = useMemo(() => {
    return bonusCalData.filter(d => d.dataMonth === selectedMonth);
  }, [bonusCalData, selectedMonth]);

  // Check if we have Bonus Cal data for the selected month
  const hasBonusCalDataForMonth = filteredBonusCalData.length > 0;

  // For monthly periods (This Month / Last Month), require Bonus Cal data
  // For other periods (This Week, Last Week, Custom, Quarter), always show using Ad Data only
  const requiresBonusCal = isMonthlyPeriod;
  const hasValidData = requiresBonusCal ? hasBonusCalDataForMonth : true;
  const useBonusCalCommission = isMonthlyPeriod && hasBonusCalDataForMonth;

  const earningsSummary: EarningsSummary = useMemo(() => {
    if (!hasValidData) {
      return {
        totalSpend: 0, totalEarning: 0, totalCommission: 0, totalBonusDiff: 0,
        totalProfit: 0, totalMarginTecdo: 0, creatorSettlements: [],
      };
    }
    // For monthly periods with Bonus Cal data, use Bonus Cal for commission
    // For other periods, use Ad Data only (pass empty bonusCalData to use ad earning)
    const bonusDataToUse = useBonusCalCommission ? filteredBonusCalData : [];
    return calculateCreatorSettlements(adData, bonusDataToUse, startDate, endDate, useBonusCalCommission);
  }, [adData, filteredBonusCalData, startDate, endDate, useBonusCalCommission, hasValidData]);

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
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('desc'); }
  };

  const handlePresetChange = (preset: TimeRangePreset) => {
    setTimePreset(preset);
    if (preset !== 'custom') { setCustomStartDate(''); setCustomEndDate(''); }
  };

  const formatCurrency = (value: number): string => {
    const absValue = Math.abs(value);
    const prefix = value < 0 ? '-' : '';
    return absValue >= 1000 ? `${prefix}$${(absValue / 1000).toFixed(1)}K` : `${prefix}$${absValue.toFixed(0)}`;
  };

  const formatFullCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const periodLabel = useMemo(() => {
    const start = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} - ${end}`;
  }, [startDate, endDate]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              Earnings & Settlement
            </h2>
            <p className="text-sm text-slate-500 mt-1">Track creator settlements, margins, and bonus distributions</p>
          </div>
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
            {timePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={customStartDate || formatDateInput(startDate)} onChange={(e) => setCustomStartDate(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
                <span className="text-slate-400">to</span>
                <input type="date" value={customEndDate || formatDateInput(endDate)} onChange={(e) => setCustomEndDate(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <span className="text-slate-600">Period: <strong className="text-indigo-600">{periodLabel}</strong></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">{Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} days</span>
          {hasValidData && (
            <>
              <span className="text-slate-300">|</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${useBonusCalCommission ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                Commission: {useBonusCalCommission ? 'Bonus Cal' : 'Ad Data'}
              </span>
            </>
          )}
        </div>
      </div>

      {!hasValidData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-amber-800 mb-2">Bonus Cal Data Not Available</h3>
          <p className="text-sm text-amber-700 max-w-md mx-auto">
            No Bonus Cal data for <strong>{new Date(startDate).toLocaleString('en-US', { month: 'long', year: 'numeric' })}</strong>.
            <br /><br />
            Monthly views (This Month / Last Month) require Bonus Cal data.
            <br />
            Available months: {availableBonusCalMonths.length > 0 
              ? availableBonusCalMonths.map(m => {
                  const [y, mon] = m.split('-');
                  return new Date(parseInt(y), parseInt(mon) - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
                }).join(', ')
              : 'None'}
          </p>
          {availableBonusCalMonths.length > 0 && (
            <div className="mt-4 flex justify-center gap-2 flex-wrap">
              {availableBonusCalMonths.slice(0, 3).map(m => {
                const [y, mon] = m.split('-');
                const monthDate = new Date(parseInt(y), parseInt(mon) - 1);
                const now = new Date();
                const isThisMonth = monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth();
                const isLastMonth = monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth() - 1;
                return (
                  <button
                    key={m}
                    onClick={() => setTimePreset(isThisMonth ? 'this_month' : isLastMonth ? 'last_month' : 'this_month')}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                  >
                    View {monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {hasValidData && (
      <div className="grid grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
          <p className="text-xs font-medium text-rose-600 mb-2">Ad Spend</p>
          <p className="text-2xl font-bold text-rose-700">{formatFullCurrency(earningsSummary.totalSpend)}</p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <p className="text-xs font-medium text-emerald-600 mb-2">Total Earning</p>
          <p className="text-2xl font-bold text-emerald-700">{formatFullCurrency(earningsSummary.totalCommission + earningsSummary.totalBonusDiff)}</p>
          <div className="mt-2 pt-2 border-t border-emerald-200 space-y-1">
            <div className="flex justify-between text-xs"><span className="text-slate-500">Commission</span><span className="font-medium text-blue-600">{formatFullCurrency(earningsSummary.totalCommission)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Bonus Diff</span><span className="font-medium text-amber-600">{formatFullCurrency(earningsSummary.totalBonusDiff)}</span></div>
          </div>
        </div>
        <div className={`p-4 rounded-xl ${earningsSummary.totalProfit >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-xs font-medium mb-2 ${earningsSummary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Total Profit</p>
          <p className={`text-2xl font-bold ${earningsSummary.totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatFullCurrency(earningsSummary.totalProfit)}</p>
          <p className="text-xs text-slate-500 mt-2">Earning - Spend</p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200">
          <p className="text-xs font-medium text-indigo-600 mb-2">Margin (Tecdo)</p>
          <p className={`text-2xl font-bold ${earningsSummary.totalMarginTecdo >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{formatFullCurrency(earningsSummary.totalMarginTecdo)}</p>
          <p className="text-xs text-slate-500 mt-2">{earningsSummary.totalProfit >= 0 ? '50% of profit' : 'absorbs all loss'}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <p className="text-xs font-medium text-slate-600 mb-2">Summary</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Profitable</span><span className="font-bold text-green-600">{earningsSummary.creatorSettlements.filter(s => s.isProfitable).length}/{earningsSummary.creatorSettlements.length}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Period</span><span className="font-bold text-slate-700">{Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} days</span></div>
          </div>
        </div>
      </div>
      )}

      {hasValidData && (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50"><h3 className="text-sm font-bold text-slate-800">Creator Settlement Details</h3></div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Creator</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('adSpend')}><div className="flex items-center justify-end gap-1">Ad Spend <ArrowUpDown className="w-3 h-3" /></div></th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('commissionEarning')}><div className="flex items-center justify-end gap-1">Commission <ArrowUpDown className="w-3 h-3" /></div></th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('bonusDiffWeekly')}><div className="flex items-center justify-end gap-1">Bonus Diff <ArrowUpDown className="w-3 h-3" /></div></th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Earning</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('profit')}><div className="flex items-center justify-end gap-1">Total Profit <ArrowUpDown className="w-3 h-3" /></div></th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('marginTecdo')}><div className="flex items-center justify-end gap-1">Margin <ArrowUpDown className="w-3 h-3" /></div></th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {sortedSettlements.map((settlement) => {
                const totalEarning = settlement.commissionEarning + settlement.bonusDiffWeekly;
                return (
                <tr key={settlement.creatorName} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${settlement.isProfitable ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm font-medium text-slate-900">{settlement.creatorName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-slate-700">{formatFullCurrency(settlement.adSpend)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-blue-600">{formatFullCurrency(settlement.commissionEarning)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-amber-600" title={`Projected: ${formatFullCurrency(settlement.totalTierBonus)} - Organic: ${formatFullCurrency(settlement.organicTierBonus)}`}>{formatFullCurrency(settlement.bonusDiffWeekly)}<div className="text-[9px] text-slate-400">{formatCurrency(settlement.totalTierBonus)} - {formatCurrency(settlement.organicTierBonus)}</div></td>
                  <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-emerald-600 font-semibold">{formatFullCurrency(totalEarning)}</td>
                  <td className={`px-3 py-3 whitespace-nowrap text-right text-sm font-mono font-bold ${settlement.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatFullCurrency(settlement.profit)}</td>
                  <td className={`px-3 py-3 whitespace-nowrap text-right text-sm font-mono font-bold ${settlement.marginTecdo >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>{formatFullCurrency(settlement.marginTecdo)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-center">
                    {settlement.isProfitable ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><TrendingUp className="w-3 h-3 mr-1" /> Profit</span> : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><TrendingDown className="w-3 h-3 mr-1" /> Loss</span>}
                  </td>
                </tr>
              );})}
              <tr className="bg-slate-100 font-bold">
                <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-900">Total ({sortedSettlements.length} creators)</td>
                <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-slate-900">{formatFullCurrency(earningsSummary.totalSpend)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-blue-600">{formatFullCurrency(earningsSummary.totalCommission)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-amber-600">{formatFullCurrency(earningsSummary.totalBonusDiff)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-emerald-600">{formatFullCurrency(earningsSummary.totalCommission + earningsSummary.totalBonusDiff)}</td>
                <td className={`px-3 py-3 whitespace-nowrap text-right text-sm font-mono ${earningsSummary.totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatFullCurrency(earningsSummary.totalProfit)}</td>
                <td className={`px-3 py-3 whitespace-nowrap text-right text-sm font-mono ${earningsSummary.totalMarginTecdo >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>{formatFullCurrency(earningsSummary.totalMarginTecdo)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-center">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      )}

      {hasValidData && useBonusCalCommission && (() => {
        const dataMonth = startDate.toLocaleString('en-US', { month: 'short' });
        const bonusMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1).toLocaleString('en-US', { month: 'short' });
        const commissionMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 2, 1).toLocaleString('en-US', { month: 'short' });
        return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-indigo-50">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><DollarSign className="w-4 h-4 text-purple-600" /> Creator Payments to Tecdo</h3>
          <p className="text-xs text-slate-500 mt-1"><strong>{dataMonth}</strong> data → Flat Fee Rewards in <strong>{bonusMonth}</strong> (M+1) | Commission in <strong>{commissionMonth}</strong> (M+2)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Creator</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Profit</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{bonusMonth} Rewards (M+1)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{commissionMonth} Commission (M+2)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Payment</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {sortedSettlements.map((settlement) => {
                const isProfitable = settlement.profit >= 0;
                const paymentOnBonus = isProfitable ? settlement.bonusDiff / 2 : settlement.bonusDiff;
                const paymentOnCommission = isProfitable ? settlement.profit / 2 + settlement.adSpend - settlement.bonusDiff / 2 : settlement.commissionEarning;
                const totalPayment = paymentOnBonus + paymentOnCommission;
                return (
                  <tr key={settlement.creatorName} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 whitespace-nowrap"><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${isProfitable ? 'bg-green-500' : 'bg-amber-500'}`} /><span className="text-sm font-medium text-slate-900">{settlement.creatorName}</span></div></td>
                    <td className={`px-3 py-3 whitespace-nowrap text-right text-sm font-mono font-bold ${isProfitable ? 'text-green-600' : 'text-amber-600'}`}>{formatFullCurrency(settlement.profit)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-purple-600">{formatFullCurrency(paymentOnBonus)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-indigo-600">{formatFullCurrency(paymentOnCommission)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono font-bold text-slate-900">{formatFullCurrency(totalPayment)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-center"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isProfitable ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-700'}`}>{isProfitable ? 'Profit' : 'Loss'}</span></td>
                  </tr>
                );
              })}
              <tr className="bg-slate-100 font-bold">
                <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-900">Total</td>
                <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-slate-700">{formatFullCurrency(sortedSettlements.reduce((sum, s) => sum + s.profit, 0))}</td>
                <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-purple-600">{formatFullCurrency(sortedSettlements.reduce((sum, s) => sum + (s.profit >= 0 ? s.bonusDiff / 2 : s.bonusDiff), 0))}</td>
                <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono text-indigo-600">{formatFullCurrency(sortedSettlements.reduce((sum, s) => s.profit >= 0 ? sum + s.profit / 2 + s.adSpend - s.bonusDiff / 2 : sum + s.commissionEarning, 0))}</td>
                <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-mono font-bold text-slate-900">{formatFullCurrency(sortedSettlements.reduce((sum, s) => sum + (s.profit >= 0 ? s.bonusDiff / 2 : s.bonusDiff) + (s.profit >= 0 ? s.profit / 2 + s.adSpend - s.bonusDiff / 2 : s.commissionEarning), 0))}</td>
                <td className="px-3 py-3 whitespace-nowrap text-center">-</td>
              </tr>
            </tbody>
          </table>
        </div>
        <details className="border-t border-purple-100 group">
          <summary className="p-3 bg-purple-50/50 cursor-pointer hover:bg-purple-50 flex items-center gap-2 text-xs font-medium text-purple-700">
            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" /> Click to show payment logic
          </summary>
          <div className="p-4 bg-purple-50/30 border-t border-purple-100 text-xs text-purple-700 space-y-1">
            <p><strong>ROI &gt; 1 (Commission &gt; Ad Spend):</strong> Creator receives bonus (T+1), pays half to us. Remaining payment = Profit/2 + Ad Spend - Rewards Diff/2 (M+2).</p>
            <p><strong>ROI &lt; 1:</strong> Commission defaults to us (M+2). Remaining payment when they receive bonus (M+1): 100% Rewards Diff to Tecdo.</p>
          </div>
        </details>
      </div>
        );
      })()}

      {/* Settlement Email Section - Has its own month filter */}
      {availableBonusCalMonths.length > 0 && (() => {
        // Use email filter month if set, otherwise use first available month
        const effectiveEmailMonth = emailMonthFilter || availableBonusCalMonths[0];
        const [emailYear, emailMon] = effectiveEmailMonth.split('-').map(Number);
        const emailMonthDate = new Date(emailYear, emailMon - 1, 1);
        
        // Get Bonus Cal data for email month
        const emailBonusCalData = bonusCalData.filter(d => d.dataMonth === effectiveEmailMonth);
        
        // Calculate settlements for email month (need ad data for that month too)
        const emailMonthStart = new Date(emailYear, emailMon - 1, 1);
        const emailMonthEnd = new Date(emailYear, emailMon, 0);
        const emailSettlements = emailBonusCalData.length > 0 
          ? calculateCreatorSettlements(adData, emailBonusCalData, emailMonthStart, emailMonthEnd, true).creatorSettlements
          : [];
        
        const dataMonth = emailMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const rewardsMonth = new Date(emailYear, emailMon, 1);
        const commissionMonth = new Date(emailYear, emailMon + 1, 1);
        const rewardsMonthStr = rewardsMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const commissionMonthStr = commissionMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const rewardsDueDate = new Date(rewardsMonth.getFullYear(), rewardsMonth.getMonth(), 10).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const commissionDueDate = new Date(commissionMonth.getFullYear(), commissionMonth.getMonth(), 10).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600" /> Settlement Email (Bonus + Commission)</h3>
              <p className="text-xs text-slate-500 mt-1">One combined template per creator. Edit below then Copy.</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">Data Month:</label>
              <select
                value={effectiveEmailMonth}
                onChange={(e) => setEmailMonthFilter(e.target.value)}
                className="appearance-none bg-white border border-slate-300 rounded-lg py-1.5 pl-3 pr-8 text-sm font-medium text-slate-700 shadow-sm cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableBonusCalMonths.map(m => {
                  const [y, mon] = m.split('-');
                  const label = new Date(parseInt(y), parseInt(mon) - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
                  return <option key={m} value={m}>{label}</option>;
                })}
              </select>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
          {emailSettlements.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="text-sm">No settlement data for {dataMonth}</p>
            </div>
          ) : emailSettlements.map((s) => {
            const isProfitable = s.profit >= 0;
            const rewardsPayment = isProfitable ? s.bonusDiff / 2 : s.bonusDiff;
            const commissionPayment = isProfitable ? s.profit / 2 + s.adSpend - s.bonusDiff / 2 : s.commissionEarning;
            const firstName = s.creatorName.split(' ')[0];
            const defaultBody = `Dear ${firstName},

Hope all's well. We've wrapped up the settlement of ${dataMonth} for ${s.creatorName}.

--- Flat Fee Rewards (${rewardsMonthStr}, due ${rewardsDueDate}) ---
Amount payable to Tecdo: ${formatFullCurrency(rewardsPayment)}
(Total Rewards: ${formatFullCurrency(s.totalTierBonus)}, Organic: ${formatFullCurrency(s.organicTierBonus)}, Diff: ${formatFullCurrency(s.bonusDiff)}${isProfitable ? '; 50% to Tecdo' : '; 100% to Tecdo (loss case)'})

--- Commission (${commissionMonthStr}, due ${commissionDueDate}) ---
Amount payable to Tecdo: ${formatFullCurrency(commissionPayment)}
Commission from Ads: ${formatFullCurrency(s.commissionEarning)}
Ad Spend: ${formatFullCurrency(s.adSpend)}
Total Profit: ${formatFullCurrency(s.profit)}${!isProfitable ? '\nNote: Total Profit < 0; Tecdo absorbs Ad Spend loss. Commission paid in full to Tecdo.' : ''}

Total amount due to Tecdo (Rewards + Commission): ${formatFullCurrency(rewardsPayment + commissionPayment)}

Please confirm the above amounts within 3 business days. If we do not hear back, we will proceed with invoicing accordingly.

Best Regards,
Tec-do Billing`;
            return (
              <details key={s.creatorName} className="border border-slate-200 rounded-lg overflow-hidden">
                <summary className="px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isProfitable ? 'bg-green-500' : 'bg-amber-500'}`} />
                    <span className="font-medium text-slate-800">{s.creatorName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isProfitable ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>Profit: {formatCurrency(s.profit)}</span>
                  </div>
                  <span className="text-xs text-slate-500">Click to expand & edit</span>
                </summary>
                <div className="p-4 bg-white border-t border-slate-100">
                  <textarea
                    defaultValue={defaultBody}
                    className="w-full min-h-[280px] p-3 text-xs font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    spellCheck={false}
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={(e) => {
                        const textarea = (e.target as HTMLElement).closest('div')?.previousElementSibling as HTMLTextAreaElement;
                        if (textarea) navigator.clipboard.writeText(textarea.value);
                      }}
                      className="text-xs px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                    >
                      Copy (after editing)
                    </button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </div>
        );
      })()}

      {hasValidData && (
      <details className="bg-amber-50 rounded-xl border border-amber-200 overflow-hidden group">
        <summary className="p-4 cursor-pointer hover:bg-amber-100/50 flex items-center gap-2 text-sm font-semibold text-amber-800">
          <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" /> Click to show calculation logic
        </summary>
        <div className="px-4 pb-4 pt-0 text-xs text-amber-700 space-y-2">
          <div><p className="font-semibold mb-1">Data Sources:</p><p className="ml-2">• Ad Spend: main ad data (filtered by period). Commission: Monthly = Bonus Cal Commission-Ads; Weekly = ad data earning.</p></div>
          <div><p className="font-semibold mb-1">Flat Fee Rewards Diff:</p><p className="ml-2">= Projected Tier Rewards - Organic Tier Rewards (weekly: prorated).</p></div>
          <div><p className="font-semibold mb-1">Formulas:</p><p className="ml-2">• Total Earning = Commission + Flat Fee Rewards Diff. Total Profit = Total Earning - Ad Spend.</p></div>
          <div><p className="font-semibold mb-1">Margin (Tecdo):</p><p className="ml-2">• If Total Profit &gt; 0: 50% × Total Profit. If &lt; 0: Tecdo absorbs all loss.</p></div>
        </div>
      </details>
      )}
    </div>
  );
};
