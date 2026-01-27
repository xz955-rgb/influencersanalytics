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
