/**
 * Client-side types for the TradeWorkz™ dashboard. Kept in a shared file so
 * the top-level client and drill-down panel agree on the wire shape.
 */

export interface FleetSummary {
  fleet_capital_starting: number;
  fleet_capital_current: number;
  fleet_capital_peak: number;
  fleet_return_pct: number | null;
  live_positions: number;
  unrealized_pnl: number;
  realized_pnl_today: number;
  trades_today: number;
  wins_today: number;
  n_bots: number;
  best_bot_id: string | null;
  best_bot_pnl: number | null;
  worst_bot_id: string | null;
  worst_bot_pnl: number | null;
  fleet_capital_config: number;
}

export interface BotRow {
  id: string;
  display_name: string;
  strategy_class: string;
  tier: string;
  direction_mode: string;
  universe: string;
  tagline: string | null;
  description: string | null;
  enabled: boolean;
  is_public: boolean;
  starting_capital: number;
  current_capital: number;
  peak_capital: number;
  lifetime_trades: number;
  lifetime_wins: number;
  lifetime_pnl: number;
  lifetime_return_pct: number | null;
  lifetime_win_rate: number | null;
  live_positions: number;
  live_unrealized_pnl: number;
  pnl_1d: number;
  pnl_7d: number;
  pnl_30d: number;
  pnl_365d: number;
  hit_rate: number | null;
  confidence_base: number | null;
  confidence_threshold: number | null;
  size_multiplier: number | null;
  recent_win_rate_30d: number | null;
  recent_profit_factor: number | null;
}

export interface BotListResponse {
  bots: BotRow[];
}

export interface LeaderboardEntry {
  rank: number;
  bot_id: string;
  display_name: string;
  tier: string;
  tagline: string | null;
  trades: number;
  wins: number;
  win_rate: number | null;
  pnl: number;
  avg_pnl_pct: number;
  starting_capital: number;
  current_capital: number;
  return_pct: number | null;
}

export interface LeaderboardResponse {
  period: string;
  leaderboard: LeaderboardEntry[];
}

export interface EquityCurvePoint {
  session_date: string;
  starting_nav: number;
  ending_nav: number;
  realized_pnl: number;
  unrealized_pnl: number;
  heat_pct: number;
  n_trades: number;
}

export interface EquityCurveResponse {
  bot_id: string;
  points: EquityCurvePoint[];
}

export interface BotTrade {
  id: number;
  underlying: string;
  opened_at: string;
  closed_at: string;
  direction: string;
  strategy_type: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  realized_pnl: number;
  pnl_percent: number;
  outcome: 'win' | 'loss' | 'scratch';
  close_reason: string;
  entry_conviction: number | null;
}

export interface BotTradesResponse {
  bot_id: string;
  trades: BotTrade[];
}

export interface BotDetailResponse {
  id: string;
  display_name: string;
  strategy_class: string;
  tier: string;
  direction_mode: string;
  universe: string;
  tagline: string | null;
  description: string | null;
  enabled: boolean;
  is_public: boolean;
  params: Record<string, unknown>;
  capital: {
    starting: number;
    current: number;
    peak: number;
    max_heat_pct: number | null;
    kelly_fraction: number | null;
    daily_kill_pct: number | null;
  };
  ml_state: Record<string, unknown> | null;
  open_positions: Array<Record<string, unknown>>;
}

export type PeriodKey = '1d' | '7d' | '30d' | '365d' | 'all';

export const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: '1d', label: 'Today' },
  { key: '7d', label: 'This Week' },
  { key: '30d', label: 'This Month' },
  { key: '365d', label: 'This Year' },
  { key: 'all', label: 'Lifetime' },
];
