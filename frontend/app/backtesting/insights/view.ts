/**
 * Pure view-logic helpers for the /backtesting/insights page.
 *
 * Split out from page.tsx so a node test can exercise them without
 * dragging in the 'use client' React tree. The page is presentation; this
 * module owns the sort comparator + the cell formatters.
 */

import type { PatternInsight } from '../types';

/** Columns the user can sort by — a subset of PatternInsight numeric fields. */
export type InsightsSortKey =
  | 'pattern'
  | 'underlying'
  | 'n_resolved'
  | 'hit_rate'
  | 'profit_factor'
  | 'expectancy'
  | 'net_pnl'
  | 'avg_win_pnl'
  | 'avg_loss_pnl';

export interface InsightsViewOptions {
  trustworthyOnly: boolean;
  trustworthyMinN: number;
  sortKey: InsightsSortKey;
  sortDir: 'asc' | 'desc';
}

/**
 * Apply the trustworthy filter then sort. Stable: rows that tie on the
 * sort key keep their relative order from the input.
 *
 * Nulls always fall to the END of the result regardless of sortDir — a
 * column that's "missing data" should never out-sort a measured value (a
 * pattern with PF = null shouldn't beat one with PF = 0.5 just because the
 * user clicked "ascending").
 */
export function applyInsightsView(
  rows: PatternInsight[],
  opts: InsightsViewOptions,
): PatternInsight[] {
  const { trustworthyOnly, trustworthyMinN, sortKey, sortDir } = opts;
  const filtered = trustworthyOnly
    ? rows.filter((r) => r.n_resolved >= trustworthyMinN)
    : rows.slice();

  const cmp = makeComparator(sortKey, sortDir);
  // Decorate-sort-undecorate for stability across sort backends.
  return filtered
    .map((row, idx) => ({ row, idx }))
    .sort((a, b) => {
      const primary = cmp(a.row, b.row);
      return primary !== 0 ? primary : a.idx - b.idx;
    })
    .map((x) => x.row);
}

export function makeComparator(
  key: InsightsSortKey,
  dir: 'asc' | 'desc',
): (a: PatternInsight, b: PatternInsight) => number {
  const factor = dir === 'desc' ? -1 : 1;
  if (key === 'pattern' || key === 'underlying') {
    return (a, b) => factor * a[key].localeCompare(b[key]);
  }
  return (a, b) => {
    const av = a[key] as number | null;
    const bv = b[key] as number | null;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;       // null always goes after a real value
    if (bv == null) return -1;
    if (av === bv) return 0;
    return factor * (av < bv ? -1 : 1);
  };
}

// ── Cell formatters ────────────────────────────────────────────────────────

/** Format a $ value with thousands separators; null/undefined → em dash. */
export function formatPnl(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  // Round to whole dollars so the table stays compact; sub-dollar precision
  // adds noise without changing the story.
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

/** Format a fraction [0, 1] as a 0-decimal percent; null → em dash. */
export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

/** Format a profit factor with 2 decimals; null → em dash; "∞" never appears
 *  because the API encodes "PF undefined" as null. */
export function formatProfitFactor(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}

/**
 * Convert a pattern slug to a human-readable label using the catalog map
 * from /api/backtest/meta. Falls back to a Title-Case transform of the slug
 * if the map hasn't loaded yet — so the table never shows a raw
 * "eod_pressure_drift" id even on the first paint.
 *
 * The catalog map should be id → name (e.g. {"eod_pressure_drift": "EOD
 * Pressure Drift"}). Pass an empty map to force the fallback (used in
 * tests).
 */
export function formatPatternLabel(id: string, catalog: Record<string, string>): string {
  const fromCatalog = catalog[id];
  if (fromCatalog && fromCatalog.trim() !== '') return fromCatalog;
  // Slug fallback: split on underscores, upper-case known acronyms, Title
  // Case everything else.
  const ACRONYMS = new Set(['eod', 'gex', 'pnl', 'iv', 'mfe', 'mae', 'atm', 'oi']);
  return id
    .split('_')
    .map((part) =>
      ACRONYMS.has(part.toLowerCase())
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(' ');
}
