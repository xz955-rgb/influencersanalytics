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
