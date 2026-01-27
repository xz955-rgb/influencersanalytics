import { AdData, AdDataRaw, CreatorTierData, TierLevel, CreatorBonusCalData, CreatorSettlement, EarningsSummary } from '../types';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4i27XKB_KySoEcOucrSaMO4wIhn29-mR4P-RXtp9vUyu-UnIazbcW-CAy-Y91COaMD-u--oeekb2D/pub?output=csv';

// Bonus Cal CSV URL - using export format with gid for the specific tab
const BONUS_CAL_CSV_URL = 'https://docs.google.com/spreadsheets/d/1ybVbxN7dporSwYVyFks8p-RgMqmnUTBDaHyAfqLtB70/export?format=csv&gid=1134944905';

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
        currentShippedRevenue: idx.salesUpToDate !== -1 ? parseCurrency(vals[idx.salesUpToDate]) : 0,
        tiers,
      };
    }).filter(d => d.creatorName !== 'Unknown' && d.tiers.length > 0);

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
        totalShippedRevenue: idx.salesUpToDate !== -1 ? parseCurrency(vals[idx.salesUpToDate]) : 0,
        shippedRevOrganic: idx.shippedRevOrganic !== -1 ? parseCurrency(vals[idx.shippedRevOrganic]) : 0,
        shippedRevAds: idx.shippedRevAds !== -1 ? parseCurrency(vals[idx.shippedRevAds]) : 0,
        commissionOrganic: idx.commissionOrganic !== -1 ? parseCurrency(vals[idx.commissionOrganic]) : 0,
        commissionAds: idx.commissionAds !== -1 ? parseCurrency(vals[idx.commissionAds]) : 0,
        tiers,
      };
    }).filter(d => d.creatorName !== 'Unknown' && d.creatorName !== '');

    return creatorData;

  } catch (error) {
    console.error("Error loading creator bonus cal data:", error);
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
// Commission: 
//   - Monthly (starts on 1st): Use Bonus Cal's Commission-Ads (real shipped revenue based)
//   - Weekly/Other: Use ad data's earning column (discounted GMV × creator ratio)
// Bonus Diff = Projected Total Tier Bonus - Organic Tier Bonus (prorated by period)
// Total Earning = Commission + Bonus Diff (prorated)
// Total Profit = Total Earning - Ad Spend
// Margin: If Total Profit > 0: 50% × Total Profit; If < 0: Tecdo absorbs all loss
export const calculateCreatorSettlements = (
  adData: AdData[],
  bonusCalData: CreatorBonusCalData[],
  startDate: Date,
  endDate: Date,
  isMonthlyPeriod: boolean = false // Pass true for "This Month" or "Last Month"
): EarningsSummary => {
  // Filter ad data by date range
  const filteredData = adData.filter(d => {
    const date = new Date(d.date);
    return date >= startDate && date <= endDate;
  });

  // Aggregate spend and earning by creator (from ad data)
  const creatorDataMap = new Map<string, { spend: number; earning: number }>();
  
  filteredData.forEach(item => {
    const existing = creatorDataMap.get(item.creatorName) || { spend: 0, earning: 0 };
    creatorDataMap.set(item.creatorName, {
      spend: existing.spend + item.spend,
      earning: existing.earning + item.earning,
    });
  });

  // Calculate period days and ratio for prorating bonus diff
  const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysInMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
  const periodRatio = periodDays / daysInMonth;
  
  // Use Bonus Cal commission for monthly periods (This Month / Last Month)
  // Otherwise use ad data's earning for weekly/other periods
  const useMonthlyCommission = isMonthlyPeriod;

  // Calculate days remaining in month for projections
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysRemaining = Math.max(1, Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // Calculate settlement for each creator
  const settlements: CreatorSettlement[] = [];
  
  bonusCalData.forEach(bonusCal => {
    const creatorData = creatorDataMap.get(bonusCal.creatorName);
    
    // Use ad spend from filtered ad data
    const adSpend = creatorData?.spend || 0;
    
    // Commission logic:
    // - Monthly (This Month / Last Month): Use Bonus Cal's Commission-Ads (based on shipped revenue)
    // - Weekly/Other: Use ad data's earning (discounted GMV × creator ratio)
    const commissionEarning = useMonthlyCommission 
      ? bonusCal.commissionAds 
      : (creatorData?.earning || 0);
    
    // Skip if no commission and no spend
    if (commissionEarning === 0 && adSpend === 0) return;
    
    // Calculate projected total revenue at month end
    const projectedGmv = calculateProjectedGmv(adData, bonusCal.creatorName, daysRemaining);
    const projectedTotalRevenue = bonusCal.totalShippedRevenue + projectedGmv;
    
    // Calculate bonus diff (monthly):
    // Projected Total Tier Bonus (based on projected month-end revenue) 
    // MINUS Organic Tier Bonus (based on organic-only revenue)
    const projectedTotalTierBonus = calculateTierBonus(projectedTotalRevenue, bonusCal.tiers);
    const organicTierBonus = calculateTierBonus(bonusCal.shippedRevOrganic, bonusCal.tiers);
    const bonusDiffMonthly = projectedTotalTierBonus - organicTierBonus;
    
    // Prorate bonus diff by period ratio (e.g., 7 days / 30 days for a week)
    // For monthly view, use full bonus diff
    const bonusDiffProrated = useMonthlyCommission ? bonusDiffMonthly : bonusDiffMonthly * periodRatio;
    
    // Total Earning = Commission + Bonus Diff (prorated)
    const totalEarning = commissionEarning + bonusDiffProrated;
    
    // Total Profit = Total Earning - Ad Spend
    const totalProfit = totalEarning - adSpend;
    
    // Calculate margin:
    // If Total Profit > 0: Margin = 50% × Total Profit
    // If Total Profit < 0: Margin = Total Profit (Tecdo absorbs all loss)
    const isProfitable = totalProfit > 0;
    const marginTecdo = isProfitable ? 0.5 * totalProfit : totalProfit;
    
    settlements.push({
      creatorName: bonusCal.creatorName,
      adSpend,
      commissionEarning,
      profit: totalProfit, // This is now Total Profit
      bonusDiff: bonusDiffMonthly,
      bonusDiffWeekly: bonusDiffProrated, // Prorated bonus diff for the period
      marginTecdo,
      isProfitable,
      totalTierBonus: projectedTotalTierBonus,
      organicTierBonus,
    });
  });

  // Also add creators who have ad data but no bonus cal data
  creatorDataMap.forEach((data, creatorName) => {
    if (!settlements.find(s => s.creatorName === creatorName)) {
      const totalEarning = data.earning; // No bonus diff for creators without tier data
      const totalProfit = totalEarning - data.spend;
      const isProfitable = totalProfit > 0;
      settlements.push({
        creatorName,
        adSpend: data.spend,
        commissionEarning: data.earning,
        profit: totalProfit,
        bonusDiff: 0,
        bonusDiffWeekly: 0,
        marginTecdo: isProfitable ? 0.5 * totalProfit : totalProfit,
        isProfitable,
        totalTierBonus: 0,
        organicTierBonus: 0,
      });
    }
  });

  // Sort by ad spend descending
  settlements.sort((a, b) => b.adSpend - a.adSpend);

  // Calculate totals
  const totalSpend = settlements.reduce((sum, s) => sum + s.adSpend, 0);
  const totalCommission = settlements.reduce((sum, s) => sum + s.commissionEarning, 0);
  const totalBonusDiffProrated = settlements.reduce((sum, s) => sum + s.bonusDiffWeekly, 0);
  const totalProfit = settlements.reduce((sum, s) => sum + s.profit, 0);
  const totalMarginTecdo = settlements.reduce((sum, s) => sum + s.marginTecdo, 0);

  return {
    totalSpend,
    totalCommission,
    totalProfit,
    totalBonusDiff: totalBonusDiffProrated,
    totalMarginTecdo,
    creatorSettlements: settlements,
  };
};