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

interface TradeRow {
  id: number;
  bot_id: string;
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
  components_at_entry: Record<string, unknown> | null;
  components_at_exit: Record<string, unknown> | null;
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

interface Props {
  bots: BotRow[];
}

const PAGE_SIZE = 100;

export default function TradesAuditPanel({ bots }: Props) {
  const [origin, setOrigin] = useState<Origin>('all');
  const [botId, setBotId] = useState<string>('');
  const [offset, setOffset] = useState<number>(0);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
            Every closed trade with an explicit{' '}
            <span className="font-medium text-[var(--color-text-primary)]">SIM</span> or{' '}
            <span className="font-medium text-[var(--color-text-primary)]">LIVE</span>{' '}
            tag. Admin only.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <OriginTabs current={origin} onChange={setOrigin} />
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
        </div>
      </div>

      {data ? (
        <div
          className="px-5 py-3 border-b text-xs flex items-center gap-6 flex-wrap"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface-subtle)',
          }}
        >
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
                <Th>Origin</Th>
                <Th>Closed</Th>
                <Th>Bot</Th>
                <Th>Direction</Th>
                <Th align="right">Entry</Th>
                <Th align="right">Exit</Th>
                <Th align="right">Qty</Th>
                <Th align="right">P&amp;L $</Th>
                <Th align="right">P&amp;L %</Th>
                <Th>Reason</Th>
                <Th>&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.entries ?? []).map((row) => {
                const positive = (row.realized_pnl ?? 0) >= 0;
                const isOpen = expandedId === row.id;
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
                      <td className="px-3 py-2">
                        <OriginBadge origin={row.origin} />
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)] whitespace-nowrap">
                        {row.closed_at
                          ? new Date(row.closed_at).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-primary)]">
                        {row.bot_id}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                        {row.direction}
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
                      <td
                        className="px-3 py-2 text-right tabular-nums font-medium"
                        style={{ color: positive ? 'var(--color-bull)' : 'var(--color-bear)' }}
                      >
                        {row.realized_pnl != null ? fmtSignedMoney(row.realized_pnl) : '—'}
                      </td>
                      <td
                        className="px-3 py-2 text-right tabular-nums"
                        style={{ color: positive ? 'var(--color-bull)' : 'var(--color-bear)' }}
                      >
                        {row.pnl_percent != null ? fmtSignedPct(row.pnl_percent, 1) : '—'}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                        {row.close_reason ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                        {isOpen ? '▲' : '▼'}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={11} className="px-5 pb-4 pt-1 bg-[var(--color-surface-subtle)]">
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
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th className={`px-3 py-2 text-${align} font-semibold`}>{children}</th>
  );
}

function ExpandedDetail({ row }: { row: TradeRow }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
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
  );
}
