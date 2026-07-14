'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';

// Mirrors PageAnalyticsRow / PageAnalyticsSnapshot in core/pageAnalytics.ts
// (kept in sync by hand — this is a client component and can't import the
// server-only module).
type PageRow = {
  path: string;
  accesses: number;
  uniqueUsers: number;
  loggedInAccesses: number;
  avgDurationMs: number;
  totalDurationMs: number;
  lastAccessAt: string | null;
};

type Snapshot = {
  ok: boolean;
  windowDays: number;
  generatedAt: string;
  retentionDays: number;
  totals: {
    accesses: number;
    uniqueUsers: number;
    loggedInAccesses: number;
    measuredVisits: number;
    totalDurationMs: number;
    avgDurationMs: number;
  };
  pages: PageRow[];
};

const WINDOWS: Array<{ days: number; label: string }> = [
  { days: 1, label: '24h' },
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
];

type SortKey = keyof Omit<PageRow, 'lastAccessAt'> | 'lastAccessAt';

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '—';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) return `${totalMinutes}m ${seconds}s`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const diff = Date.now() - then;
  if (diff < 0) return 'just now';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

const COLUMNS: Array<{ key: SortKey; label: string; numeric: boolean; help: string }> = [
  { key: 'path', label: 'Page', numeric: false, help: 'Route template — dynamic permalinks are grouped (e.g. /scorecard/[symbol]/[date]).' },
  { key: 'uniqueUsers', label: 'Unique users', numeric: true, help: 'Distinct logged-in users who opened this page in the window.' },
  { key: 'accesses', label: 'Accesses', numeric: true, help: 'Total page opens, logged-in and anonymous.' },
  { key: 'loggedInAccesses', label: 'Logged-in', numeric: true, help: 'Page opens attributed to a signed-in user.' },
  { key: 'avgDurationMs', label: 'Avg time', numeric: true, help: 'Mean active (tab-visible) time per visit, over visits where time was measured.' },
  { key: 'totalDurationMs', label: 'Total time', numeric: true, help: 'Sum of active time across all visits.' },
  { key: 'lastAccessAt', label: 'Last seen', numeric: false, help: 'Most recent visit.' },
];

export default function PageAnalyticsClient() {
  const cardBg = 'var(--color-surface)';
  const mutedText = 'var(--color-text-secondary)';
  const textColor = 'var(--color-text-primary)';
  const borderColor = 'var(--color-border)';

  const [windowDays, setWindowDays] = useState<number>(7);
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('accesses');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async (days: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics/pages?days=${days}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        setError(res.status === 403 ? 'Admin access required' : `Failed to load analytics (HTTP ${res.status})`);
        setData(null);
        setLoading(false);
        return;
      }
      const json = (await res.json()) as Snapshot;
      setData(json);
      setError(null);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      void load(windowDays);
    };
    run();
    const interval = setInterval(run, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [windowDays, load]);

  const sortedPages = useMemo(() => {
    if (!data) return [];
    const rows = [...data.pages];
    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (sortKey === 'path') return a.path.localeCompare(b.path) * dir;
      if (sortKey === 'lastAccessAt') {
        const av = a.lastAccessAt ? new Date(a.lastAccessAt).getTime() : 0;
        const bv = b.lastAccessAt ? new Date(b.lastAccessAt).getTime() : 0;
        return (av - bv) * dir;
      }
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
    return rows;
  }, [data, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Text columns default to ascending; numeric/time to descending.
      setSortDir(key === 'path' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-semibold" style={{ color: textColor }}>Page Analytics</h1>
        <div className="flex gap-1">
          {WINDOWS.map((w) => {
            const active = w.days === windowDays;
            return (
              <button
                key={w.days}
                type="button"
                onClick={() => setWindowDays(w.days)}
                className="px-3 py-1.5 text-sm font-semibold rounded-md"
                style={{
                  color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: active ? 'var(--color-surface)' : 'transparent',
                  border: `1px solid ${active ? 'var(--color-warning)' : 'var(--color-border)'}`,
                }}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs mb-6" style={{ color: mutedText }}>
        First-party per-page engagement for signed-in and anonymous visitors. Active time counts
        only while a tab is visible. Data is retained for {data?.retentionDays ?? 180} days.
      </p>

      {loading && !data ? (
        <LoadingSpinner size="lg" />
      ) : error ? (
        <ErrorMessage message={error} onRetry={() => load(windowDays)} />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatTile label="Unique users (logged in)" value={formatNumber(data.totals.uniqueUsers)} cardBg={cardBg} borderColor={borderColor} textColor={textColor} mutedText={mutedText} />
            <StatTile label="Total accesses" value={formatNumber(data.totals.accesses)} cardBg={cardBg} borderColor={borderColor} textColor={textColor} mutedText={mutedText} />
            <StatTile label="Avg time / visit" value={formatDuration(data.totals.avgDurationMs)} cardBg={cardBg} borderColor={borderColor} textColor={textColor} mutedText={mutedText} />
            <StatTile label="Total time on site" value={formatDuration(data.totals.totalDurationMs)} cardBg={cardBg} borderColor={borderColor} textColor={textColor} mutedText={mutedText} />
          </div>

          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ color: textColor }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface)' }}>
                    {COLUMNS.map((col) => {
                      const active = col.key === sortKey;
                      return (
                        <th
                          key={col.key}
                          scope="col"
                          title={col.help}
                          onClick={() => onSort(col.key)}
                          className={`px-3 py-2.5 font-semibold cursor-pointer select-none whitespace-nowrap ${col.numeric ? 'text-right' : 'text-left'}`}
                          style={{ color: active ? 'var(--color-text-primary)' : mutedText, borderBottom: `1px solid ${borderColor}` }}
                        >
                          {col.label}
                          {active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedPages.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="px-3 py-8 text-center" style={{ color: mutedText }}>
                        No page views recorded in this window yet.
                      </td>
                    </tr>
                  ) : (
                    sortedPages.map((row, i) => (
                      <tr key={row.path} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--color-surface)' }}>
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap" style={{ color: textColor }}>{row.path}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.uniqueUsers)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.accesses)}</td>
                        <td className="px-3 py-2 text-right tabular-nums" style={{ color: mutedText }}>{formatNumber(row.loggedInAccesses)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatDuration(row.avgDurationMs)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatDuration(row.totalDurationMs)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: mutedText }}>{formatRelative(row.lastAccessAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs mt-3" style={{ color: mutedText }}>
            {formatNumber(sortedPages.length)} pages · updated {formatRelative(data.generatedAt)} · auto-refreshes every 60s
          </p>
        </>
      ) : null}
    </div>
  );
}

type StatTileProps = {
  label: string;
  value: string;
  cardBg: string;
  borderColor: string;
  textColor: string;
  mutedText: string;
};

function StatTile({ label, value, cardBg, borderColor, textColor, mutedText }: StatTileProps) {
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
      <div className="text-xs mb-1" style={{ color: mutedText }}>{label}</div>
      <div className="text-2xl font-semibold tabular-nums" style={{ color: textColor }}>{value}</div>
    </div>
  );
}
