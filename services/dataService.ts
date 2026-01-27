import { AdData, AdDataRaw, CreatorTierData, TierLevel } from '../types';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4i27XKB_KySoEcOucrSaMO4wIhn29-mR4P-RXtp9vUyu-UnIazbcW-CAy-Y91COaMD-u--oeekb2D/pub?output=csv';

// Bonus Cal CSV URL - using export format with gid for the specific tab
const BONUS_CAL_CSV_URL = 'https://docs.google.com/spreadsheets/d/1ybVbxN7dporSwYVyFks8p-RgMqmnUTBDaHyAfqLtB70/export?format=csv&gid=1134944905';

// Helper to parse CSV line handling quotes
const parseCSVLine = (line: string): string[] => {
  const result = [];
  let startValueIndex = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      let val = line.substring(startValueIndex, i).trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      result.push(val);
      startValueIndex = i + 1;
    }
  }
  let finalVal = line.substring(startValueIndex).trim();
  if (finalVal.startsWith('"') && finalVal.endsWith('"')) {
    finalVal = finalVal.substring(1, finalVal.length - 1);
  }
  result.push(finalVal);
  return result;
};

const parseCurrency = (val: string): number => {
  if (!val) return 0;
  // Remove $ and commas
  const clean = val.replace(/[$,]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

export const fetchData = async (): Promise<AdData[]> => {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    
    // Improved Header Mapping with stricter checks to avoid misidentification
    const idx = {
      date: headers.findIndex(h => h.includes('date') || h.includes('time')),
      creator: headers.findIndex(h => h.includes('creator') || h.includes('influencer')),
      // Fix: Ensure we don't pick up 'creator name' as content name just because it has 'name'
      // Look for 'content', 'post', 'title', or exact 'name' match
      content: headers.findIndex(h => (h.includes('content') || h.includes('post') || h.includes('title') || h === 'name') && !h.includes('creator')),
      platform: headers.findIndex(h => h.includes('platform') || h.includes('source')),
      category: headers.findIndex(h => h.includes('categor')),
      theme: headers.findIndex(h => h.includes('theme') || h.includes('topic')),
      spend: headers.findIndex(h => h.includes('spend') || h.includes('cost') || h.includes('amount')),
      gmv: headers.findIndex(h => h.includes('gmv') || h.includes('sales')),
      earning: headers.findIndex(h => h.includes('earning') || h.includes('commission') || h.includes('revenue') || h.includes('profit')),
      status: headers.findIndex(h => h.includes('status') || h.includes('state') || h.includes('active')),
    };

    const rawData: AdDataRaw[] = lines.slice(1).map(line => {
      const vals = parseCSVLine(line);
      // Parse status - normalize to 'run', 'paused', or 'stopped'
      let status = 'unknown';
      if (idx.status !== -1 && vals[idx.status]) {
        const rawStatus = vals[idx.status].toLowerCase().trim();
        if (rawStatus.includes('run') || rawStatus.includes('active') || rawStatus === 'on') {
          status = 'run';
        } else if (rawStatus.includes('pause')) {
          status = 'paused';
        } else if (rawStatus.includes('stop') || rawStatus.includes('end') || rawStatus === 'off') {
          status = 'stopped';
        } else {
          status = rawStatus || 'unknown';
        }
      }
      
      return {
        date: new Date(vals[idx.date]),
        creatorName: idx.creator !== -1 ? vals[idx.creator] : 'Unknown',
        contentName: idx.content !== -1 ? vals[idx.content] : (idx.creator !== -1 ? `${vals[idx.creator]} Post` : 'Untitled'),
        platform: idx.platform !== -1 ? vals[idx.platform] : 'Other',
        category: idx.category !== -1 ? vals[idx.category] : 'Uncategorized',
        theme: idx.theme !== -1 ? vals[idx.theme] : 'General',
        spend: idx.spend !== -1 ? parseCurrency(vals[idx.spend]) : 0,
        gmv: idx.gmv !== -1 ? parseCurrency(vals[idx.gmv]) : 0,
        earning: idx.earning !== -1 ? parseCurrency(vals[idx.earning]) : 0,
        status,
      };
    }).filter(d => !isNaN(d.date.getTime())); // Filter invalid dates

    // Sort by date for cumulative calc
    rawData.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate ROI and Cumulative Data
    const cumulativeMap = new Map<string, { spend: number; earning: number }>();
    
    const processed: AdData[] = rawData.map((item, index) => {
      // Daily ROI
      const roi = item.spend > 0 ? item.earning / item.spend : 0;

      // Cumulative
      const prev = cumulativeMap.get(item.contentName) || { spend: 0, earning: 0 };
      const newCumSpend = prev.spend + item.spend;
      const newCumEarning = prev.earning + item.earning;
      
      cumulativeMap.set(item.contentName, { spend: newCumSpend, earning: newCumEarning });

      const cumulativeRoi = newCumSpend > 0 ? newCumEarning / newCumSpend : 0;

      return {
        ...item,
        id: `${item.contentName}-${index}`,
        roi,
        cumulativeSpend: newCumSpend,
        cumulativeEarning: newCumEarning,
        cumulativeRoi
      };
    });

    return processed;

  } catch (error) {
    console.error("Error loading data:", error);
    throw error;
  }
};

// Fetch Bonus Cal data for tier tracking
export const fetchBonusCalData = async (): Promise<CreatorTierData[]> => {
  try {
    const response = await fetch(BONUS_CAL_CSV_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch bonus cal data: ${response.statusText}`);
    }
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    
    // Find column indices for Bonus Cal data
    // Expected columns: Creator Name, Sales-up to date, Tier-1 Sales, Tier-1 Bonus, ..., Tier-5 Sales, Tier-5 Bonus
    const idx = {
      creator: headers.findIndex(h => h.includes('creator') || h.includes('name')),
      salesUpToDate: headers.findIndex(h => h.includes('sales') && h.includes('up to date')),
      tier1Sales: headers.findIndex(h => h.includes('tier-1') && h.includes('sales')),
      tier1Bonus: headers.findIndex(h => h.includes('tier-1') && h.includes('bonus')),
      tier2Sales: headers.findIndex(h => h.includes('tier-2') && h.includes('sales')),
      tier2Bonus: headers.findIndex(h => h.includes('tier-2') && h.includes('bonus')),
      tier3Sales: headers.findIndex(h => h.includes('tier-3') && h.includes('sales')),
      tier3Bonus: headers.findIndex(h => h.includes('tier-3') && h.includes('bonus')),
      tier4Sales: headers.findIndex(h => h.includes('tier-4') && h.includes('sales')),
      tier4Bonus: headers.findIndex(h => h.includes('tier-4') && h.includes('bonus')),
      tier5Sales: headers.findIndex(h => h.includes('tier-5') && h.includes('sales')),
      tier5Bonus: headers.findIndex(h => h.includes('tier-5') && h.includes('bonus')),
    };

    const creatorTierData: CreatorTierData[] = lines.slice(1).map(line => {
      const vals = parseCSVLine(line);
      
      const tiers: TierLevel[] = [];
      
      // Parse each tier (up to 5)
      const tierConfigs = [
        { salesIdx: idx.tier1Sales, bonusIdx: idx.tier1Bonus, name: 'Tier 1' },
        { salesIdx: idx.tier2Sales, bonusIdx: idx.tier2Bonus, name: 'Tier 2' },
        { salesIdx: idx.tier3Sales, bonusIdx: idx.tier3Bonus, name: 'Tier 3' },
        { salesIdx: idx.tier4Sales, bonusIdx: idx.tier4Bonus, name: 'Tier 4' },
        { salesIdx: idx.tier5Sales, bonusIdx: idx.tier5Bonus, name: 'Tier 5' },
      ];

      for (const config of tierConfigs) {
        if (config.salesIdx !== -1 && config.bonusIdx !== -1) {
          const threshold = parseCurrency(vals[config.salesIdx]);
          const bonus = parseCurrency(vals[config.bonusIdx]);
          // Only add tier if threshold > 0
          if (threshold > 0) {
            tiers.push({ threshold, bonus, name: config.name });
          }
        }
      }

      return {
        creatorName: idx.creator !== -1 ? vals[idx.creator]?.trim() || 'Unknown' : 'Unknown',
        currentShippedRevenue: idx.salesUpToDate !== -1 ? parseCurrency(vals[idx.salesUpToDate]) : 0,
        tiers,
      };
    }).filter(d => d.creatorName !== 'Unknown' && d.tiers.length > 0);

    return creatorTierData;

  } catch (error) {
    console.error("Error loading bonus cal data:", error);
    // Return empty array instead of throwing to not break the app
    return [];
  }
};