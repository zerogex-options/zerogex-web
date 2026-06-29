'use client';

/**
 * /backtesting/insights — Pattern Leaderboard
 *
 * A transparent, read-only view of how each playbook pattern has performed
 * on the standardized realized-P&L calibration backtest. One row per
 * (pattern, underlying) pair; the latest persisted window. Subscribers can
 * sort by any column and toggle a "trustworthy sample" filter (n ≥ 40).
 *
 * This page intentionally shows EVERY pattern, not just the winners — a
 * losing pattern's −$1,400 expectancy is useful information ("don't take
 * this card in QQQ even if the engine fires it"), and showing only winners
 * would create cherry-picked-looking marketing.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowDown, ArrowUp, Info, RefreshCw } from 'lucide-react';
import BetaBadge from '@/components/BetaBadge';
import TooltipWrapper from '@/components/TooltipWrapper';
import { backtestAPI } from '@/core/api/endpoints';
import type { InsightsSource, PatternInsight } from '../types';
import {
  applyInsightsView,
  formatPnl,
  formatPercent,
  formatProfitFactor,
  type InsightsSortKey,
} from './view';

const TRUSTWORTHY_MIN_N = 40;

const SOURCE_OPTIONS: { value: InsightsSource; label: string; tooltip: string }[] = [
  {
    value: 'option_pnl',
    label: 'Realized P&L',
    tooltip:
      "Standardized single-leg backtest at the card's own target/stop, with " +
      "real option fills, slippage, and commission. The honest measure.",
  },
  {
    value: 'underlying_touch',
    label: 'Underlying touch',
    tooltip:
      "The conservative proxy: did the underlying reach the target/stop? " +
      "Ignores premium decay and bid/ask. Useful as a sanity check; not " +
      "ground truth.",
  },
];

interface HeaderSpec {
  key: InsightsSortKey;
  label: string;
  align?: 'left' | 'right';
  tooltip?: string;
}

const HEADERS: HeaderSpec[] = [
  { key: 'pattern', label: 'Pattern', align: 'left' },
  { key: 'underlying', label: 'Undl.', align: 'left' },
  {
    key: 'n_resolved',
    label: 'N',
    align: 'right',
    tooltip: 'Resolved trades in this calibration window.',
  },
  {
    key: 'hit_rate',
    label: 'Win %',
    align: 'right',
    tooltip: 'Realized win rate (net_pnl > 0).',
  },
  {
    key: 'profit_factor',
    label: 'PF',
    align: 'right',
    tooltip:
      'Profit factor = sum of winners ÷ absolute sum of losers. > 1.0 means the wins outpace the losses.',
  },
  {
    key: 'expectancy',
    label: 'Avg / trade',
    align: 'right',
    tooltip: 'Expectancy: net P&L per resolved trade, net of slippage and commission.',
  },
  {
    key: 'net_pnl',
    label: 'Net P&L',
    align: 'right',
    tooltip: 'Sum of net_pnl across every trade in the window.',
  },
  {
    key: 'avg_win_pnl',
    label: 'Avg win',
    align: 'right',
  },
  {
    key: 'avg_loss_pnl',
    label: 'Avg loss',
    align: 'right',
  },
];

export default function InsightsPage() {
  const [source, setSource] = useState<InsightsSource>('option_pnl');
  const [underlying, setUnderlying] = useState<string>('');   // '' = all
  const [trustworthyOnly, setTrustworthyOnly] = useState(true);
  const [sortKey, setSortKey] = useState<InsightsSortKey>('net_pnl');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Fetch state: rows = null AND error = null means "loading." A manual
  // refresh nulls rows synchronously (outside the effect) to force that
  // state; the effect itself only mutates state inside the promise
  // callbacks, which satisfies react-hooks/set-state-in-effect.
  const [rows, setRows] = useState<PatternInsight[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = rows === null && error === null;

  useEffect(() => {
    let cancelled = false;
    backtestAPI
      .getPatternInsights(source, underlying || undefined)
      .then((r) => {
        if (cancelled) return;
        setRows(r);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load insights.');
        setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [source, underlying]);

  const view = useMemo(
    () =>
      applyInsightsView(rows ?? [], {
        trustworthyOnly,
        trustworthyMinN: TRUSTWORTHY_MIN_N,
        sortKey,
        sortDir,
      }),
    [rows, trustworthyOnly, sortKey, sortDir],
  );

  const underlyings = useMemo(() => {
    if (!rows) return [];
    const set = new Set(rows.map((r) => r.underlying));
    return Array.from(set).sort();
  }, [rows]);

  const onHeaderClick = (key: InsightsSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      // Numeric columns default to descending (biggest first); text columns
      // default to ascending (alphabetical).
      setSortDir(key === 'pattern' || key === 'underlying' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <Link
          href="/backtesting"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft size={14} />
          Backtesting
        </Link>
        <span className="text-[var(--color-text-secondary)]">›</span>
        <h1 className="text-3xl font-bold">Pattern Insights</h1>
        <BetaBadge size="md" />
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] max-w-3xl mb-6">
        Measured performance for each playbook pattern on the standardized
        realized-P&L backtest — net of bid/ask fills, slippage, and
        commission. One row per (pattern, underlying) pair, latest window per
        pair. <span className="font-semibold">Past performance does not
        guarantee future returns.</span> Use these as a sanity check, not a
        promise.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
          {SOURCE_OPTIONS.map((opt) => (
            <TooltipWrapper key={opt.value} text={opt.tooltip} placement="bottom">
              <button
                type="button"
                onClick={() => setSource(opt.value)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  source === opt.value
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-text)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                {opt.label}
              </button>
            </TooltipWrapper>
          ))}
        </div>

        <select
          value={underlying}
          onChange={(e) => setUnderlying(e.target.value)}
          className="rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-xs"
        >
          <option value="">All underlyings</option>
          {underlyings.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={trustworthyOnly}
            onChange={(e) => setTrustworthyOnly(e.target.checked)}
          />
          <span>Hide pairs with N &lt; {TRUSTWORTHY_MIN_N}</span>
          <TooltipWrapper
            text={`Sub-${TRUSTWORTHY_MIN_N} samples are noisy: the measured rate can swing materially as more trades resolve. Filter on to see only the pairs we'd trust today.`}
            placement="bottom"
          >
            <Info size={12} className="text-[var(--color-text-secondary)] cursor-help" />
          </TooltipWrapper>
        </label>

        <button
          type="button"
          onClick={() => {
            // Null rows + null error puts us back in the loading state, and
            // the effect's dep array re-runs on the underlying/source values
            // — but we also need to retrigger when neither changed. Cheapest
            // honest way: bump a no-op state. Since dep array is just
            // [source, underlying], we set source to itself via the same
            // reference — the effect re-runs because React schedules a
            // re-render. Actually, identical state writes are batched away;
            // we need an explicit fetch here.
            setRows(null);
            setError(null);
            backtestAPI
              .getPatternInsights(source, underlying || undefined)
              .then((r) => {
                setRows(r);
                setError(null);
              })
              .catch((e: unknown) => {
                setError(e instanceof Error ? e.message : 'Failed to load insights.');
                setRows([]);
              });
          }}
          disabled={loading}
          aria-label="Refresh"
          title="Refresh"
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs disabled:opacity-50"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
              {HEADERS.map((h) => {
                const active = h.key === sortKey;
                const arrow = active
                  ? sortDir === 'desc'
                    ? <ArrowDown size={11} className="inline-block ml-1" />
                    : <ArrowUp size={11} className="inline-block ml-1" />
                  : null;
                return (
                  <th
                    key={h.key}
                    onClick={() => onHeaderClick(h.key)}
                    className={`px-3 py-2 select-none cursor-pointer text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap ${
                      h.align === 'right' ? 'text-right' : 'text-left'
                    } ${active ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'}`}
                  >
                    {h.tooltip ? (
                      <TooltipWrapper text={h.tooltip} placement="top">
                        <span>{h.label}{arrow}</span>
                      </TooltipWrapper>
                    ) : (
                      <span>{h.label}{arrow}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && view.length === 0 ? (
              <tr>
                <td colSpan={HEADERS.length} className="px-3 py-6 text-center text-[var(--color-text-secondary)]">
                  Loading…
                </td>
              </tr>
            ) : view.length === 0 ? (
              <tr>
                <td colSpan={HEADERS.length} className="px-3 py-6 text-center text-[var(--color-text-secondary)]">
                  {trustworthyOnly
                    ? `No pairs with at least ${TRUSTWORTHY_MIN_N} resolved trades yet.`
                    : 'No measurements for this source / underlying yet.'}
                </td>
              </tr>
            ) : (
              view.map((r) => (
                <tr
                  key={`${r.pattern}|${r.underlying}|${r.source}`}
                  className="border-t"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <td className="px-3 py-2 font-mono text-xs">{r.pattern}</td>
                  <td className="px-3 py-2 font-semibold">{r.underlying}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.n_resolved}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPercent(r.hit_rate)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatProfitFactor(r.profit_factor)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPnl(r.expectancy)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPnl(r.net_pnl)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                    {formatPnl(r.avg_win_pnl)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                    {formatPnl(r.avg_loss_pnl != null ? -Math.abs(r.avg_loss_pnl) : null)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-[var(--color-text-secondary)] max-w-3xl">
        Standardized spec: single-leg ATM entries at each card&apos;s own
        target/stop, with a +75% premium take-profit and −50% premium stop
        overlaid. Net of 1% slippage and $0.65 / contract commission. Rows
        refresh nightly from the calibration backtest; toggle to{' '}
        <span className="font-semibold">Underlying touch</span> to see the
        unrealistic &ldquo;did price reach target?&rdquo; proxy for comparison.{' '}
        <Link href="/backtesting" className="underline">
          Run your own backtest →
        </Link>
      </p>
    </div>
  );
}
