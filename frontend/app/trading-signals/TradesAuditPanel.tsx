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
import { Download, FileSpreadsheet } from 'lucide-react';
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
                <Th align="center" width="3.25rem">Dir.</Th>
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
                <Th align="center" width="3.25rem">Dir.</Th>
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
 * Bull / bear glyphs for the trade Direction column — a charging bull for
 * bullish, a snarling bear head for bearish. Both are drawn with
 * fill="currentColor" so the caller tints them with the same
 * --color-bull / --color-bear tokens the rest of the panel uses, which
 * keeps them theme-aware (they brighten in dark mode) for free.
 *
 * Artwork: game-icons.net — "charging-bull" and "bear-head" (by Lorc /
 * Delapouite & contributors), licensed CC BY 3.0 and recolored via
 * currentColor. See THIRD_PARTY_NOTICES.md for the required attribution.
 * viewBox is the game-icons 512×512 grid.
 */
function BullIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M151.22 61.008c-45.151 7.449-99.44 35.085-131.642 54.097V297.21c5.34 7.523 13.07 12.906 24.904 17.07c5.308 1.868 11.417 3.433 18.221 4.783c-21.112-27.026-26.391-50.921-21.297-79.236l17.715 3.192c-6.724 34.584 13.695 64.344 34.152 77.013l7.15 4.37l2.407 3.814c9.482 17.063 28.034 25.752 51.426 41.152l9.723 6.403l-8.645 7.798c-9.834 8.873-17.062 16.44-18.367 26.559l-1.592 12.342l-24.098-11.545c-11.192 12.316-20.47 25.593-27.652 40.025c10.977 6.704 36.525 19.136 49.105 16.346c32.21-21.813 59.517-67.5 71.09-97.953c-6.484-24.65-21.778-46.56-40.277-70.047l-4.1-5.205c4.853-7.592 11.429-14.973 18.084-19.31c26.259-20.873 35.437-38.189 37.44-53.362c.675-21.155-6.159-35.841-14.106-53.04l16.34-7.55c9.207 20.935 17.712 44.638 15.611 62.947c-1.68 12.732-7.198 25.876-17.857 39.399c9.34-1.382 16.555-2.574 25.883-4.121l.262 10.343c.44 17.375 1.668 24.569 15.748 49.57l1.554 2.763l-8.457 51.103c7.432 10.524 20.33 11.513 30.994 10.781c25.144-26.855 42.492-57.16 57.1-89.058c-8.896-1.83-15.986-6.023-20.451-11.895c-5.026-6.609-6.408-14.801-5.057-22.137c2.702-14.67 16.832-27.65 34.66-25.044l-.304-.04c4.278.478 8.63.829 13.035 1.09c-42.222-45.878-38.747-104.57-74.713-138.82c-37.98-22.166-89.34-36.372-133.988-36.701zm299.657 133.017c-25.974 8.19-52.938 16.89-80.334 23.028a3126 3126 0 0 1 8.764 18.293c29.023-10.805 51.564-25.555 71.57-41.32zm19.978 55.053c-40.912 3.884-85.203 8.795-125.962 4.25l-.153-.017l-.152-.022c-8.297-1.213-13.24 4.437-14.356 10.494c-.557 3.029-.034 5.724 1.684 7.983c1.688 2.22 4.886 4.52 11.58 5.46c52.566 1.922 92.792-11.677 127.36-28.148zm-163.32 43.738c4.068-.076 9.831 6.07 9.94 9.87c.123 4.33-4.278 13.351-12.106 22.978c-2.335-8.081-8.27-32.478 2.166-32.848m-13.96 64.67l-19.882 19.58s-2.011-12.095 1.621-16.068c6.037-2.969 12.016-3.867 18.26-3.512zm-44.636 38.348l-11.55 35.494s-12.831-12.815-20.018-10.535c-12.026 3.815-17.207 33.71-17.207 33.71l-23.176-9.13s3.691 28.627 14.748 34.416c15.559 8.145 51.621-10.535 51.621-10.535s1.372 21.203 9.483 23.176c15.088 3.669 35.467-30.2 35.467-30.2s36.32 34.765 51.972 23.88c14.938-10.39 2.14-52.38-4.103-54.432c-7.744-2.546-16.676 17.888-16.676 17.888s-10.826-24.025-22.063-27.017c-9.81-2.613-28.445 10.885-28.445 10.885l5.393-31.528c-3.305-.031-6.567-.272-9.77-.781l-10.37 29.932l4.347-31.245c-3.373-.936-6.912-2.436-9.653-3.978M84.4 398.047c-11.613 11.065-20.069 23.628-27.237 37.137c3.725 1.954 7.425 4.1 11.086 6.3c7.066-13.88 15.86-26.738 26.148-38.648z" />
    </svg>
  );
}

function BearIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M220.41 35.389c-.584-.175-9.216 1.425-18.76 7.976c-8.948 6.143-18.914 15.31-27.283 25.137l.34.268c-6.134 7.797-13.129 16.816-17.613 25.767c-4.485 8.951-6.294 17.19-3.989 24.71l-17.209 5.274c-4.144-13.518-.522-26.817 5.104-38.046c2.208-4.408 4.753-8.587 7.398-12.52C105.378 74.11 62.33 71.25 18 66.748v409.828a265 265 0 0 1 24.8-19.922l1.901-1.345l2.313-.254c24.034-2.65 55.821-6.651 84.908-15.803c29.086-9.152 54.934-23.401 68.633-45.191l2.558-4.073l4.809-.134c91.21-2.547 140.126-19.862 193.652-50.153c.126-.095.252-.199.377-.295c-6.874-.376-14.493-.65-22.334-.617c-20.444.086-42.1 3.08-51.367 8.973l-9.658-15.188c16.106-10.242 39.29-11.694 60.949-11.785c15.73-.066 30.683 1.026 40.254 1.797c6.938-7.739 13.533-16.503 19.18-25.514c5.066-8.086 9.33-16.386 12.537-24.177c-3.821-.55-7.395-1.642-10.633-3.258c-8.283-4.134-14.026-11.447-16.754-19.596c-3.827-11.432-2.087-24.798 5.268-35.777l-64.641-23.35l.277-6.598c.396-9.422-6.387-27.053-14.601-34.712c-21.568-20.112-46.91-21.58-78.06-33.93l-3.554-1.408l-1.453-3.536c-10.662-25.924-17.06-44.024-23.47-55.5c-6.412-11.475-11.574-16.287-23.48-19.841zm-5.808 20.82l9.84 15.072c-29.07 18.978-29.771 34.937-31.23 51.65l-17.93-1.562c1.5-17.208 5.882-43.33 39.32-65.16M119.6 135.473l8.119 16.064c-42.266 21.357-60.741 47.237-65.88 70.451c14.366-11.279 29.7-17.184 50.218-16.46l15.238.538l-7.834 13.08c-17.268 28.834-22.552 42.534-26.24 59.696c4.017-1.528 8.007-2.635 12.119-2.979c9.78-.818 19.142 2.28 29.105 7.746l9.5 5.211l-6.869 8.383c-9.978 12.178-13.966 20.02-15.224 27.56c-.477 2.856-.454 5.974-.198 9.333c2.711-2.798 5.58-5.305 8.942-7.198c9.125-5.137 19.745-5.825 33.097-4.632l-1.601 17.927c-11.9-1.063-18.132-.162-22.666 2.391s-8.91 7.798-14.88 18.39l-11.05 19.614l-5.516-21.826c-3.535-13.99-5.842-25.216-3.882-36.961c1.486-8.91 5.434-17.37 12.002-26.742c-3.422-1.103-6.376-1.5-9.258-1.258c-5.244.439-11.572 3.057-20.965 9.203l-17.365 11.361l3.572-20.441c4.283-24.513 7.539-40.242 23.588-69.49c-14.037 2.56-23.415 10.322-37.408 25.492l-13.442 14.57l-2.12-19.709c-3.829-35.558 16.816-78.954 76.898-109.314m143.707 26.976c17.788 7.852 39.24 14.301 56.859 16.617l3.707 17.616c-3.852.81-7.24.644-10.861.07c-1.363 9.026-9.537 15.736-18.74 15.736c-10.089 0-18.946-8.06-18.946-18.396c0-2.45.511-4.766 1.404-6.883c-8.85-3.702-23.717-6.978-28.798-14.723c5.796-2.514 14.755-10.553 15.375-10.037M443.633 225.4c-3.758 6.287-4.294 13.381-2.438 18.928c1.396 4.17 3.941 7.317 7.721 9.203c2.142 1.07 4.803 1.797 8.147 1.823c.303-1.51.546-2.968.707-4.348c-.926-6.793-6.555-16.61-14.137-25.606" />
    </svg>
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
 * Direction rendered as a glyph rather than a word: a charging bull for a
 * bullish trade, a snarling bear for a bearish one. The word is preserved for
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
      {isBull ? <BullIcon size={28} /> : <BearIcon size={28} />}
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
        Legs first: for a multi-leg structure (iron condor, straddle,
        vertical) the operator needs to see every leg — long/short,
        strike, expiration — to understand what was actually traded
        without decoding the option_symbol themselves.
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
