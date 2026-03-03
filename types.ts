export interface AdDataRaw {
  date: Date;
  creatorName: string;
  contentName: string;
  platform: string;
  category: string;
  theme: string;
  spend: number;
  gmv: number;
  earning: number;
  status: string; // 'run', 'paused', 'stopped', or 'unknown'
  postUrl?: string;   // FB/IG post link
  amazonUrl?: string; // Amazon landing page link
}

export interface AdData extends AdDataRaw {
  id: string; // Unique ID for keying
  roi: number;
  cumulativeSpend: number;
  cumulativeEarning: number;
  cumulativeRoi: number;
}

export interface FilterState {
  startDate: string;
  endDate: string;
  creators: string[];
  platforms: string[];
  categories: string[];
  themes: string[];
}

export interface KpiData {
  totalSpend: number;
  totalGmv: number;
  totalEarning: number;
  overallRoi: number;
}

// Tier Rewards Types
export interface TierLevel {
  threshold: number;  // Sales threshold to reach this tier
  bonus: number;      // Bonus amount for this tier
  name: string;       // e.g., "Tier 1", "Tier 2"
}

export interface CreatorTierData {
  creatorName: string;
  dataMonth: string;              // Month of data in "YYYY-MM" format (e.g., "2026-01")
  currentShippedRevenue: number;  // Sales-up to date
  tiers: TierLevel[];             // Up to 5 tiers per creator
}

// Post-level efficiency metrics
export interface PostEfficiency {
  contentName: string;
  totalSpend: number;
  totalGmv: number;
  totalEarning: number;
  roas: number;                   // GMV / Spend
  roi: number;                    // Earning / Spend
  daysWithData: number;           // Number of days this post has data
  isNewPost: boolean;             // True if < 3 days of data
  avgDailyGmv: number;            // Average GMV per day
}

export interface RushAnalysis {
  estimatedExtraSpend: number;
  netGain: number;                // Extra bonus - extra loss
  recommendation: 'rush' | 'consider' | 'skip';
  avgRoas: number;                // Weighted average ROAS across posts
  avgRoi: number;                 // Weighted average ROI across posts
  posts: PostEfficiency[];        // Per-post breakdown
}

export interface TierProgress {
  creatorName: string;
  currentRevenue: number;
  currentTier: TierLevel | null;
  currentBonus: number;
  nextTier: TierLevel | null;
  gapToNextTier: number;
  daysRemaining: number;
  dailyGmvNeeded: number;
  rushAnalysis: RushAnalysis | null;
}

// Extended Creator Tier Data with organic/ads breakdown
export interface CreatorBonusCalData {
  creatorName: string;
  dataMonth: string;              // Month of data in "YYYY-MM" format (e.g., "2026-01")
  totalShippedRevenue: number;    // Sales (up to date)
  shippedRevOrganic: number;      // Shipped Rev.-Organic
  shippedRevAds: number;          // Shipped Rev.-Ads
  commissionOrganic: number;      // Commission-Organic
  commissionAds: number;          // Commission-Ads
  tiers: TierLevel[];             // Tier thresholds and bonuses
}

// Settlement data for a single creator
export interface CreatorSettlement {
  creatorName: string;
  adSpend: number;                // Total ad spend for period
  commissionEarning: number;      // Total commission earning for period
  profit: number;                 // Commission - Spend
  bonusDiff: number;              // Total tier bonus - Organic tier bonus
  bonusDiffWeekly: number;        // Estimated weekly bonus diff
  marginTecdo: number;            // 50% × (Profit + Bonus Diff) if profit > 0, else 50% × Bonus Diff
  isProfitable: boolean;          // profit > 0
  totalTierBonus: number;         // Bonus based on total shipped revenue
  organicTierBonus: number;       // Bonus based on organic shipped revenue
}

// Overall earnings summary
export interface EarningsSummary {
  totalSpend: number;
  totalCommission: number;
  totalProfit: number;
  totalBonusDiff: number;
  totalMarginTecdo: number;
  creatorSettlements: CreatorSettlement[];
}

// Time range preset
export type TimeRangePreset = 
  | 'this_week' 
  | 'last_week' 
  | 'this_month' 
  | 'last_month' 
  | 'this_quarter'
  | 'custom';
