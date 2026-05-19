'use client';

import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

type SignupPoint = {
  day: string;
  basic: number;
  pro: number;
};

type Snapshot = {
  ok: boolean;
  signups: SignupPoint[];
  hourly: SnapshotPoint[];
  daily: SnapshotPoint[];
  topIps: Array<{ ip: string; count: number }>;
  topUsers: Array<{ userId: string; email: string | null; count: number }>;
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

  const topIpsMax = data.topIps[0]?.count ?? 0;
  const topUsersMax = data.topUsers[0]?.count ?? 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Admin Monitoring</h1>
      </div>

      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-lg font-semibold" style={{ color: textColor }}>User Signups</h2>
          <span className="text-xs" style={{ color: mutedText }}>Daily snapshot of total Basic and Pro users; the latest sample overwrites today&apos;s point.</span>
        </div>
        <SignupChartCard
          data={data.signups}
          cardBg={cardBg}
          axisStroke={axisStroke}
          mutedText={mutedText}
        />
      </section>

      {METRICS.map((metric) => (
        <section key={metric.key} className="mb-8">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-lg font-semibold" style={{ color: textColor }}>{metric.title}</h2>
            <span className="text-xs" style={{ color: mutedText }}>{metric.description}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard
              title="Hourly"
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
              title="Daily"
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
        <h2 className="text-lg font-semibold mb-2" style={{ color: textColor }}>Top Source IPs</h2>
        <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
          {data.topIps.length === 0 ? (
            <div className="text-sm" style={{ color: mutedText }}>No IP data captured yet.</div>
          ) : (
            <RankedBarList
              items={data.topIps.map((row) => ({ key: row.ip, label: row.ip, count: row.count }))}
              max={topIpsMax}
              color="var(--color-bear)"
              borderColor={borderColor}
              mutedText={mutedText}
              monoLabel
            />
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2" style={{ color: textColor }}>Top Users</h2>
        <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
          {data.topUsers.length === 0 ? (
            <div className="text-sm" style={{ color: mutedText }}>No user data captured yet.</div>
          ) : (
            <RankedBarList
              items={data.topUsers.map((row) => ({
                key: row.userId,
                label: row.email ?? row.userId,
                count: row.count,
              }))}
              max={topUsersMax}
              color="var(--color-warning)"
              borderColor={borderColor}
              mutedText={mutedText}
            />
          )}
        </div>
      </section>
    </div>
  );
}

type RankedBarListProps = {
  items: Array<{ key: string; label: string; count: number }>;
  max: number;
  color: string;
  borderColor: string;
  mutedText: string;
  monoLabel?: boolean;
};

function RankedBarList({ items, max, color, borderColor, mutedText, monoLabel }: RankedBarListProps) {
  return (
    <ol className="space-y-1.5">
      {items.map((row, idx) => {
        const pct = max > 0 ? Math.max(2, (row.count / max) * 100) : 0;
        return (
          <li
            key={row.key}
            className="grid items-center gap-3 text-sm py-1"
            style={{
              gridTemplateColumns: '2rem minmax(0, 1fr) minmax(0, 2fr) auto',
              borderBottom: `1px solid ${borderColor}33`,
            }}
          >
            <span className="text-xs tabular-nums" style={{ color: mutedText }}>{idx + 1}</span>
            <span className={`truncate ${monoLabel ? 'font-mono' : ''}`} title={row.label}>{row.label}</span>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${borderColor}55` }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="tabular-nums text-right">{row.count.toLocaleString()}</span>
          </li>
        );
      })}
    </ol>
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
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
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
              cursor={{ fill: 'var(--color-text-primary)', fillOpacity: 0.08 }}
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
            <Bar dataKey={metricKey} fill={color} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </MobileScrollableChart>
    </div>
  );
}

type SignupChartCardProps = {
  data: SignupPoint[];
  cardBg: string;
  axisStroke: string;
  mutedText: string;
};

const BASIC_COLOR = 'var(--color-warning)';
const PRO_COLOR = 'var(--color-bull)';

function SignupChartCard({ data, cardBg, axisStroke, mutedText }: SignupChartCardProps) {
  const latest = data.length > 0 ? data[data.length - 1] : { basic: 0, pro: 0 };
  const total = latest.basic + latest.pro;
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: axisStroke }}>Daily Total</h3>
        <div className="flex items-center gap-4 text-xs" style={{ color: mutedText }}>
          <span><span style={{ color: PRO_COLOR }}>●</span> Pro: {latest.pro.toLocaleString()}</span>
          <span><span style={{ color: BASIC_COLOR }}>●</span> Basic: {latest.basic.toLocaleString()}</span>
          <span>Total: {total.toLocaleString()}</span>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="text-sm py-12 text-center" style={{ color: mutedText }}>No signup data captured yet.</div>
      ) : (
        <MobileScrollableChart>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeOpacity={0.1} vertical={false} />
              <XAxis
                dataKey="day"
                stroke={axisStroke}
                tick={{ fill: axisStroke, fontSize: 10 }}
                tickLine={false}
                minTickGap={40}
                tickFormatter={formatDayLabel}
              />
              <YAxis
                stroke={axisStroke}
                tick={{ fill: axisStroke, fontSize: 10 }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  const basic = Number(payload.find((p) => p.dataKey === 'basic')?.value ?? 0);
                  const pro = Number(payload.find((p) => p.dataKey === 'pro')?.value ?? 0);
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                    >
                      <div className="font-semibold mb-1">{formatDayLabel(String(label))}</div>
                      <div style={{ color: PRO_COLOR }}>Pro: {pro.toLocaleString()}</div>
                      <div style={{ color: BASIC_COLOR }}>Basic: {basic.toLocaleString()}</div>
                      <div className="mt-1">Total: {(basic + pro).toLocaleString()}</div>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                height={28}
                iconType="square"
                wrapperStyle={{ fontSize: 12, color: axisStroke }}
              />
              <Area
                type="monotone"
                dataKey="basic"
                name="Basic"
                stackId="signups"
                stroke={BASIC_COLOR}
                fill={BASIC_COLOR}
                fillOpacity={0.4}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="pro"
                name="Pro"
                stackId="signups"
                stroke={PRO_COLOR}
                fill={PRO_COLOR}
                fillOpacity={0.4}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </MobileScrollableChart>
      )}
    </div>
  );
}
