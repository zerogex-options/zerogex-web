export type Theme = 'light' | 'dark';

export type MarketSession =
  | 'open'
  | 'pre-market'
  | 'after-hours'
  | 'closed'
  | 'halted'
  | 'closed-weekend'
  | 'closed-holiday'
  // Overnight index→future display swap: the cash index is closed but its
  // future is trading, so quote/chart surfaces show the future (badged).
  | 'futures';

export interface LivePrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
}

export interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  subtitleColor?: string;
  trend?: 'bullish' | 'bearish' | 'neutral';
  tooltip: string;
  icon?: React.ReactNode;
  theme?: Theme;
  /**
   * Optional "vs historical" badge rendered under the headline value.
   * Powered by /api/gex/historical-context — see HistoricalContextBadge.
   */
  contextBadge?: React.ReactNode;
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

/**
 * Regime labels emitted by /api/gex/historical-context.
 *
 * Z-score based against the rolling-30-day / all-time distribution.
 * ``unknown`` covers the cold-start case where the stats row is missing
 * or degenerate.  Records are NOT a separate regime — they're carried as
 * boolean ``is_record_high`` / ``is_record_low`` flags on each window, so
 * the badge label keeps the regime word and the frontend stamps a trophy
 * icon on top.  A record-setting value is always promoted to the
 * matching extreme regime by the backend so the badge color and the
 * trophy stay visually consistent.
 */
export type GEXHistoricalRegime =
  | 'extreme_high'
  | 'elevated'
  | 'normal'
  | 'low'
  | 'extreme_low'
  | 'unknown';

export interface GEXHistoricalWindow {
  p05: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p95: number | null;
  mean: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  sample_size: number;
  percentile: number | null;
  z_score: number | null;
  regime: GEXHistoricalRegime;
  /** True when the current value exceeds the stored max for this window. */
  is_record_high: boolean;
  /** True when the current value is below the stored min for this window. */
  is_record_low: boolean;
  /** -1 = flat (no TOD bucketing) fallback; 0..77 = 5-min RTH bucket; null = no row */
  tod_bucket_used: number | null;
}

export interface GEXHistoricalMetric {
  current: number | null;
  windows: Partial<Record<'30d' | 'all_time', GEXHistoricalWindow | null>>;
}

export interface GEXHistoricalContext {
  symbol: string;
  timestamp: string;
  tod_bucket: number | null;
  in_rth: boolean;
  /** ISO timestamp of the earliest gex_summary row for the symbol — the
   * "since YYYY-MM-DD" date cited by the all-time-record trophy tooltip.
   * Null when the symbol has no history yet. */
  tracking_started_at: string | null;
  metrics: Partial<Record<'net_gex_at_spot' | 'total_net_gex', GEXHistoricalMetric>>;
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
  services?: Record<string, unknown>;
}
