// Tests for the /backtesting/insights view helpers: the filter + sort
// pipeline (applyInsightsView) and the three cell formatters.
//
// Imports the view module directly — it is a plain .ts utility module with
// no React or 'use client' boundary, so the node test runner can pick it up.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyInsightsView,
  formatPercent,
  formatPnl,
  formatProfitFactor,
  makeComparator,
} from '../app/backtesting/insights/view.ts';
import type { PatternInsight } from '../app/backtesting/types.ts';

// ── Fixtures ────────────────────────────────────────────────────────────────

function row(o: Partial<PatternInsight> = {}): PatternInsight {
  return {
    pattern: 'p',
    underlying: 'SPY',
    window_start: '2026-04-01',
    window_end: '2026-06-01',
    n_emitted: 30,
    n_resolved: 30,
    n_wins: 15,
    n_losses: 15,
    hit_rate: 0.5,
    proposed_base: 0.5,
    gross_win_pnl: 300,
    gross_loss_pnl: 150,
    net_pnl: 150,
    profit_factor: 2.0,
    expectancy: 5,
    avg_win_pnl: 20,
    avg_loss_pnl: 10,
    source: 'option_pnl',
    computed_at: '2026-06-01T00:00:00.000Z',
    ...o,
  };
}

// ── applyInsightsView ───────────────────────────────────────────────────────

test('trustworthy filter drops rows below the threshold', () => {
  const rows = [
    row({ pattern: 'a', n_resolved: 60 }),
    row({ pattern: 'b', n_resolved: 39 }),
    row({ pattern: 'c', n_resolved: 40 }),
  ];
  const out = applyInsightsView(rows, {
    trustworthyOnly: true, trustworthyMinN: 40, sortKey: 'pattern', sortDir: 'asc',
  });
  assert.deepEqual(out.map((r) => r.pattern), ['a', 'c']);
});

test('trustworthy=false keeps every row regardless of N', () => {
  const rows = [row({ pattern: 'a', n_resolved: 5 }), row({ pattern: 'b', n_resolved: 100 })];
  const out = applyInsightsView(rows, {
    trustworthyOnly: false, trustworthyMinN: 40, sortKey: 'pattern', sortDir: 'asc',
  });
  assert.equal(out.length, 2);
});

test('sort by net_pnl descending puts the biggest winner first', () => {
  const rows = [
    row({ pattern: 'small_winner', net_pnl: 50 }),
    row({ pattern: 'big_winner', net_pnl: 500 }),
    row({ pattern: 'loser', net_pnl: -200 }),
  ];
  const out = applyInsightsView(rows, {
    trustworthyOnly: false, trustworthyMinN: 40, sortKey: 'net_pnl', sortDir: 'desc',
  });
  assert.deepEqual(out.map((r) => r.pattern), ['big_winner', 'small_winner', 'loser']);
});

test('null values always sink to the bottom regardless of sort direction', () => {
  // Critical UX invariant: a pattern with PF=null shouldn't out-rank one with
  // PF=0.5 just because the user clicked "ascending."
  const rows = [
    row({ pattern: 'no_pf', profit_factor: null }),
    row({ pattern: 'tiny_pf', profit_factor: 0.1 }),
    row({ pattern: 'big_pf', profit_factor: 3.0 }),
  ];
  const asc = applyInsightsView(rows, {
    trustworthyOnly: false, trustworthyMinN: 40, sortKey: 'profit_factor', sortDir: 'asc',
  });
  assert.deepEqual(asc.map((r) => r.pattern), ['tiny_pf', 'big_pf', 'no_pf']);
  const desc = applyInsightsView(rows, {
    trustworthyOnly: false, trustworthyMinN: 40, sortKey: 'profit_factor', sortDir: 'desc',
  });
  assert.deepEqual(desc.map((r) => r.pattern), ['big_pf', 'tiny_pf', 'no_pf']);
});

test('sort by pattern is alphabetic', () => {
  const rows = [
    row({ pattern: 'beta' }), row({ pattern: 'alpha' }), row({ pattern: 'gamma' }),
  ];
  const out = applyInsightsView(rows, {
    trustworthyOnly: false, trustworthyMinN: 40, sortKey: 'pattern', sortDir: 'asc',
  });
  assert.deepEqual(out.map((r) => r.pattern), ['alpha', 'beta', 'gamma']);
});

test('sort is stable on ties', () => {
  const rows = [
    row({ pattern: 'a', net_pnl: 100 }),
    row({ pattern: 'b', net_pnl: 100 }),  // tied
    row({ pattern: 'c', net_pnl: 100 }),  // tied
  ];
  const out = applyInsightsView(rows, {
    trustworthyOnly: false, trustworthyMinN: 40, sortKey: 'net_pnl', sortDir: 'desc',
  });
  assert.deepEqual(out.map((r) => r.pattern), ['a', 'b', 'c']);
});

test('applyInsightsView returns a new array (input is not mutated)', () => {
  const rows = [row({ pattern: 'b' }), row({ pattern: 'a' })];
  const out = applyInsightsView(rows, {
    trustworthyOnly: false, trustworthyMinN: 40, sortKey: 'pattern', sortDir: 'asc',
  });
  assert.notStrictEqual(out, rows);
  assert.deepEqual(rows.map((r) => r.pattern), ['b', 'a']);  // input untouched
});

test('makeComparator handles equal values by returning 0', () => {
  const cmp = makeComparator('net_pnl', 'desc');
  assert.equal(cmp(row({ net_pnl: 50 }), row({ net_pnl: 50 })), 0);
});

// ── Formatters ──────────────────────────────────────────────────────────────

test('formatPnl shows whole-dollar with thousands separators', () => {
  assert.equal(formatPnl(1234), '$1,234');
  assert.equal(formatPnl(2411), '$2,411');
  assert.equal(formatPnl(-1500), '-$1,500');
  assert.equal(formatPnl(0), '$0');
});

test('formatPnl em-dashes null / NaN / Infinity', () => {
  assert.equal(formatPnl(null), '—');
  assert.equal(formatPnl(undefined), '—');
  assert.equal(formatPnl(NaN), '—');
  assert.equal(formatPnl(Infinity), '—');
});

test('formatPercent rounds to whole percent', () => {
  assert.equal(formatPercent(0.64), '64%');
  assert.equal(formatPercent(0.405), '41%');  // banker's rounding handled by Math.round
  assert.equal(formatPercent(0), '0%');
  assert.equal(formatPercent(1), '100%');
});

test('formatPercent em-dashes null', () => {
  assert.equal(formatPercent(null), '—');
  assert.equal(formatPercent(undefined), '—');
});

test('formatProfitFactor shows two decimals', () => {
  assert.equal(formatProfitFactor(2.8), '2.80');
  assert.equal(formatProfitFactor(0.95), '0.95');
  assert.equal(formatProfitFactor(0), '0.00');
});

test('formatProfitFactor em-dashes null (PF undefined when no losses)', () => {
  assert.equal(formatProfitFactor(null), '—');
  assert.equal(formatProfitFactor(Infinity), '—');
});
