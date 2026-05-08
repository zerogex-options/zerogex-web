'use client';

import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/core/ThemeContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MobileScrollableChart from '@/components/MobileScrollableChart';

type SnapshotPoint = {
  bucket: string;
  apiCalls: number;
  pageAccesses: number;
  uniqueUsers: number;
  uniqueIps: number;
};

type Snapshot = {
  ok: boolean;
  hourly: SnapshotPoint[];
  daily: SnapshotPoint[];
  topIps: Array<{ ip: string; count: number }>;
  lastFlushAt: string | null;
  generatedAt: string;
};

type MetricKey = 'apiCalls' | 'pageAccesses' | 'uniqueUsers' | 'uniqueIps';

const METRICS: Array<{ key: MetricKey; title: string; color: string; description: string }> = [
  { key: 'apiCalls', title: 'API Calls', color: 'var(--color-bull)', description: 'Total requests to /api/* per bucket.' },
  { key: 'pageAccesses', title: 'Page Accesses', color: 'var(--color-positive)', description: 'Server-rendered page hits per bucket (excludes Next.js client-side route changes).' },
  { key: 'uniqueUsers', title: 'Unique Users (Logged In)', color: 'var(--color-warning)', description: 'Distinct authenticated users active during the bucket.' },
  { key: 'uniqueIps', title: 'Unique Source IPs', color: 'var(--color-bear)', description: 'Distinct client IPs observed during the bucket.' },
];

function formatHourLabel(bucket: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/.exec(bucket);
  if (!match) return bucket;
  return `${Number(match[2])}/${Number(match[3])} ${match[4]}:00`;
}

function formatDayLabel(bucket: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bucket);
  if (!match) return bucket;
  return `${Number(match[2])}/${Number(match[3])}`;
}

export default function MonitoringClient() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = 'var(--color-surface)';
  const mutedText = 'var(--color-text-secondary)';
  const textColor = isDark ? 'var(--color-text-primary)' : 'var(--color-surface)';
  const borderColor = 'var(--color-border)';
  const axisStroke = 'var(--color-text-primary)';

  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/monitoring', { cache: 'no-store', credentials: 'same-origin' });
        if (!res.ok) {
          if (!cancelled) {
            setError(res.status === 403 ? 'Admin access required' : `Failed to load monitoring data (HTTP ${res.status})`);
            setLoading(false);
          }
          return;
        }
        const json = (await res.json()) as Snapshot;
        if (!cancelled) {
          setData(json);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
          setLoading(false);
        }
      }
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) return <div className="container mx-auto px-4 py-8"><LoadingSpinner size="lg" /></div>;
  if (error) return <div className="container mx-auto px-4 py-8"><ErrorMessage message={error} /></div>;
  if (!data) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Admin Monitoring</h1>
        <div className="text-xs" style={{ color: mutedText }}>
          Generated: {data.generatedAt ? new Date(data.generatedAt).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '--'} ET
          {' · '}Last flush: {data.lastFlushAt ? new Date(data.lastFlushAt).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'never'}
          {' · Refreshes every 60s'}
        </div>
      </div>
      <p className="text-sm mb-6" style={{ color: mutedText }}>
        Hourly buckets show the last {data.hourly.length} ET hours; daily buckets show the last {data.daily.length} ET days.
      </p>

      {METRICS.map((metric) => (
        <section key={metric.key} className="mb-8">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-lg font-semibold" style={{ color: textColor }}>{metric.title}</h2>
            <span className="text-xs" style={{ color: mutedText }}>{metric.description}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard
              title="Hourly (last 720)"
              data={data.hourly}
              metricKey={metric.key}
              color={metric.color}
              cardBg={cardBg}
              borderColor={borderColor}
              axisStroke={axisStroke}
              mutedText={mutedText}
              labelFormatter={formatHourLabel}
            />
            <ChartCard
              title="Daily (last 90)"
              data={data.daily}
              metricKey={metric.key}
              color={metric.color}
              cardBg={cardBg}
              borderColor={borderColor}
              axisStroke={axisStroke}
              mutedText={mutedText}
              labelFormatter={formatDayLabel}
            />
          </div>
        </section>
      ))}

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2" style={{ color: textColor }}>Top Source IPs (by access count, retained window)</h2>
        <div className="rounded-lg p-4 overflow-x-auto" style={{ backgroundColor: cardBg }}>
          {data.topIps.length === 0 ? (
            <div className="text-sm" style={{ color: mutedText }}>No IP data captured yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor, color: mutedText }}>
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">IP Address</th>
                  <th className="py-2 px-2 text-right">Total Accesses</th>
                </tr>
              </thead>
              <tbody>
                {data.topIps.map((row, idx) => (
                  <tr key={row.ip} className="border-b" style={{ borderColor: `${borderColor}66` }}>
                    <td className="py-1.5 px-2" style={{ color: mutedText }}>{idx + 1}</td>
                    <td className="py-1.5 px-2 font-mono">{row.ip}</td>
                    <td className="py-1.5 px-2 text-right">{row.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

type ChartCardProps = {
  title: string;
  data: SnapshotPoint[];
  metricKey: MetricKey;
  color: string;
  cardBg: string;
  borderColor: string;
  axisStroke: string;
  mutedText: string;
  labelFormatter: (bucket: string) => string;
};

function ChartCard({ title, data, metricKey, color, cardBg, axisStroke, mutedText, labelFormatter }: ChartCardProps) {
  const total = useMemo(() => data.reduce((sum, point) => sum + (point[metricKey] ?? 0), 0), [data, metricKey]);
  const peak = useMemo(() => data.reduce((max, point) => Math.max(max, point[metricKey] ?? 0), 0), [data, metricKey]);
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: axisStroke }}>{title}</h3>
        <div className="text-xs" style={{ color: mutedText }}>
          Total: {total.toLocaleString()} · Peak: {peak.toLocaleString()}
        </div>
      </div>
      <MobileScrollableChart>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeOpacity={0.1} vertical={false} />
            <XAxis
              dataKey="bucket"
              stroke={axisStroke}
              tick={{ fill: axisStroke, fontSize: 10 }}
              tickLine={false}
              minTickGap={40}
              tickFormatter={labelFormatter}
            />
            <YAxis
              stroke={axisStroke}
              tick={{ fill: axisStroke, fontSize: 10 }}
              tickLine={false}
              allowDecimals={false}
              tickFormatter={(v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return '--';
                if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
                return String(n);
              }}
            />
            <Tooltip
              cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;
                const value = Number(payload[0]?.value ?? 0);
                return (
                  <div
                    className="rounded-lg border px-3 py-2 text-xs"
                    style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                  >
                    <div className="font-semibold">{labelFormatter(String(label))}</div>
                    <div>{value.toLocaleString()}</div>
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey={metricKey} stroke={color} dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </MobileScrollableChart>
    </div>
  );
}
