import { AdData, AdDataRaw, CreatorTierData, TierLevel, CreatorBonusCalData, CreatorSettlement, EarningsSummary, MonthlyEarningRow } from '../types';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4i27XKB_KySoEcOucrSaMO4wIhn29-mR4P-RXtp9vUyu-UnIazbcW-CAy-Y91COaMD-u--oeekb2D/pub?output=csv';

// Bonus Cal CSV URL - using export format with gid for the specific tab
const BONUS_CAL_CSV_URL = 'https://docs.google.com/spreadsheets/d/1ybVbxN7dporSwYVyFks8p-RgMqmnUTBDaHyAfqLtB70/export?format=csv&gid=1134944905';

// Monthly Earning Cal CSV URL - actual historical commission and bonus data
const MONTHLY_EARNING_CAL_CSV_URL = 'https://docs.google.com/spreadsheets/d/1ybVbxN7dporSwYVyFks8p-RgMqmnUTBDaHyAfqLtB70/export?format=csv&gid=1636678788';

// Posts tab CSV URL for post links (columns E=post URL, F=amazon URL)
const POSTS_TAB_CSV_URL = 'https://docs.google.com/spreadsheets/d/1ybVbxN7dporSwYVyFks8p-RgMqmnUTBDaHyAfqLtB70/export?format=csv&gid=1203420941';

// Post links mapping type
export interface PostLinks {
  postUrl?: string;
  amazonUrl?: string;
}

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

// Theme category mapping: { normalizedName: [possible raw values] }
const THEME_CATEGORIES: Record<string, Record<string, string[]>> = {
  'Holiday': {
    'Valentine': ['valentine', 'valentines', "valentine's"],
    'Christmas': ['xmas', 'christmas'],
    'New Year': ['new year', 'newyear'],
    'Black Friday': ['black friday', 'blackfriday'],
    'Halloween': ['halloween'],
    'Super Bowl': ['superbowl', 'super bowl'],
  },
  'Seasonal': {
    'Spring': ['spring'],
    'Summer': ['summer'],
    'Fall': ['fall', 'autumn'],
    'Winter': ['winter'],
  },
  'Home': {
    'General': ['home'],
    'Bedroom': ['bedroom'],
    'Kitchen': ['kitchen'],
    'Bathroom': ['bathroom'],
  },
  'Fashion': {
    'Apparel': ['apparel', 'clothing'],
    'General': ['fashion'],
    'Accessories': ['accessories'],
    'Beauty': ['makeup', 'beauty'],
  },
  'Other': {
    'Pet': ['pet', 'pets'],
    'Travel': ['vacation', 'travel'],
    'Gift': ['gift', 'gifts'],
    'General': [], // Fallback for empty or unknown themes
  },
};

