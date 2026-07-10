'use client';

/**
 * TradesAuditPanel — admin-only "every trade in one place" audit surface.
 *
 * The leaderboard shows aggregated NAV curves; this panel shows the raw
 * closed trades one row per trade, filterable by SIM vs LIVE and by
 * bot. A LIVE badge distinguishes real engine-opened trades from
 * synthetic seeder rows, so the operator can never confuse them again
 * (this became a real question after a P&L math bug on live trades
 * pushed a bot's sleeve from $111k to $4.4M).
 *
 * Data source: GET /api/tradeworkz/admin/trades — filter args match
 * the query params exposed there (origin/bot_id/since/until/limit/
 * offset/format). CSV export hits the same endpoint with format=csv
 * so what the operator opens in Excel is exactly what the JSON view
 * shows.
 *
 * All state is local; the panel doesn't affect the rest of the page.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, FileSpreadsheet } from 'lucide-react';
import { fmtMoney, fmtSignedMoney, fmtSignedPct } from './format';
import type { BotRow } from './types';

type Origin = 'all' | 'live' | 'simulate';

interface Leg {
  option_symbol?: string | null;
  side?: string | null;
  option_type?: string | null;
  strike?: number | null;
  expiration?: string | null;
}

interface TradeRow {
  id: number;
  bot_id: string;
  bot_display_name: string | null;
  underlying: string;
  origin: 'live' | 'simulate';
  opened_at: string | null;
  closed_at: string | null;
  direction: string;
  strategy_type: string;
  entry_price: number | null;
  exit_price: number | null;
  quantity: number | null;
  realized_pnl: number | null;
  pnl_percent: number | null;
  outcome: 'win' | 'loss' | 'scratch' | string | null;
  close_reason: string | null;
  entry_conviction: number | null;
  legs: Leg[] | null;
  components_at_entry: Record<string, unknown> | null;
  components_at_exit: Record<string, unknown> | null;
}

/**
 * Per-leg contract labels from a trade's legs.
 * ["SPY 7/8 P746"] for a single-leg long put; ["SPY 7/8 C750", "SPY 7/8 P740"]
 * for a two-leg structure. Returns a single em dash when the component fields
 * are missing. Rendered one leg per line by {@link ContractCell} so a
 * multi-leg structure spills onto a second line instead of widening the column.
 */
function contractLegLabels(
  underlying: string,
  legs: Leg[] | null | undefined,
): string[] {
  if (!legs || legs.length === 0) return ['—'];
  return legs.map((leg) => {
    const exp = String(leg.expiration ?? '');
    // ISO expiration is YYYY-MM-DD; render as M/D so the table doesn't get too wide.
    let expShort = exp;
    if (exp.length >= 10) {
      const [, m, d] = exp.split('-');
      if (m && d) expShort = `${parseInt(m, 10)}/${parseInt(d, 10)}`;
    }
    const right = (leg.option_type ?? '').slice(0, 1).toUpperCase();
    const strike = leg.strike ?? '';
    return `${underlying} ${expShort} ${right}${strike}`;
  });
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '−' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1000) return `${n < 0 ? '−' : ''}$${(abs / 1000).toFixed(2)}K`;
  return `${n < 0 ? '−' : ''}$${abs.toFixed(2)}`;
}

interface AuditResponse {
  entries: TradeRow[];
  summary: {
    n_trades: number;
    sum_realized_pnl: number;
    n_wins: number;
    n_losses: number;
    n_scratches: number;
  };
}

interface OpenPositionRow {
  id: number;
  bot_id: string;
  bot_display_name: string | null;
  underlying: string;
  opened_at: string | null;
  updated_at: string | null;
  direction: string;
  strategy_type: string;
  legs: Leg[] | null;
  entry_price: number | null;
  current_price: number | null;
  quantity_open: number | null;
  unrealized_pnl: number | null;
  stop_price: number | null;
  target_price: number | null;
  time_stop_at: string | null;
  min_hold_until: string | null;
  entry_conviction: number | null;
  origin: 'live' | 'simulate';
}

interface OpenPositionsResponse {
  entries: OpenPositionRow[];
  summary: {
    n_open: number;
    total_unrealized_pnl: number;
  };
}

interface Props {
  bots: BotRow[];
  /**
   * When true, the panel shows the origin (LIVE/SIM/all) tab, the CSV
   * export, and does not force live-only filtering. Non-admin viewers
   * only ever see live trades — they never need to know sim exists.
   */
  isAdmin?: boolean;
}

