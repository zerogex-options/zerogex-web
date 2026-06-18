/**
 * Shared response/request types for the /backtesting feature. These mirror
 * the finalized `/api/backtest/*` backend contract verbatim. Kept local to
 * the feature (like signal-score's data.ts) rather than in core/types.ts.
 */

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface BacktestPattern {
  id: string;
  name: string;
  tier: string;
  description: string;
}

export interface BacktestDefaults {
  capital: number;
  risk_per_trade_pct: number;
  slippage_pct: number;
  commission_per_contract: number;
  max_concurrent: number;
}

export interface BacktestMeta {
  underlyings: string[];
  patterns: BacktestPattern[];
  data_window: {
    earliest: string;
    latest: string;
    retention_days: number;
  };
  defaults: BacktestDefaults;
}

export interface BacktestSpec {
  underlying: string;
  start_date: string;
  end_date: string;
  patterns: string[];
  fill_model: {
    slippage_pct: number;
    commission_per_contract: number;
  };
  sizing: {
    capital: number;
    risk_per_trade_pct: number;
    max_concurrent: number;
  };
  exit: {
    max_hold_minutes: number | null;
  };
}

export interface BacktestPatternBreakdown {
  pattern: string;
  n: number;
  win_rate: number;
  net_pnl: number;
}

export interface BacktestSummary {
  n_trades: number;
  win_rate: number;
  net_pnl: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  profit_factor: number;
  avg_win_pct: number;
  avg_loss_pct: number;
  avg_hold_minutes: number;
  by_pattern: BacktestPatternBreakdown[];
}

export interface BacktestRun {
  run_id: number;
  status: RunStatus;
  progress: number;
  spec: BacktestSpec;
  summary: BacktestSummary | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface BacktestRunSummary {
  run_id: number;
  status: RunStatus;
  underlying: string;
  start_date: string;
  end_date: string;
  created_at: string;
  summary?: BacktestSummary | null;
}

export interface BacktestTrade {
  seq: number;
  pattern: string;
  direction: string;
  tier: string;
  option_symbol: string;
  option_type: string;
  strike: number;
  expiration: string;
  entered_at: string;
  exited_at: string;
  entry_premium: number;
  exit_premium: number;
  contracts: number;
  net_pnl: number;
  return_pct: number;
  outcome: string;
  hold_minutes: number;
}

export interface BacktestTradesPage {
  trades: BacktestTrade[];
  total: number;
}

export interface BacktestEquityPoint {
  t: string;
  equity: number;
  drawdown_pct: number;
}

export interface BacktestRunCreated {
  run_id: number;
  status: 'queued';
}