// Normalize theme into standardized categories (format: "Category/Subcategory")
const normalizeTheme = (rawTheme: string): string => {
  if (!rawTheme || rawTheme.toLowerCase() === 'theme') return 'Other/General';
  
  const theme = rawTheme.toLowerCase().trim();
  
  // Search through all categories and subcategories
  for (const [category, subcategories] of Object.entries(THEME_CATEGORIES)) {
    for (const [subcategory, keywords] of Object.entries(subcategories)) {
      if (keywords.includes(theme)) {
        return `${category}/${subcategory}`;
      }
    }
  }
  
  // If no match found, put in Other with the original name capitalized
  return `Other/${rawTheme.charAt(0).toUpperCase() + rawTheme.slice(1)}`;
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
      postUrl: headers.findIndex(h => h.includes('post url') || h.includes('post link') || h.includes('ig link') || h.includes('fb link') || h.includes('social link')),
      amazonUrl: headers.findIndex(h => h.includes('amazon') || h.includes('landing') || h.includes('product link') || h.includes('asin')),
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
      
      // Parse and normalize theme into categories
      const rawTheme = idx.theme !== -1 ? (vals[idx.theme] || '').trim() : '';
      const normalizedTheme = normalizeTheme(rawTheme);
      
      return {
        date: new Date(vals[idx.date]),
        creatorName: idx.creator !== -1 ? vals[idx.creator] : 'Unknown',
        contentName: idx.content !== -1 ? vals[idx.content] : (idx.creator !== -1 ? `${vals[idx.creator]} Post` : 'Untitled'),
        platform: idx.platform !== -1 ? vals[idx.platform] : 'Other',
        category: idx.category !== -1 ? vals[idx.category] : 'Uncategorized',
        theme: normalizedTheme,
        spend: idx.spend !== -1 ? parseCurrency(vals[idx.spend]) : 0,
        gmv: idx.gmv !== -1 ? parseCurrency(vals[idx.gmv]) : 0,
        earning: idx.earning !== -1 ? parseCurrency(vals[idx.earning]) : 0,
        status,
        postUrl: idx.postUrl !== -1 ? vals[idx.postUrl]?.trim() || undefined : undefined,
        amazonUrl: idx.amazonUrl !== -1 ? vals[idx.amazonUrl]?.trim() || undefined : undefined,
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

// Normalize content name for matching: lowercase, remove spaces
// e.g., "IG Reel 4/vanity" -> "igreel4/vanity", "IgReel4/Vanity" -> "igreel4/vanity"
export const normalizeContentName = (name: string): string => {
  return name.toLowerCase().replace(/\s+/g, '');
};

// Fetch post links from posts tab
// Key format: "creatorName|normalizedContentName" to handle duplicate contentNames across creators
export const fetchPostLinks = async (): Promise<Map<string, PostLinks>> => {
  try {
    const response = await fetch(POSTS_TAB_CSV_URL);
    if (!response.ok) {
      console.warn('Could not fetch post links');
      return new Map();
    }
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 2) return new Map();

    // Column structure from posts tab:
    // A (0): Creator
    // B (1): ContentName (compact, no spaces - use this for matching)
    // C (2): Content Name (display name)
    // D (3): Tracking Id
    // E (4): URL (post URL - Instagram/Facebook)
    // F (5): Landing Page (Amazon URL)
    
    const linkMap = new Map<string, PostLinks>();
    
    lines.slice(1).forEach(line => {
      const vals = parseCSVLine(line);
      
      const creatorName = vals[0]?.trim() || '';
      // Use column B (index 1) as the content name key
      const contentNameCompact = vals[1]?.trim() || '';
      // Also get column C (index 2) as alternative key
      const contentNameDisplay = vals[2]?.trim() || '';
      
      if (!creatorName || (!contentNameCompact && !contentNameDisplay)) return;
      
      const postUrl = vals[4]?.trim() || undefined;
      const amazonUrl = vals[5]?.trim() || undefined;
      
      // Normalize URLs - ensure they have https:// prefix
      const normalizeUrl = (url: string | undefined): string | undefined => {
        if (!url) return undefined;
        const trimmed = url.trim();
        if (!trimmed) return undefined;
        // Add https:// if URL starts with domain directly (missing protocol)
        if (trimmed.startsWith('facebook.com') || trimmed.startsWith('www.facebook.com')) {
          return `https://www.${trimmed.replace(/^www\./, '')}`;
        }
        if (trimmed.startsWith('instagram.com') || trimmed.startsWith('www.instagram.com')) {
          return `https://www.${trimmed.replace(/^www\./, '')}`;
        }
        if (trimmed.startsWith('amazon.com') || trimmed.startsWith('www.amazon.com')) {
          return `https://www.${trimmed.replace(/^www\./, '')}`;
        }
        return trimmed;
      };
      
      const normalizedPostUrl = normalizeUrl(postUrl);
      const normalizedAmazonUrl = normalizeUrl(amazonUrl);
      
      if (normalizedPostUrl || normalizedAmazonUrl) {
        const links = { postUrl: normalizedPostUrl, amazonUrl: normalizedAmazonUrl };
        
        // Store with normalized keys for fuzzy matching
        // e.g., "Ashley Thomas|igreel4/vanity" matches both "IgReel4/Vanity" and "IG Reel 4/vanity"
        if (contentNameCompact) {
          linkMap.set(`${creatorName}|${normalizeContentName(contentNameCompact)}`, links);
        }
        if (contentNameDisplay) {
          linkMap.set(`${creatorName}|${normalizeContentName(contentNameDisplay)}`, links);
        }
      }
    });
    
    return linkMap;
  } catch (error) {
    console.warn('Error fetching post links:', error);
    return new Map();
  }
};

// Parse date string like "2026/1/31" to "YYYY-MM" format
// Moved before fetchBonusCalData so it can be used by both functions
const parseBonusCalDate = (dateStr: string): string => {
  if (!dateStr) return '';
  // Handle formats: "2026/1/31", "2026-1-31", "1/31/2026"
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length < 2) return '';
  
  let year: number, month: number;
  if (parts[0].length === 4) {
    // Format: 2026/1/31 or 2026-1-31
    year = parseInt(parts[0]);
    month = parseInt(parts[1]);
  } else {
    // Format: 1/31/2026
    month = parseInt(parts[0]);
    year = parseInt(parts[2]);
  }
  
  if (isNaN(year) || isNaN(month)) return '';
  return `${year}-${String(month).padStart(2, '0')}`;
};

