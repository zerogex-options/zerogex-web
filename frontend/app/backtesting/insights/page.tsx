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
import { AlertTriangle, ArrowLeft, ArrowDown, ArrowUp, Info, RefreshCw } from 'lucide-react';
import BetaBadge from '@/components/BetaBadge';
import TooltipWrapper from '@/components/TooltipWrapper';
import { backtestAPI } from '@/core/api/endpoints';
import { useAuthSession } from '@/hooks/useAuthSession';
import type { BacktestMeta, InsightsSource, PatternInsight } from '../types';
import {
  applyInsightsView,
  formatPatternLabel,
  formatPnl,
  formatPercent,
  formatProfitFactor,
  type InsightsSortKey,
} from './view';

const TRUSTWORTHY_MIN_N = 40;

interface SourceOption {
  value: InsightsSource;
  label: string;
  tooltip: string;
  /** Admin-only sources are hidden from non-admin tiers. */
  adminOnly?: boolean;
}

const ALL_SOURCE_OPTIONS: SourceOption[] = [
  {
    value: 'option_pnl',
    label: 'Realized P&L',
    tooltip:
      "Standardized single-leg backtest at the card's own target/stop, with " +
      "real option fills, slippage, and commission. The honest measure.",
  },
  {
    value: 'underlying_touch',
    label: 'Touch proxy (debug)',
    tooltip:
      "Debug view: did the underlying reach the target/stop? Ignores premium " +
      "decay and bid/ask. NOT a measure of P&L — useful only as a sanity check.",
    adminOnly: true,
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
    tooltip:
      'Resolved trades in the 60-day calibration window after the per-pattern cooldown. ' +
      'Pairs with N < 40 are considered too small to trust.',
  },
  {
    key: 'hit_rate',
    label: 'Win %',
    align: 'right',
    tooltip:
      'Share of trades whose net P&L was > 0 after slippage and commission. Not a ' +
      'coin-flip baseline: a pattern can have a low win rate and still be profitable ' +
      'overall if its winners are much larger than its losers (check PF and Avg / trade).',
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
    tooltip: 'Average dollar size of a winning trade (gross_win_pnl ÷ n_wins).',
  },
  {
    key: 'avg_loss_pnl',
    label: 'Avg loss',
    align: 'right',
    tooltip: 'Average dollar size of a losing trade (-gross_loss_pnl ÷ n_losses).',
  },
];

export default function InsightsPage() {
  // Auth — the touch-proxy source is admin-only. Until the session has loaded
  // we assume non-admin so the touch tab can't flicker into view.
  const { data: session } = useAuthSession();
  const isAdmin = session?.user?.tier === 'admin';
  const sourceOptions = useMemo(
    () => ALL_SOURCE_OPTIONS.filter((opt) => !opt.adminOnly || isAdmin),
    [isAdmin],
  );

  const [rawSource, setSource] = useState<InsightsSource>('option_pnl');
  // Defense in depth: if the stored source isn't in the visible options (e.g.
  // a non-admin's state somehow has 'underlying_touch'), present + fetch the
  // safe default. Computed at render so we don't need a useEffect that would
  // cascade an extra render.
  const source: InsightsSource = sourceOptions.some((opt) => opt.value === rawSource)
    ? rawSource
    : 'option_pnl';
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

  // Meta is fetched once and reused to humanize pattern slugs in the Pattern
  // column. Best-effort: failures silently fall back to the in-table slug
  // formatter, so the page still renders if meta is down.
  const [meta, setMeta] = useState<BacktestMeta | null>(null);
  useEffect(() => {
    let cancelled = false;
    backtestAPI.getMeta().then(
      (m) => {
        if (!cancelled) setMeta(m);
      },
      () => {
        /* meta is decorative here — slug fallback covers it */
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const patternCatalog = useMemo<Record<string, string>>(() => {
    if (!meta) return {};
    return Object.fromEntries(meta.patterns.map((p) => [p.id, p.name]));
  }, [meta]);

  const patternDescriptions = useMemo<Record<string, string>>(() => {
    if (!meta) return {};
    return Object.fromEntries(
      meta.patterns
        .filter((p) => p.description && p.description.trim() !== '')
        .map((p) => [p.id, p.description]),
    );
  }, [meta]);

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
        {sourceOptions.length > 1 ? (
          <div className="inline-flex rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
            {sourceOptions.map((opt) => (
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
        ) : null}

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

      {source === 'underlying_touch' ? (
        <div
          className="mb-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs"
          style={{
            borderColor: 'rgba(234, 179, 8, 0.4)',
            backgroundColor: 'rgba(234, 179, 8, 0.08)',
          }}
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: '#eab308' }} />
          <div className="leading-snug">
            <strong>Debug view.</strong>{' '}
            The Win % column here counts whether the underlying&apos;s price reached
            the card&apos;s target before its stop &mdash;{' '}
            <em>not</em> whether the trade made money. Touch and realized option P&L
            can disagree wildly (e.g. <code>overnight_trap_continuation</code>:
            ~95% touch rate, ~85% loss rate on options). Use{' '}
            <span className="font-semibold">Realized P&amp;L</span> for any
            trading decisions; this view exists only as an engine sanity check.
          </div>
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
                  <td className="px-3 py-2">
                    <TooltipWrapper
                      text={patternDescriptions[r.pattern] || `pattern_id: ${r.pattern}`}
                      placement="top"
                    >
                      <span className="font-medium cursor-help">
                        {formatPatternLabel(r.pattern, patternCatalog)}
                      </span>
                    </TooltipWrapper>
                  </td>
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
        refresh nightly from the calibration backtest.{' '}
        <Link href="/backtesting" className="underline">
          Run your own backtest →
        </Link>
      </p>
    </div>
  );
}
