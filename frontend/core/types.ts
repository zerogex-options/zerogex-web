export type Theme = 'light' | 'dark';

export type MarketSession = 
  | 'open' 
  | 'pre-market' 
  | 'after-hours' 
  | 'closed' 
  | 'halted' 
  | 'closed-weekend'
  | 'closed-holiday';

export interface LivePrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
}

export interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'bullish' | 'bearish' | 'neutral';
  tooltip: string;
  icon?: React.ReactNode;
  theme: Theme;
}

export interface GEXStrikeData {
  strike: number;
  gex: number;
  type: 'support' | 'resistance' | 'neutral';
}

// API Response Types

export interface GEXSummary {
  timestamp: string;
  net_gex: number;
  total_call_gex: number;
  total_put_gex: number;
  put_call_ratio: number;
  gamma_flip?: number;
  max_pain?: number;
  call_wall?: number;
  put_wall?: number;
}

export interface GEXByStrike {
  strike: number;
  net_gex: number;
  call_gex: number;
  put_gex: number;
  total_oi: number;
  gex_level?: string;
}

export interface OptionFlow {
  time_window_end: string;
  option_type: string;
  strike?: number;
  total_volume: number;
  total_premium: number;
  avg_iv?: number;
  size_class?: string;
  unusual_activity_score?: number;
}

export interface UnderlyingQuote {
  timestamp: string;
  symbol: string;
  close: number;
  volume: number;
  open?: number;
  high?: number;
  low?: number;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  services?: Record<string, any>;
}