// Fetch Bonus Cal data for tier tracking (used by TierRewardsTracker)
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
    const idx = {
      date: headers.findIndex(h => h === 'date' || h.includes('date')),
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
      
      // Parse date to get dataMonth
      const dataMonth = idx.date !== -1 ? parseBonusCalDate(vals[idx.date]) : '';
      
      const tiers: TierLevel[] = [];
      
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
          if (threshold > 0) {
            tiers.push({ threshold, bonus, name: config.name });
          }
        }
      }

      return {
        creatorName: idx.creator !== -1 ? vals[idx.creator]?.trim() || 'Unknown' : 'Unknown',
        dataMonth,
        currentShippedRevenue: idx.salesUpToDate !== -1 ? parseCurrency(vals[idx.salesUpToDate]) : 0,
        tiers,
      };
    }).filter(d => d.creatorName !== 'Unknown' && d.tiers.length > 0 && d.dataMonth !== '');

    return creatorTierData;

  } catch (error) {
    console.error("Error loading bonus cal data:", error);
    return [];
  }
};

// Fetch extended Bonus Cal data with organic/ads breakdown for earnings calculation
export const fetchCreatorBonusCalData = async (): Promise<CreatorBonusCalData[]> => {
  try {
    const response = await fetch(BONUS_CAL_CSV_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch bonus cal data: ${response.statusText}`);
    }
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    
    // Find column indices - based on Bonus Cal structure
    // A: Date, B: Creator, C: Sales (up to date), D: Shipped Rev.-Organic, E: Shipped Rev.-Ads
    // F: Commission-Organic, G: Commission-Ads, H-V: Tier info
    const idx = {
      date: headers.findIndex(h => h === 'date' || h.includes('date')),
      creator: headers.findIndex(h => h.includes('creator') || (h.includes('name') && !h.includes('content'))),
      salesUpToDate: headers.findIndex(h => h.includes('sales') && h.includes('up to date')),
      shippedRevOrganic: headers.findIndex(h => h.includes('shipped') && h.includes('organic')),
      shippedRevAds: headers.findIndex(h => h.includes('shipped') && h.includes('ads')),
      commissionOrganic: headers.findIndex(h => h.includes('commission') && h.includes('organic')),
      commissionAds: headers.findIndex(h => h.includes('commission') && h.includes('ads')),
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

    const creatorData: CreatorBonusCalData[] = lines.slice(1).map(line => {
      const vals = parseCSVLine(line);
      
      // Parse date to get dataMonth
      const dataMonth = idx.date !== -1 ? parseBonusCalDate(vals[idx.date]) : '';
      
      const tiers: TierLevel[] = [];
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
          if (threshold > 0) {
            tiers.push({ threshold, bonus, name: config.name });
          }
        }
      }

      return {
        creatorName: idx.creator !== -1 ? vals[idx.creator]?.trim() || 'Unknown' : 'Unknown',
        dataMonth,
        totalShippedRevenue: idx.salesUpToDate !== -1 ? parseCurrency(vals[idx.salesUpToDate]) : 0,
        shippedRevOrganic: idx.shippedRevOrganic !== -1 ? parseCurrency(vals[idx.shippedRevOrganic]) : 0,
        shippedRevAds: idx.shippedRevAds !== -1 ? parseCurrency(vals[idx.shippedRevAds]) : 0,
        commissionOrganic: idx.commissionOrganic !== -1 ? parseCurrency(vals[idx.commissionOrganic]) : 0,
        commissionAds: idx.commissionAds !== -1 ? parseCurrency(vals[idx.commissionAds]) : 0,
        tiers,
      };
    }).filter(d => d.creatorName !== 'Unknown' && d.creatorName !== '' && d.dataMonth !== '');

    return creatorData;

  } catch (error) {
    console.error("Error loading creator bonus cal data:", error);
    return [];
  }
};

// Fetch Monthly Earning Cal data — actual commission and bonus for past months
export const fetchMonthlyEarningCalData = async (): Promise<MonthlyEarningRow[]> => {
  try {
    const response = await fetch(MONTHLY_EARNING_CAL_CSV_URL);
    if (!response.ok) {
      console.warn('Could not fetch monthly earning cal data');
      return [];
    }
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);

    const monthNameToNum: Record<string, string> = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
      'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };

    // Detect month columns: "Jan-Commission", "Jan-Bonus", "Feb-Commission", etc.
    const monthCols: { month: string; commIdx: number; bonusIdx: number }[] = [];
    const colMap = new Map<string, { commIdx: number; bonusIdx: number }>();

    headers.forEach((h, i) => {
      const lower = h.toLowerCase().trim();
      const match = lower.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[-\s]*(commission|bonus)/);
      if (!match) return;
      const monthNum = monthNameToNum[match[1]];
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const mInt = parseInt(monthNum);
      const year = mInt > currentMonth ? now.getFullYear() - 1 : now.getFullYear();
      const key = `${year}-${monthNum}`;

      if (!colMap.has(key)) colMap.set(key, { commIdx: -1, bonusIdx: -1 });
      const entry = colMap.get(key)!;
      if (match[2] === 'commission') entry.commIdx = i;
      else if (match[2] === 'bonus') entry.bonusIdx = i;
    });

    colMap.forEach((v, k) => {
      if (v.commIdx !== -1 || v.bonusIdx !== -1) monthCols.push({ month: k, ...v });
    });

    // Margin Share is in column B (index 1)
    const marginShareIdx = 1;
    const rows: MonthlyEarningRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      const creatorName = vals[0]?.trim();
      if (!creatorName) continue;

      const marginRaw = vals[marginShareIdx]?.replace('%', '').trim();
      const marginShare = marginRaw ? parseFloat(marginRaw) / 100 : 0;
      if (isNaN(marginShare) || marginShare <= 0) continue;

      for (const mc of monthCols) {
        const commission = mc.commIdx !== -1 ? parseCurrency(vals[mc.commIdx]) : 0;
        const bonus = mc.bonusIdx !== -1 ? parseCurrency(vals[mc.bonusIdx]) : 0;
        // Skip rows where both are 0 or "/" (parseCurrency returns 0 for "/")
        if (commission === 0 && bonus === 0) continue;
        rows.push({ creatorName, marginShare, month: mc.month, commission, bonus, adSpend: 0 });
      }
    }

    return rows;
  } catch (error) {
    console.warn('Error fetching monthly earning cal data:', error);
    return [];
  }
};

// Calculate the tier bonus for a given revenue amount
export const calculateTierBonus = (revenue: number, tiers: TierLevel[]): number => {
  if (!tiers || tiers.length === 0) return 0;
  
  // Sort tiers by threshold descending to find highest achieved tier
  const sortedTiers = [...tiers].sort((a, b) => b.threshold - a.threshold);
  
  for (const tier of sortedTiers) {
    if (revenue >= tier.threshold) {
      return tier.bonus;
    }
  }
  
  return 0; // Revenue doesn't reach any tier
};

// Calculate projected GMV for a creator based on recent performance
const calculateProjectedGmv = (
  adData: AdData[],
  creatorName: string,
  daysRemaining: number
): number => {
  // Get last 3 days of data for this creator
  const creatorData = adData.filter(d => d.creatorName === creatorName);
  if (creatorData.length === 0) return 0;
  
  const allDates = creatorData.map(d => d.date.getTime());
  const latestDate = Math.max(...allDates);
  const threeDaysAgo = latestDate - (3 * 24 * 60 * 60 * 1000);
  
  // Aggregate GMV by post for last 3 days
  const postGmvData = new Map<string, { gmv: number; days: Set<string> }>();
  
  creatorData.forEach(d => {
    if (d.date.getTime() < threeDaysAgo) return;
    
    if (!postGmvData.has(d.contentName)) {
      postGmvData.set(d.contentName, { gmv: 0, days: new Set() });
    }
    const post = postGmvData.get(d.contentName)!;
    post.gmv += d.gmv;
    post.days.add(d.date.toISOString().split('T')[0]);
  });
  
  // Calculate projected GMV: sum of (avgDailyGmv × daysRemaining) for each post
  let totalProjectedGmv = 0;
  postGmvData.forEach(data => {
    const daysWithData = data.days.size;
    if (daysWithData > 0) {
      const avgDailyGmv = data.gmv / daysWithData;
      totalProjectedGmv += avgDailyGmv * daysRemaining;
    }
  });
  
  return totalProjectedGmv;
};

// Calculate earnings settlement for each creator
// For past months with Monthly Earning Cal data: Commission & Bonus from actual data, Ad Spend from Ads Data
// For current/latest month: Commission from Bonus Cal (monthly) or Ad Data (weekly), Bonus estimated from tier diff
// Margin: marginShare × profit if profit > 0, else absorbs all loss
export const calculateCreatorSettlements = (
  adData: AdData[],
  bonusCalData: CreatorBonusCalData[],
  startDate: Date,
  endDate: Date,
  isMonthlyPeriod: boolean = false,
  monthlyEarningData: MonthlyEarningRow[] = []
): EarningsSummary => {
  // Normalize to full-day boundaries
  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  // Filter ad data by date range — ad spend always comes from here
  const filteredData = adData.filter(d => {
    const date = new Date(d.date);
    if (isMonthlyPeriod) {
      return (
        date.getFullYear() === startDate.getFullYear() &&
        date.getMonth() === startDate.getMonth()
      );
    }
    return date >= rangeStart && date <= rangeEnd;
  });

  // Aggregate spend and earning by creator (from ad data)
  const creatorAdMap = new Map<string, { spend: number; earning: number }>();
  filteredData.forEach(item => {
    const existing = creatorAdMap.get(item.creatorName) || { spend: 0, earning: 0 };
    creatorAdMap.set(item.creatorName, {
      spend: existing.spend + item.spend,
      earning: existing.earning + item.earning,
    });
  });

  // Check for actual monthly earning data for this period
  const periodMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
  const actualMonthData = monthlyEarningData.filter(d => d.month === periodMonth);
  const hasActualMonthData = isMonthlyPeriod && actualMonthData.length > 0;

  // Build lookup maps
  const actualDataMap = new Map<string, MonthlyEarningRow>();
  actualMonthData.forEach(d => actualDataMap.set(d.creatorName, d));

  // Collect latest marginShare per creator across all months
  const marginShareMap = new Map<string, number>();
  monthlyEarningData.forEach(d => {
    if (d.marginShare > 0) marginShareMap.set(d.creatorName, d.marginShare);
  });

  const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysInMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
  const periodRatio = periodDays / daysInMonth;

  const bonusCalMap = new Map<string, CreatorBonusCalData>();
  bonusCalData.forEach(bc => bonusCalMap.set(bc.creatorName, bc));

  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysRemaining = Math.max(1, Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const settlements: CreatorSettlement[] = [];

  // Collect all creator names from both ad data and actual monthly data
  const allCreators = new Set<string>();
  creatorAdMap.forEach((_, name) => allCreators.add(name));
  if (hasActualMonthData) {
    actualMonthData.forEach(d => allCreators.add(d.creatorName));
  }

  allCreators.forEach(creatorName => {
    const adInfo = creatorAdMap.get(creatorName) || { spend: 0, earning: 0 };
    const bonusCal = bonusCalMap.get(creatorName);
    const actualRow = hasActualMonthData ? actualDataMap.get(creatorName) : undefined;
    const mShare = marginShareMap.get(creatorName) ?? 0.5;

    const adSpend = adInfo.spend;
    let commissionEarning: number;
    let bonusAmount: number;
    let isActual = false;
    let projectedTotalTierBonus = 0;
    let organicTierBonus = 0;

    if (actualRow) {
      // ---- ACTUAL DATA path: past month with Monthly Earning Cal data ----
      commissionEarning = actualRow.commission;
      bonusAmount = actualRow.bonus;
      isActual = true;
      // Still compute tier breakdown for display (informational)
      if (bonusCal && bonusCal.tiers.length > 0) {
        projectedTotalTierBonus = calculateTierBonus(bonusCal.totalShippedRevenue, bonusCal.tiers);
        organicTierBonus = calculateTierBonus(bonusCal.shippedRevOrganic, bonusCal.tiers);
      }
    } else {
      // ---- ESTIMATED path: current month or no actual data ----
      commissionEarning = isMonthlyPeriod && bonusCal
        ? bonusCal.commissionAds
        : adInfo.earning;

      let bonusDiffMonthly = 0;
      if (bonusCal && bonusCal.tiers.length > 0) {
        // Use current Sales (up to date) directly — no projection
        projectedTotalTierBonus = calculateTierBonus(bonusCal.totalShippedRevenue, bonusCal.tiers);
        organicTierBonus = calculateTierBonus(bonusCal.shippedRevOrganic, bonusCal.tiers);
        bonusDiffMonthly = projectedTotalTierBonus - organicTierBonus;
      }
      bonusAmount = isMonthlyPeriod ? bonusDiffMonthly : bonusDiffMonthly * periodRatio;
    }

    if (commissionEarning === 0 && bonusAmount === 0 && adSpend === 0) return;

    const totalEarning = commissionEarning + bonusAmount;
    const totalProfit = totalEarning - adSpend;
    const isProfitable = totalProfit > 0;
    const marginTecdo = isProfitable ? mShare * totalProfit : totalProfit;

    settlements.push({
      creatorName,
      adSpend,
      commissionEarning,
      profit: totalProfit,
      bonusDiff: bonusAmount,
      bonusDiffWeekly: bonusAmount,
      marginTecdo,
      isProfitable,
      totalTierBonus: projectedTotalTierBonus,
      organicTierBonus,
      marginShare: mShare,
      isActualData: isActual,
    });
  });

  settlements.sort((a, b) => b.adSpend - a.adSpend);

  const totalSpend = settlements.reduce((sum, s) => sum + s.adSpend, 0);
  const totalCommission = settlements.reduce((sum, s) => sum + s.commissionEarning, 0);
  const totalBonusDiff = settlements.reduce((sum, s) => sum + s.bonusDiffWeekly, 0);
  const totalProfit = settlements.reduce((sum, s) => sum + s.profit, 0);
  const totalMarginTecdo = settlements.reduce((sum, s) => sum + s.marginTecdo, 0);

  return {
    totalSpend,
    totalCommission,
    totalProfit,
    totalBonusDiff,
    totalMarginTecdo,
    creatorSettlements: settlements,
  };
};