import React, { useState } from 'react';
import { FilterState } from '../types';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';

interface FiltersProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  uniqueOptions: {
    creators: string[];
    platforms: string[];
    categories: string[];
    themes: string[];
  };
  className?: string;
}

export const Filters: React.FC<FiltersProps> = ({ filters, setFilters, uniqueOptions, className }) => {
  const handleMultiSelect = (key: keyof FilterState, value: string) => {
    setFilters(prev => {
      const current = prev[key] as string[];
      if (current.includes(value)) {
        return { ...prev, [key]: current.filter(v => v !== value) };
      }
      return { ...prev, [key]: [...current, value] };
    });
  };

  const clearFilters = () => {
    setFilters(prev => ({
      ...prev,
      creators: [],
      platforms: [],
      categories: [],
      themes: []
    }));
  };

  const Section = ({ title, options, selectedKey }: { title: string, options: string[], selectedKey: keyof FilterState }) => (
    <div className="mb-6">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const isSelected = (filters[selectedKey] as string[]).includes(opt);
          return (
            <button
              key={opt}
              onClick={() => handleMultiSelect(selectedKey, opt)}
              className={`px-3 py-1 text-xs rounded-full border transition-all ${
                isSelected 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Themes Section with Grouping
  const ThemesSection: React.FC<{ themes: string[], filters: FilterState, setFilters: React.Dispatch<React.SetStateAction<FilterState>> }> = ({ themes, filters, setFilters }) => {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    
    // Group themes - updated groupings
    const holidayThemes = ['New Year', 'Valentine', 'Xmas']; // Removed Winter
    const seasonThemes = ['Winter']; // New Season category
    const homeThemes = ['Kitchen', 'Bedroom', 'Bathroom']; // Removed Home (use All instead)
    const beautyThemes = ['Beauty']; // New Beauty category
    
    // Filter out grouped themes and Apparel from Other
    const excludedFromOther = [...holidayThemes, ...seasonThemes, ...homeThemes, ...beautyThemes, 'Home', 'Apparel'];
    const otherThemes = themes.filter(t => !excludedFromOther.includes(t));
    
    const toggleGroup = (group: string) => {
      setExpandedGroups(prev => {
        const next = new Set(prev);
        if (next.has(group)) {
          next.delete(group);
        } else {
          next.add(group);
        }
        return next;
      });
    };
    
    const handleThemeSelect = (theme: string) => {
      handleMultiSelect('themes', theme);
    };

    // Select all themes in a group
    const handleSelectAllInGroup = (groupThemes: string[]) => {
      const availableThemes = groupThemes.filter(t => themes.includes(t));
      const allSelected = availableThemes.every(t => (filters.themes as string[]).includes(t));
      
      if (allSelected) {
        // Deselect all
        setFilters(prev => ({
          ...prev,
          themes: (prev.themes as string[]).filter(t => !availableThemes.includes(t))
        }));
      } else {
        // Select all
        setFilters(prev => ({
          ...prev,
          themes: [...new Set([...(prev.themes as string[]), ...availableThemes])]
        }));
      }
    };
    
    const GroupItem = ({ groupName, groupThemes }: { groupName: string, groupThemes: string[] }) => {
      const isExpanded = expandedGroups.has(groupName);
      const availableThemes = groupThemes.filter(t => themes.includes(t));
      const hasSelected = availableThemes.some(t => (filters.themes as string[]).includes(t));
      const allSelected = availableThemes.length > 0 && availableThemes.every(t => (filters.themes as string[]).includes(t));
      
      if (availableThemes.length === 0) return null;
      
      return (
        <div className="mb-2">
          <button
            onClick={() => toggleGroup(groupName)}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-md border transition-all ${
              hasSelected 
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="font-medium">{groupName}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {isExpanded && (
            <div className="mt-1.5 ml-2 flex flex-wrap gap-1.5">
              {/* All option */}
              <button
                onClick={() => handleSelectAllInGroup(groupThemes)}
                className={`px-2 py-1 text-[10px] rounded-full border transition-all ${
                  allSelected 
                    ? 'bg-indigo-600 text-white border-indigo-600' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                }`}
              >
                All
              </button>
              {availableThemes.map(theme => {
                const isSelected = (filters.themes as string[]).includes(theme);
                return (
                  <button
                    key={theme}
                    onClick={() => handleThemeSelect(theme)}
                    className={`px-2 py-1 text-[10px] rounded-full border transition-all ${
                      isSelected 
                        ? 'bg-indigo-600 text-white border-indigo-600' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {theme}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    };
    
    return (
      <div className="mb-6">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Themes</h4>
        <div className="space-y-1">
          <GroupItem groupName="Holiday" groupThemes={holidayThemes} />
          <GroupItem groupName="Season" groupThemes={seasonThemes} />
          <GroupItem groupName="Home" groupThemes={homeThemes} />
          <GroupItem groupName="Beauty" groupThemes={beautyThemes} />
          {otherThemes.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] font-medium text-slate-500 mb-1.5">Other</div>
              <div className="flex flex-wrap gap-1.5">
                {otherThemes.map(theme => {
                  const isSelected = (filters.themes as string[]).includes(theme);
                  return (
                    <button
                      key={theme}
                      onClick={() => handleThemeSelect(theme)}
                      className={`px-2 py-1 text-[10px] rounded-full border transition-all ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {theme}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white border-r border-slate-200 h-full overflow-y-auto p-4 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-800">Filters</h2>
        </div>
        <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <X className="w-3 h-3" /> Clear
        </button>
      </div>

      <div className="mb-6">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date Range</h4>
        
        {/* Quick Date Selection Dropdown */}
        <div className="mb-3 relative">
          <select
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'custom') return;
              
              const today = new Date();
              let start: Date, end: Date;
              
              switch(value) {
                case 'today':
                  start = end = new Date(today);
                  break;
                case 'yesterday':
                  start = end = new Date(today);
                  start.setDate(start.getDate() - 1);
                  end.setDate(end.getDate() - 1);
                  break;
                case 'last7':
                  end = new Date(today);
                  start = new Date(today);
                  start.setDate(start.getDate() - 6);
                  break;
                case 'last30':
                  end = new Date(today);
                  start = new Date(today);
                  start.setDate(start.getDate() - 29);
                  break;
                case 'thisWeek':
                  end = new Date(today);
                  start = new Date(today);
                  start.setDate(start.getDate() - start.getDay());
                  break;
                case 'lastWeek':
                  end = new Date(today);
                  end.setDate(end.getDate() - end.getDay() - 1);
                  start = new Date(end);
                  start.setDate(start.getDate() - 6);
                  break;
                case 'thisMonth':
                  end = new Date(today);
                  start = new Date(end.getFullYear(), end.getMonth(), 1);
                  break;
                case 'lastMonth':
                  end = new Date(today);
                  start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
                  end = new Date(end.getFullYear(), end.getMonth(), 0);
                  break;
                default:
                  return;
              }
              
              setFilters(prev => ({
                ...prev,
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
              }));
            }}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
            defaultValue=""
          >
            <option value="">Select Quick Range...</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="thisWeek">This Week</option>
            <option value="lastWeek">Last Week</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="custom">Custom Range...</option>
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        
        {/* Custom Date Range */}
        <div className="space-y-2">
            <input 
                type="date" 
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({...prev, startDate: e.target.value}))}
                className="w-full text-sm border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            <input 
                type="date" 
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({...prev, endDate: e.target.value}))}
                className="w-full text-sm border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
        </div>
      </div>

      <Section title="Platforms" options={uniqueOptions.platforms} selectedKey="platforms" />
      <Section title="Creators" options={uniqueOptions.creators} selectedKey="creators" />
      <Section title="Categories" options={uniqueOptions.categories} selectedKey="categories" />
      
      {/* Themes with Grouping */}
      <ThemesSection 
        themes={uniqueOptions.themes} 
        filters={filters} 
        setFilters={setFilters}
      />
    </div>
  );
};