const PAGE_SIZE = 100;

export default function TradesAuditPanel({ bots, isAdmin = false }: Props) {
  // Non-admin viewers are locked to origin='live' — they never see sim
  // rows or the origin toggle. The backend endpoint respects this filter
  // regardless of whether the tab is present in the DOM.
  const [origin, setOrigin] = useState<Origin>(isAdmin ? 'all' : 'live');
  const [botId, setBotId] = useState<string>('');
  const [offset, setOffset] = useState<number>(0);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [openPositions, setOpenPositions] =
    useState<OpenPositionsResponse | null>(null);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('origin', origin);
    if (botId) p.set('bot_id', botId);
    p.set('limit', String(PAGE_SIZE));
    p.set('offset', String(offset));
    return p.toString();
  }, [origin, botId, offset]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tradeworkz/admin/trades?${queryParams}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const body = (await res.json()) as AuditResponse;
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset paging when filters change so the operator doesn't wonder why
  // the same 100 rows keep showing after they narrow the filter.
  useEffect(() => {
    setOffset(0);
  }, [origin, botId]);

  // Open positions — polls every 15 s so mark-to-market and time-stop
  // countdown refresh without a page reload. Failures are swallowed
  // (the section just doesn't render); the closed-trades table below
  // is authoritative if the open-positions endpoint hiccups.
  useEffect(() => {
    let cancelled = false;
    const fetchOpen = async () => {
      try {
        const res = await fetch('/api/tradeworkz/admin/positions', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const body = (await res.json()) as OpenPositionsResponse;
        if (!cancelled) setOpenPositions(body);
      } catch {
        /* keep the last-known good snapshot */
      }
    };
    void fetchOpen();
    const timer = setInterval(fetchOpen, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const downloadCsv = useCallback(() => {
    const p = new URLSearchParams();
    p.set('origin', origin);
    if (botId) p.set('bot_id', botId);
    p.set('limit', '2000');
    p.set('format', 'csv');
    // Same-origin GET, credentialed. A plain anchor triggers download
    // because the endpoint sets Content-Disposition: attachment.
    const a = document.createElement('a');
    a.href = `/api/tradeworkz/admin/trades?${p.toString()}`;
    a.rel = 'noopener';
    a.click();
  }, [origin, botId]);

  return (
    <section
      className="mb-10 rounded-2xl"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div
        className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Trade audit
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Every position the fleet holds right now, and every trade it has
            closed. Prices are{' '}
            <span className="font-medium text-[var(--color-text-primary)]">per share</span>
            ; each contract = 100 shares.
            {isAdmin ? (
              <>
                {' '}Origin tags:{' '}
                <span className="font-medium text-[var(--color-text-primary)]">SIM</span>{' '}
                = seed data,{' '}
                <span className="font-medium text-[var(--color-text-primary)]">LIVE</span>{' '}
                = real engine entries.
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin ? <OriginTabs current={origin} onChange={setOrigin} /> : null}
          <select
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-full"
            style={{
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="">All bots</option>
            {bots.map((b) => (
              <option key={b.id} value={b.id}>
                {b.display_name}
              </option>
            ))}
          </select>
          {isAdmin ? (
            <button
              onClick={downloadCsv}
              className="text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 transition-colors"
              style={{
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
              title="Download the currently-filtered trades as CSV"
            >
              <FileSpreadsheet className="w-3 h-3" />
              CSV
            </button>
          ) : null}
        </div>
      </div>

      <OpenPositionsSection data={openPositions} />

      {/*
        Closed-trades section header. Matches OpenPositionsSection layout:
        section title + one-line description on the left, five-column stat
        rail on the right. The stat rail always shows the same five slots
        (count, P&L, wins, losses, scratches) so the eye can align them
        between open and closed at a glance.
      */}
      <div
        className="px-5 py-4 border-b flex items-center justify-between gap-4 flex-wrap"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface-subtle)',
        }}
      >
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-primary)]">
            Closed trades
          </div>
          <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
            Every trade that has already exited, newest first.
          </div>
        </div>
        {data ? (
          <div className="flex items-center gap-6 text-xs">
            <SummaryCell
              label="Trades"
              value={data.summary.n_trades.toLocaleString()}
            />
            <SummaryCell
              label="Realized P&L"
              value={fmtSignedMoney(data.summary.sum_realized_pnl)}
              tone={
                data.summary.sum_realized_pnl >= 0
                  ? 'var(--color-bull)'
                  : 'var(--color-bear)'
              }
            />
            <SummaryCell
              label="Wins"
              value={data.summary.n_wins.toLocaleString()}
            />
            <SummaryCell
              label="Losses"
              value={data.summary.n_losses.toLocaleString()}
            />
            <SummaryCell
              label="Scratches"
              value={data.summary.n_scratches.toLocaleString()}
            />
          </div>
        ) : null}
      </div>

      {loading && !data ? (
        <div className="p-8 text-center text-xs text-[var(--color-text-secondary)]">
          Loading trades…
        </div>
      ) : error ? (
        <div
          className="p-6 text-xs"
          style={{
            color: 'var(--color-bear)',
            backgroundColor: 'var(--color-bear-soft)',
          }}
        >
          {error}
        </div>
      ) : data && data.entries.length === 0 ? (
        <div className="p-8 text-center text-xs text-[var(--color-text-secondary)]">
          No trades match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr
                className="border-b text-[10px] uppercase tracking-wider"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {isAdmin ? <Th>Origin</Th> : null}
                <Th width="6.5rem">Opened</Th>
                <Th width="6.5rem">Closed</Th>
                <Th width="9.5rem">Bot</Th>
                <Th width="8.5rem">Contract</Th>
                <Th align="center" width="3.25rem">Lean</Th>
                <Th align="right">Entry / sh</Th>
                <Th align="right">Exit / sh</Th>
                <Th align="right">Qty</Th>
                <Th align="right">Cost basis</Th>
                <Th align="right">Proceeds</Th>
                <Th align="right">P&amp;L $</Th>
                <Th align="right">P&amp;L %</Th>
                <Th>&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.entries ?? []).map((row) => {
                const positive = (row.realized_pnl ?? 0) >= 0;
                const isOpen = expandedId === row.id;
                const qty = row.quantity ?? 0;
                // Per-share × contracts × 100-share multiplier — same shape
                // the backend csv writes so the UI and export always agree.
                const costBasis =
                  row.entry_price != null && qty > 0
                    ? row.entry_price * qty * 100
                    : null;
                const proceeds =
                  row.exit_price != null && qty > 0
                    ? row.exit_price * qty * 100
                    : null;
                return (
                  <>
                    <tr
                      key={row.id}
                      className="border-b cursor-pointer transition-colors"
                      style={{ borderColor: 'var(--color-border)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                          'var(--color-surface-subtle)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                          'transparent';
                      }}
                      onClick={() => setExpandedId(isOpen ? null : row.id)}
                    >
                      {isAdmin ? (
                        <td className="px-3 py-2">
                          <OriginBadge origin={row.origin} />
                        </td>
                      ) : null}
                      <td className="px-3 py-2 align-top">
                        <DateTimeCell iso={row.opened_at} />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <DateTimeCell iso={row.closed_at} />
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-primary)] align-top">
                        <div className="line-clamp-2">
                          {row.bot_display_name ?? row.bot_id}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-primary)] align-top">
                        <ContractCell underlying={row.underlying} legs={row.legs} />
                      </td>
                      <td className="px-2 py-2 text-center align-middle">
                        <DirectionCell direction={row.direction} />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.entry_price != null ? `$${row.entry_price.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.exit_price != null ? `$${row.exit_price.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.quantity != null ? row.quantity.toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                        {fmtCurrency(costBasis)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                        {fmtCurrency(proceeds)}
                      </td>
                      <td
                        className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap"
                        style={{ color: positive ? 'var(--color-bull)' : 'var(--color-bear)' }}
                      >
                        {row.realized_pnl != null ? fmtSignedMoney(row.realized_pnl) : '—'}
                      </td>
                      <td
                        className="px-3 py-2 text-right tabular-nums whitespace-nowrap"
                        style={{ color: positive ? 'var(--color-bull)' : 'var(--color-bear)' }}
                      >
                        {row.pnl_percent != null ? fmtSignedPct(row.pnl_percent, 1) : '—'}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                        {isOpen ? '▲' : '▼'}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={isAdmin ? 14 : 13} className="px-5 pb-4 pt-1 bg-[var(--color-surface-subtle)]">
                          <ExpandedDetail row={row} />
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data ? (
        <div
          className="px-5 py-3 border-t flex items-center justify-between text-xs"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span className="text-[var(--color-text-secondary)]">
            Showing {data.entries.length} of {data.summary.n_trades.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || loading}
              className="px-3 py-1 rounded-full text-xs disabled:opacity-40"
              style={{
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              ← Prev
            </button>
            <span className="text-[var(--color-text-secondary)] tabular-nums">
              {offset + 1}–{offset + data.entries.length}
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={data.entries.length < PAGE_SIZE || loading}
              className="px-3 py-1 rounded-full text-xs disabled:opacity-40"
              style={{
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              Next →
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OpenPositionsSection({ data }: { data: OpenPositionsResponse | null }) {
  if (!data) return null;
  const now = Date.now();
  // Per-position winning/losing/scratch counts derived from the sign of
  // each row's unrealized_pnl. Mirrors the wins/losses/scratches columns
  // on the closed-trades stat rail so the two sections read as a matched
  // pair — Positions/Unrealized/Winning/Losing/Scratch above,
  // Trades/Realized/Wins/Losses/Scratches below.
  let winning = 0;
  let losing = 0;
  let scratch = 0;
  for (const p of data.entries) {
    const pnl = p.unrealized_pnl ?? 0;
    if (pnl > 0) winning += 1;
    else if (pnl < 0) losing += 1;
    else scratch += 1;
  }
  return (
    <div
      className="px-5 py-4 border-b"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-primary)]">
            Open positions
          </div>
          <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
            Currently held — updates every 15s. Closed trades appear below
            once they exit.
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <SummaryCell
            label="Positions"
            value={data.summary.n_open.toLocaleString()}
          />
          <SummaryCell
            label="Unrealized P&L"
            value={fmtSignedMoney(data.summary.total_unrealized_pnl)}
            tone={
              data.summary.total_unrealized_pnl >= 0
                ? 'var(--color-bull)'
                : 'var(--color-bear)'
            }
          />
          <SummaryCell label="Winning" value={winning.toLocaleString()} />
          <SummaryCell label="Losing" value={losing.toLocaleString()} />
          <SummaryCell label="Scratch" value={scratch.toLocaleString()} />
        </div>
      </div>

      {data.entries.length === 0 ? (
        <div className="text-[11px] text-[var(--color-text-secondary)] mt-2 italic">
          No positions currently held. The engine opens on the next
          qualifying tick.
        </div>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs">
            <thead>
              <tr
                className="border-b text-[10px] uppercase tracking-wider"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <Th width="9.5rem">Bot</Th>
                <Th width="8.5rem">Contract</Th>
                <Th align="center" width="3.25rem">Lean</Th>
                <Th align="right">Entry / sh</Th>
                <Th align="right">Mark / sh</Th>
                <Th align="right">Qty</Th>
                <Th align="right">Cost basis</Th>
                <Th align="right">Unrealized</Th>
                <Th align="right">Target</Th>
                <Th align="right">Stop</Th>
                <Th>Held</Th>
                <Th>Time stop</Th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((pos) => {
                const positive = (pos.unrealized_pnl ?? 0) >= 0;
                const qty = pos.quantity_open ?? 0;
                const costBasis =
                  pos.entry_price != null && qty > 0
                    ? pos.entry_price * qty * 100
                    : null;
                const openedMs = pos.opened_at
                  ? Date.parse(pos.opened_at)
                  : null;
                const heldSec = openedMs ? Math.max(0, (now - openedMs) / 1000) : null;
                const heldLabel = fmtDuration(heldSec);
                const timeStopMs = pos.time_stop_at
                  ? Date.parse(pos.time_stop_at)
                  : null;
                const untilTimeStopSec = timeStopMs
                  ? Math.max(0, (timeStopMs - now) / 1000)
                  : null;
                const timeStopLabel = untilTimeStopSec != null
                  ? `in ${fmtDuration(untilTimeStopSec) ?? '—'}`
                  : '—';
                return (
                  <tr
                    key={pos.id}
                    className="border-b last:border-b-0"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <td className="px-3 py-2 text-[var(--color-text-primary)] align-top">
                      <div className="line-clamp-2">
                        {pos.bot_display_name ?? pos.bot_id}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-primary)] align-top">
                      <ContractCell underlying={pos.underlying} legs={pos.legs} />
                    </td>
                    <td className="px-2 py-2 text-center align-middle">
                      <DirectionCell direction={pos.direction} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {pos.entry_price != null ? `$${pos.entry_price.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {pos.current_price != null ? `$${pos.current_price.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {qty > 0 ? qty.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                      {fmtCurrency(costBasis)}
                    </td>
                    <td
                      className="px-3 py-2 text-right tabular-nums font-medium"
                      style={{ color: positive ? 'var(--color-bull)' : 'var(--color-bear)' }}
                    >
                      {pos.unrealized_pnl != null
                        ? fmtSignedMoney(pos.unrealized_pnl)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                      {pos.target_price != null ? pos.target_price.toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                      {pos.stop_price != null ? pos.stop_price.toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)] whitespace-nowrap">
                      {heldLabel ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)] whitespace-nowrap">
                      {timeStopLabel}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fmtDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function OriginTabs({
  current,
  onChange,
}: {
  current: Origin;
  onChange: (o: Origin) => void;
}) {
  const opts: { key: Origin; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'live', label: 'Live' },
    { key: 'simulate', label: 'Sim' },
  ];
  return (
    <div
      className="inline-flex rounded-full p-1"
      style={{
        backgroundColor: 'var(--color-surface-subtle)',
        border: '1px solid var(--color-border)',
      }}
    >
      {opts.map((o) => {
        const active = o.key === current;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className="text-xs px-3 py-1 rounded-full transition-colors font-medium"
            style={{
              backgroundColor: active ? 'var(--color-info)' : 'transparent',
              color: active ? 'var(--color-on-info, #ffffff)' : 'var(--color-text-secondary)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function OriginBadge({ origin }: { origin: 'live' | 'simulate' }) {
  const isSim = origin === 'simulate';
  return (
    <span
      className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold"
      style={{
        backgroundColor: isSim
          ? 'var(--color-warning-soft)'
          : 'var(--color-bull-soft)',
        color: isSim ? 'var(--color-warning)' : 'var(--color-bull)',
      }}
    >
      {isSim ? 'SIM' : 'LIVE'}
    </span>
  );
}

/**
 * Opened / closed timestamp split across two lines — date above, time below —
 * so the column stays narrow instead of forcing one wide
 * "M/D/YYYY, h:mm:ss AM" line. Two lines by construction.
 */
function DateTimeCell({ iso }: { iso: string | null }) {
  if (!iso) {
    return <span className="text-[var(--color-text-secondary)]">—</span>;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return <span className="text-[var(--color-text-secondary)]">{iso}</span>;
  }
  return (
    <div className="leading-tight text-[var(--color-text-secondary)]">
      <div className="whitespace-nowrap">{d.toLocaleDateString()}</div>
      <div className="whitespace-nowrap tabular-nums">{d.toLocaleTimeString()}</div>
    </div>
  );
}

/**
 * Contract label rendered one leg per line, so a two-leg structure spills its
 * second leg onto a second line rather than widening the column. Anything past
 * two legs (e.g. an iron condor) is capped at two lines with a "+N" marker; the
 * full leg list is always available in the expanded row detail.
 */
function ContractCell({
  underlying,
  legs,
}: {
  underlying: string;
  legs: Leg[] | null | undefined;
}) {
  const labels = contractLegLabels(underlying, legs);
  const shown = labels.slice(0, 2);
  const extra = labels.length - shown.length;
  return (
    <div className="leading-tight font-mono text-[11px]">
      {shown.map((label, i) => (
        <div key={i} className="whitespace-nowrap">
          {label}
          {i === shown.length - 1 && extra > 0 ? (
            <span className="text-[var(--color-text-secondary)]"> +{extra}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Direction rendered as a glyph rather than a word: a green up arrow for a
 * bullish trade, a red down arrow for a bearish one. The word is preserved for
 * hover (title) and assistive tech (aria-label) so no information is lost,
 * and any value that isn't bullish/bearish (e.g. a neutral/market-neutral
 * structure) falls back to its raw text so nothing silently vanishes.
 */
function DirectionCell({ direction }: { direction: string }) {
  const dir = (direction ?? '').toLowerCase();
  const isBull = dir === 'bullish';
  const isBear = dir === 'bearish';
  if (!isBull && !isBear) {
    return (
      <span className="text-[var(--color-text-secondary)] capitalize">
        {direction || '—'}
      </span>
    );
  }
  const label = isBull ? 'Bullish' : 'Bearish';
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ color: isBull ? 'var(--color-bull)' : 'var(--color-bear)' }}
      role="img"
      aria-label={label}
      title={label}
    >
      {isBull ? (
        <ArrowUp size={20} strokeWidth={2.5} aria-hidden="true" />
      ) : (
        <ArrowDown size={20} strokeWidth={2.5} aria-hidden="true" />
      )}
    </span>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
        {label}
      </span>
      <span
        className="tabular-nums font-medium"
        style={{ color: tone ?? 'var(--color-text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}

function Th({
  children,
  align = 'left',
  width,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
}) {
  const alignClass =
    align === 'right'
      ? 'text-right'
      : align === 'center'
        ? 'text-center'
        : 'text-left';
  return (
    <th
      className={`px-3 py-2 ${alignClass} font-semibold whitespace-nowrap`}
      style={width ? { width } : undefined}
    >
      {children}
    </th>
  );
}

function LegsTable({
  legs,
  emptyLabel,
}: {
  legs: Leg[] | null | undefined;
  emptyLabel: string;
}) {
  if (!legs || legs.length === 0) {
    return (
      <div className="text-[11px] text-[var(--color-text-secondary)] italic">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div
      className="rounded overflow-hidden"
      style={{ border: '1px solid var(--color-border)' }}
    >
      <table className="w-full text-[11px]">
        <thead>
          <tr
            className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <th className="px-2 py-1.5 text-left font-semibold">#</th>
            <th className="px-2 py-1.5 text-left font-semibold">Side</th>
            <th className="px-2 py-1.5 text-left font-semibold">Type</th>
            <th className="px-2 py-1.5 text-right font-semibold">Strike</th>
            <th className="px-2 py-1.5 text-left font-semibold">Expires</th>
            <th className="px-2 py-1.5 text-left font-semibold">Symbol</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, i) => {
            const isLong = (leg.side ?? '').toLowerCase() === 'long';
            const sideTone = isLong ? 'var(--color-bull)' : 'var(--color-bear)';
            const type = (leg.option_type ?? '').toLowerCase();
            const typeLabel = type
              ? type.charAt(0).toUpperCase() + type.slice(1)
              : '—';
            return (
              <tr
                key={`${leg.option_symbol ?? i}-${i}`}
                className="border-t"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <td className="px-2 py-1.5 text-[var(--color-text-secondary)] tabular-nums">
                  {i + 1}
                </td>
                <td
                  className="px-2 py-1.5 font-semibold uppercase tracking-wider text-[10px]"
                  style={{ color: sideTone }}
                >
                  {leg.side ?? '—'}
                </td>
                <td className="px-2 py-1.5 text-[var(--color-text-primary)]">
                  {typeLabel}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-[var(--color-text-primary)]">
                  {leg.strike ?? '—'}
                </td>
                <td className="px-2 py-1.5 text-[var(--color-text-secondary)] tabular-nums whitespace-nowrap">
                  {leg.expiration ?? '—'}
                </td>
                <td className="px-2 py-1.5 text-[var(--color-text-secondary)] font-mono">
                  {leg.option_symbol ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExpandedDetail({ row }: { row: TradeRow }) {
  return (
    <div className="space-y-4 py-2">
      {/*
        Close reason lives here, in the drilldown, rather than as its own
        table column — the operator can still see why the engine exited
        without a Reason column widening the main table. Underscores are
        humanized ("time_stop" → "Time Stop") for readability.
      */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
          Close reason
        </div>
        <div className="text-xs text-[var(--color-text-primary)] capitalize">
          {row.close_reason ? row.close_reason.replace(/[_-]+/g, ' ') : '—'}
        </div>
      </div>

      {/*
        Legs: for a multi-leg structure (iron condor, straddle, vertical) the
        operator needs to see every leg — long/short, strike, expiration — to
        understand what was actually traded without decoding the option_symbol
        themselves.
      */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
          Legs ({row.legs?.length ?? 0})
        </div>
        <LegsTable legs={row.legs} emptyLabel="No legs recorded for this trade." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
            Components at entry
          </div>
          <pre
            className="text-[11px] p-2 rounded overflow-x-auto whitespace-pre-wrap break-words"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              maxHeight: 260,
            }}
          >
            {JSON.stringify(row.components_at_entry ?? {}, null, 2)}
          </pre>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
            Components at exit
          </div>
          <pre
            className="text-[11px] p-2 rounded overflow-x-auto whitespace-pre-wrap break-words"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              maxHeight: 260,
            }}
          >
            {JSON.stringify(row.components_at_exit ?? {}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
