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
  wing?: number;
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

export type StrategyStructureId = 'single' | 'vertical' | 'straddle' | 'strangle' | 'condor';

export interface BacktestStrategyStructure {
  id: StrategyStructureId;
  label: string;
  kind?: 'directional' | 'neutral';
}

/**
 * A parameter the sweep can vary (Phase 6). `scope` 'strategy' means it only
 * applies to a custom-strategy base spec. `as_fraction` marks axes whose spec
 * value is a fraction (0.5) — the UI accepts a percent and divides by 100.
 */
export interface BacktestSweepParam {
  param: string;
  label: string;
  unit: string;
  scope: 'any' | 'strategy';
  as_fraction?: boolean;
}

export interface BacktestMeta {
  underlyings: string[];
  patterns: BacktestPattern[];
  strategy_structures?: BacktestStrategyStructure[];
  sweep_params?: BacktestSweepParam[];
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
    // Greeks-aware caps (Phase 5b); null ⇒ off.
    max_net_delta?: number | null;
    max_net_vega?: number | null;
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
    direction: 'bullish' | 'bearish' | 'neutral';
    conditions: BacktestCondition[];
    entry: { dte: number };
    structure?: StrategyStructureId;
    width?: number;
    wing?: number;
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

/** Per-regime slice of the results (gamma sign or MSI regime). */
export interface BacktestRegimeBreakdown {
  regime: string;
  n: number;
  win_rate: number | null;
  net_pnl: number;
  expectancy: number | null;
  avg_return_pct: number | null;
}

/** A p5/p50/p95 point of the Monte Carlo equity cone, at trade index `i`. */
export interface BacktestConePoint {
  i: number;
  p5: number;
  p50: number;
  p95: number;
}

/**
 * Bootstrap Monte Carlo over the realized trade sequence: the range of
 * outcomes, not a single equity line. `null` when there are too few trades.
 */
export interface BacktestMonteCarlo {
  iterations: number;
  terminal_return_pct: { p5: number; p50: number; p95: number };
  max_drawdown_pct: { p50: number; p95: number };
  prob_profit: number;
  prob_drawdown_gt_20pct: number;
  risk_of_ruin_50pct: number;
  cone: BacktestConePoint[];
}

/** Buy-and-hold return of the underlying over the same window. */
export interface BacktestBenchmark {
  underlying: string;
  buy_hold_return_pct: number;
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

  // Risk-adjusted tearsheet (nullable when undefined for the sample).
  sharpe?: number | null;
  sortino?: number | null;
  calmar?: number | null;
  cagr_pct?: number | null;
  annual_volatility_pct?: number | null;
  expectancy?: number | null;
  expectancy_pct?: number | null;
  expectancy_tstat?: number | null;
  avg_win?: number | null;
  avg_loss?: number | null;
  payoff_ratio?: number | null;
  largest_win?: number | null;
  largest_loss?: number | null;
  max_consecutive_wins?: number;
  max_consecutive_losses?: number;
  exposure_pct?: number | null;
  total_commission?: number;
  trading_days?: number;
  daily_equity?: { d: string; equity: number }[];

  // Distribution, regime cuts, and the honest yardstick.
  monte_carlo?: BacktestMonteCarlo | null;
  by_regime?: { gamma: BacktestRegimeBreakdown[]; msi: BacktestRegimeBreakdown[] };
  benchmark?: BacktestBenchmark | null;
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
  net_delta?: number;
  net_vega?: number;
  gamma_regime?: string | null;
  msi_regime?: string | null;
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

/**
 * Saved & shareable configuration (Phase 6). A named, validated `BacktestSpec`
 * the user can reload into the form or hand to someone else via `share_token`.
 */
export interface BacktestConfigSummary {
  id: number;
  name: string;
  underlying: string;
  share_token: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BacktestConfig extends BacktestConfigSummary {
  spec: BacktestSpec;
}

/** Public, read-only view returned when loading a shared config by token. */
export interface BacktestSharedConfig {
  name: string;
  underlying: string;
  spec: BacktestSpec;
}

// ---- Parameter sweeps (Phase 6) ------------------------------------------

/** One swept axis: a parameter and the list of values to try. */
export interface BacktestSweepAxis {
  param: string;
  values: number[];
}

/** The metrics surfaced per grid cell (a slim view of a run summary). */
export interface BacktestSweepCellMetrics {
  n_trades: number;
  win_rate: number;
  net_pnl: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  profit_factor: number;
}

export interface BacktestSweepCell {
  run_id: number;
  cell: Record<string, number>;
  status: RunStatus;
  metrics: BacktestSweepCellMetrics | null;
  progress: number;
}

export interface BacktestSweep {
  sweep_id: number;
  underlying: string;
  axes: BacktestSweepAxis[];
  n_cells: number;
  created_at: string | null;
  cells: BacktestSweepCell[];
  completed: number;
  status: 'running' | 'completed';
}

export interface BacktestSweepCreated {
  sweep_id: number;
  n_cells: number;
  run_ids: number[];
}

// ---- Pattern insights (the leaderboard) ----------------------------------
//
// One row per (pattern, underlying) pair from the latest calibration window,
// served by GET /api/backtest/insights/patterns. Includes the raw counts +
// win rate from playbook_pattern_stats, plus dollar economics (gross
// win/loss) and the derived PF / expectancy / avg win/loss so the page can
// render straight from the payload without recomputing anything.
//
// Touch-source rows carry NULL for every economics field (the touch harness
// is a proxy and has no real P&L).
export type InsightsSource = 'option_pnl' | 'underlying_touch';

export interface PatternInsight {
  pattern: string;
  underlying: string;
  window_start: string | null;
  window_end: string | null;
  n_emitted: number;
  n_resolved: number;
  n_wins: number;
  n_losses: number;
  hit_rate: number | null;
  proposed_base: number | null;
  gross_win_pnl: number | null;
  gross_loss_pnl: number | null;
  net_pnl: number | null;
  /** Sum of winning trade P&L over abs sum of losers. null when no losses (undefined). */
  profit_factor: number | null;
  /** Net P&L per resolved trade. null when n_resolved is 0. */
  expectancy: number | null;
  avg_win_pnl: number | null;
  avg_loss_pnl: number | null;
  source: InsightsSource;
  computed_at: string | null;
}
