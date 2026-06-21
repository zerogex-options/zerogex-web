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
  width?: number;
}

/**
 * A condition-builder field surfaced by the backend for the custom-strategy
 * mode. `numeric` fields take a number value and may carry a `unit` ('%', '$',
 * or ''); `categorical` fields take one of `values`.
 */
export interface BacktestStrategyField {
  field: string;
  label: string;
  type: 'numeric' | 'categorical';
  ops: string[];
  unit?: string;
  values?: string[];
}

export interface BacktestStrategyStructure {
  id: 'single' | 'vertical';
  label: string;
}

export interface BacktestMeta {
  underlyings: string[];
  patterns: BacktestPattern[];
  strategy_structures?: BacktestStrategyStructure[];
  data_window: {
    earliest: string;
    latest: string;
    retention_days: number;
  };
  defaults: BacktestDefaults;
  strategy_fields: BacktestStrategyField[];
}

/**
 * A single custom-strategy condition. `value` is a number for numeric fields
 * and a string for categorical fields, matching the field's declared type.
 */
export interface BacktestCondition {
  field: string;
  op: string;
  value: number | string;
}

export interface BacktestSpec {
  underlying: string;
  start_date: string;
  end_date: string;
  // Omitted when a `strategy` block is supplied (strategy replaces patterns).
  patterns?: string[];
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
    // Phase-2 option-premium exit overlay; null ⇒ off.
    profit_target_pct?: number | null;
    stop_loss_pct?: number | null;
  };
  /**
   * Custom-strategy block. When present it REPLACES `patterns`. Level offsets
   * are FRACTIONS of the entry underlying price (0.003 = 0.3%); null ⇒ off.
   */
  strategy?: {
    direction: 'bullish' | 'bearish';
    conditions: BacktestCondition[];
    entry: { dte: number };
    structure?: 'single' | 'vertical';
    width?: number;
    target_offset_pct: number | null;
    stop_offset_pct: number | null;
  };
}

export interface BacktestPatternBreakdown {
  pattern: string;
  n: number;
  win_rate: number;
  net_pnl: number;
}

/**
 * Funnel diagnostics emitted by the engine so a low/zero-trade run is
 * explainable: how many cards were loaded, survived the pattern filter and
 * cooldown, got priced, and where the rest were dropped.
 */
export interface BacktestDiagnostics {
  cards_total: number;
  cards_in_scope: number;
  cards_after_cooldown: number;
  priced_candidates: number;
  drops: Record<string, number>;
  concurrency_skipped: number;
  sized_out: number;
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
  diagnostics?: BacktestDiagnostics;
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
  structure?: string;
  legs?: {
    option_symbol: string;
    right: string;
    side: string;
    strike: number | null;
    expiration: string | null;
    qty: number;
  }[];
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
