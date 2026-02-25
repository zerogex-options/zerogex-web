export type Theme = 'light' | 'dark';

export type MarketSession = 'open' | 'pre-market' | 'after-hours' | 'closed' | 'halted' | 'closed-weekend';

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
