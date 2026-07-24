// Regression tests for the /backtesting Featured Strategies surface.
//
// The page (frontend/app/backtesting/page.tsx) keeps a small hand-curated list
// of strategies with measured edge on the realized-P&L calibration backtest,
// and turns one into a hydrated FormState on click. These tests pin the math
// and the spec mapping so a careless edit can't silently break "click featured
// → see this exact form."
//
// The helpers under test live in a 'use client' Next page that can't be
// imported into the node test runner, so they're replicated inline (mirroring
// smartMoneyFilters.test.ts).

import test from 'node:test';
import assert from 'node:assert/strict';

// ── Replicated helpers (keep in sync with page.tsx) ─────────────────────────

interface BacktestMeta {
  underlyings: string[];
  data_window: { earliest: string; latest: string };
  defaults: {
    capital: number;
    risk_per_trade_pct: number;
    slippage_pct: number;
    commission_per_contract: number;
    max_concurrent: number;
    width?: number;
    wing?: number;
  };
  strategy_fields: Array<{ field: string; ops: string[] }>;
}

interface FeaturedStrategy {
  id: string;
  name: string;
  blurb: string;
  evidence: string;
  underlying: string;
  patterns: string[];
  lookbackDays: number;
}

function subtractDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function blankCondition(meta: BacktestMeta) {
  const first = meta.strategy_fields[0];
  return { field: first?.field ?? '', op: first?.ops[0] ?? '', value: '' };
}

function buildInitialForm(meta: BacktestMeta) {
  const d = meta.defaults;
  return {
    mode: 'patterns' as const,
    underlying: meta.underlyings[0] ?? '',
    start_date: meta.data_window.earliest,
    end_date: meta.data_window.latest,
    patterns: [] as string[],
    direction: 'bullish' as const,
    conditions: [blankCondition(meta)],
    structure: 'single' as const,
    width: String(meta.defaults.width ?? 5),
    wing: String(meta.defaults.wing ?? 5),
    dte: '0',
    target_offset_pct: '',
    stop_offset_pct: '',
    capital: d.capital,
    risk_per_trade_pct: d.risk_per_trade_pct,
    slippage_pct: d.slippage_pct,
    commission_per_contract: d.commission_per_contract,
    max_concurrent: d.max_concurrent,
    max_net_delta: '',
    max_net_vega: '',
    max_hold_minutes: '',
    profit_target_pct: '',
    stop_loss_pct: '',
  };
}

function featuredToForm(s: FeaturedStrategy, meta: BacktestMeta) {
  const base = buildInitialForm(meta);
  const end = meta.data_window.latest;
  const wantStart = subtractDaysISO(end, s.lookbackDays);
  const start = wantStart < meta.data_window.earliest ? meta.data_window.earliest : wantStart;
  return {
    ...base,
    mode: 'patterns' as const,
    underlying: meta.underlyings.includes(s.underlying) ? s.underlying : base.underlying,
    patterns: s.patterns.slice(),
    start_date: start,
    end_date: end,
  };
}

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeMeta(overrides: Partial<BacktestMeta> = {}): BacktestMeta {
  return {
    underlyings: ['SPY', 'SPX', 'QQQ', 'NDX'],
    data_window: { earliest: '2026-03-20', latest: '2026-06-18' },
    defaults: {
      capital: 25000,
      risk_per_trade_pct: 2.0,
      slippage_pct: 0.01,
      commission_per_contract: 0.65,
      max_concurrent: 3,
      width: 5,
      wing: 5,
    },
    strategy_fields: [{ field: 'net_gex_sign', ops: ['='] }],
    ...overrides,
  };
}

const FEATURED_QQQ: FeaturedStrategy = {
  id: 'gex-gradient-trend-qqq',
  name: 'GEX Gradient Trend · QQQ',
  blurb: 'Long ATM calls/puts on QQQ when the gamma-gradient drift fires.',
  evidence: '64% win, PF 2.80…',
  underlying: 'QQQ',
  patterns: ['gex_gradient_trend'],
  lookbackDays: 60,
};

// ── subtractDaysISO ─────────────────────────────────────────────────────────

test('subtractDaysISO subtracts a positive day count', () => {
  assert.equal(subtractDaysISO('2026-06-18', 60), '2026-04-19');
});

test('subtractDaysISO crosses a month boundary', () => {
  assert.equal(subtractDaysISO('2026-03-01', 1), '2026-02-28');
});

test('subtractDaysISO crosses a year boundary', () => {
  assert.equal(subtractDaysISO('2026-01-05', 10), '2025-12-26');
});

test('subtractDaysISO is DST-stable (UTC arithmetic)', () => {
  // US "spring forward" is 2026-03-08 — local-zone Date math can lose a day
  // here; UTC-based subtractDaysISO must not.
  assert.equal(subtractDaysISO('2026-03-15', 7), '2026-03-08');
  assert.equal(subtractDaysISO('2026-11-08', 7), '2026-11-01');  // fall back
});

// ── featuredToForm ─────────────────────────────────────────────────────────

test('featuredToForm hydrates the form with the strategy', () => {
  const form = featuredToForm(FEATURED_QQQ, makeMeta());
  assert.equal(form.mode, 'patterns');
  assert.equal(form.underlying, 'QQQ');
  assert.deepEqual(form.patterns, ['gex_gradient_trend']);
  assert.equal(form.end_date, '2026-06-18');           // data_window.latest
  assert.equal(form.start_date, '2026-04-19');         // latest − 60d
});

test('featuredToForm clamps start_date to data_window.earliest', () => {
  // A 600-day lookback on a 90-day window must not produce a start_date
  // outside the archive — the API would 409.
  const form = featuredToForm({ ...FEATURED_QQQ, lookbackDays: 600 }, makeMeta());
  assert.equal(form.start_date, '2026-03-20');          // pinned to earliest
  assert.equal(form.end_date, '2026-06-18');
});

test('featuredToForm falls back when the strategy underlying is unavailable', () => {
  // A featured entry pointing at an underlying the deployment doesn't expose
  // (e.g. only SPY enabled) must fall back to the first available one rather
  // than emit an invalid spec.
  const form = featuredToForm(FEATURED_QQQ, makeMeta({ underlyings: ['SPY'] }));
  assert.equal(form.underlying, 'SPY');
});

test('featuredToForm starts from meta defaults', () => {
  // Anything the strategy doesn't override must come from buildInitialForm —
  // so a default capital change in meta flows through automatically.
  const form = featuredToForm(FEATURED_QQQ, makeMeta({
    defaults: {
      capital: 50000,
      risk_per_trade_pct: 1.5,
      slippage_pct: 0.005,
      commission_per_contract: 0.5,
      max_concurrent: 5,
    },
  }));
  assert.equal(form.capital, 50000);
  assert.equal(form.risk_per_trade_pct, 1.5);
  assert.equal(form.max_concurrent, 5);
});

test('featuredToForm patterns array is a copy, not the original reference', () => {
  // Defensive: mutating form.patterns must NOT mutate the FeaturedStrategy
  // entry's array (which is module-level and could be shared across loads).
  const form = featuredToForm(FEATURED_QQQ, makeMeta());
  form.patterns.push('mutation');
  assert.deepEqual(FEATURED_QQQ.patterns, ['gex_gradient_trend']);
});
