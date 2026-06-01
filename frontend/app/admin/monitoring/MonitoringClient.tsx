'use client';

import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import BackendMonitoring from './BackendMonitoring';
import { formatDayLabel, formatHourLabel, lighten, niceYScale } from './monitoringHelpers';

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
  disclaimer: number;
};

type WebhookHealth = {
  errors24h: number;
  errors7d: number;
  orphans24h: number;
  orphans7d: number;
  staleSkipped24h: number;
  staleSkipped7d: number;
  paymentFailed24h: number;
  paymentFailed7d: number;
  foundingRedeemed: number;
  foundingLifetimeApplied: number;
  recentErrors: Array<{ createdAt: string; message: string }>;
};

type Snapshot = {
  ok: boolean;
  signups: SignupPoint[];
  hourly: SnapshotPoint[];
  daily: SnapshotPoint[];
  topIps: Array<{ ip: string; count: number }>;
  topUsers: Array<{ userId: string; email: string | null; count: number }>;
  webhookHealth: WebhookHealth;
  lastFlushAt: string | null;
  generatedAt: string;
};

type MetricKey = 'apiCalls' | 'pageAccesses' | 'uniqueUsers' | 'uniqueIps';

// One brand color per row on this page. Order matches the rows below:
// 1. User Signups (signups + disclaimer acceptance)
// 2. API Calls
// 3. Page Accesses
// 4. Unique Users (Logged In)
// 5. Unique Source IPs
// 6. Top Source IPs
// 7. Top Users
// 8. Stripe Webhook Health
const ROW_COLORS = {
  signups: '#2c4875',
  apiCalls: '#8a508f',
  pageAccesses: '#bc5090',
  uniqueUsers: '#ff6361',
  uniqueIps: '#ff8531',
  topIps: '#ffa600',
  topUsers: '#ffd380',
  webhookHealth: '#003f5c',
} as const;

const METRICS: Array<{ key: MetricKey; title: string; color: string; description: string }> = [
  { key: 'apiCalls', title: 'API Calls', color: ROW_COLORS.apiCalls, description: 'Total requests to /api/* per bucket.' },
  { key: 'pageAccesses', title: 'Page Accesses', color: ROW_COLORS.pageAccesses, description: 'Server-rendered page hits per bucket (excludes Next.js client-side route changes).' },
  { key: 'uniqueUsers', title: 'Unique Users (Logged In)', color: ROW_COLORS.uniqueUsers, description: 'Distinct authenticated users active during the bucket.' },
  { key: 'uniqueIps', title: 'Unique Source IPs', color: ROW_COLORS.uniqueIps, description: 'Distinct client IPs observed during the bucket.' },
];

type TabId = 'frontend' | 'backend';

export default function MonitoringClient() {
  const cardBg = 'var(--color-surface)';
  const mutedText = 'var(--color-text-secondary)';
  const textColor = 'var(--color-text-primary)';
  const borderColor = 'var(--color-border)';
  const axisStroke = 'var(--color-text-primary)';

  const [tab, setTab] = useState<TabId>('frontend');
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab !== 'frontend') return;
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
  }, [tab]);

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'frontend', label: 'Frontend' },
    { id: 'backend', label: 'Backend' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Admin Monitoring</h1>
      </div>

      <div className="flex gap-2 mb-6 border-b" style={{ borderColor: borderColor }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
              style={{
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                borderBottom: active ? '2px solid var(--color-warning)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'frontend' && (
        <FrontendTab
          loading={loading}
          error={error}
          data={data}
          cardBg={cardBg}
          borderColor={borderColor}
          axisStroke={axisStroke}
          mutedText={mutedText}
          textColor={textColor}
        />
      )}
      {tab === 'backend' && <BackendMonitoring />}
    </div>
  );
}

type FrontendTabProps = {
  loading: boolean;
  error: string | null;
  data: Snapshot | null;
  cardBg: string;
  borderColor: string;
  axisStroke: string;
  mutedText: string;
  textColor: string;
};

function FrontendTab({ loading, error, data, cardBg, borderColor, axisStroke, mutedText, textColor }: FrontendTabProps) {
  if (loading) return <LoadingSpinner size="lg" />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  const topIpsMax = data.topIps[0]?.count ?? 0;
  const topUsersMax = data.topUsers[0]?.count ?? 0;
  const signupYScale = niceYScale(
    data.signups.reduce((m, p) => Math.max(m, p.basic + p.pro), 0),
  );

  return (
    <div>
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-lg font-semibold" style={{ color: textColor }}>User Signups</h2>
          <span className="text-xs" style={{ color: mutedText }}>Daily snapshot of total Basic and Pro users and disclaimer acceptance; the latest sample overwrites today&apos;s point.</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SignupChartCard
            data={data.signups}
            cardBg={cardBg}
            axisStroke={axisStroke}
            mutedText={mutedText}
            brandColor={ROW_COLORS.signups}
            yScale={signupYScale}
          />
          <DisclaimerChartCard
            data={data.signups}
            cardBg={cardBg}
            axisStroke={axisStroke}
            mutedText={mutedText}
            brandColor={ROW_COLORS.signups}
            yScale={signupYScale}
          />
        </div>
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
              color={ROW_COLORS.topIps}
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
              color={ROW_COLORS.topUsers}
              borderColor={borderColor}
              mutedText={mutedText}
            />
          )}
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-lg font-semibold" style={{ color: textColor }}>Stripe Webhook Health</h2>
          <span className="text-xs" style={{ color: mutedText }}>
            audit_events roll-up. Errors &gt; 0 in 24h means handler failures Stripe will keep retrying.
          </span>
        </div>
        <WebhookHealthCard
          health={data.webhookHealth}
          cardBg={cardBg}
          borderColor={borderColor}
          mutedText={mutedText}
          textColor={textColor}
        />
      </section>
    </div>
  );
}

type StatCellProps = {
  label: string;
  primary: number;
  secondaryLabel: string;
  secondary: number;
  alert: boolean;
  borderColor: string;
  mutedText: string;
  textColor: string;
};

function StatCell({ label, primary, secondaryLabel, secondary, alert, borderColor, mutedText, textColor }: StatCellProps) {
  const alertColor = 'var(--color-bear)';
  return (
    <div
      className="rounded-lg p-3"
      style={{
        border: `1px solid ${alert ? alertColor : `${borderColor}55`}`,
        backgroundColor: alert ? 'var(--color-bear-soft)' : 'transparent',
      }}
    >
      <div className="text-xs uppercase tracking-wide" style={{ color: mutedText }}>{label}</div>
      <div
        className="text-3xl font-bold tabular-nums mt-1"
        style={{ color: alert ? alertColor : textColor }}
      >
        {primary.toLocaleString()}
      </div>
      <div className="text-xs mt-1 tabular-nums" style={{ color: mutedText }}>
        {secondaryLabel}: {secondary.toLocaleString()}
      </div>
    </div>
  );
}

function FoundingStatCell({
  label,
  count,
  borderColor,
  mutedText,
  textColor,
}: {
  label: string;
  count: number;
  borderColor: string;
  mutedText: string;
  textColor: string;
}) {
  return (
    <div className="rounded-lg p-3" style={{ border: `1px solid ${borderColor}55` }}>
      <div className="text-xs uppercase tracking-wide" style={{ color: mutedText }}>{label}</div>
      <div className="text-3xl font-bold tabular-nums mt-1" style={{ color: textColor }}>
        {count.toLocaleString()}
      </div>
      <div className="text-xs mt-1" style={{ color: mutedText }}>all-time</div>
    </div>
  );
}

function WebhookHealthCard({
  health,
  cardBg,
  borderColor,
  mutedText,
  textColor,
}: {
  health: WebhookHealth;
  cardBg: string;
  borderColor: string;
  mutedText: string;
  textColor: string;
}) {
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCell
          label="Errors"
          primary={health.errors24h}
          secondaryLabel="7d"
          secondary={health.errors7d}
          alert={health.errors24h > 0}
          borderColor={borderColor}
          mutedText={mutedText}
          textColor={textColor}
        />
        <StatCell
          label="Orphans"
          primary={health.orphans24h}
          secondaryLabel="7d"
          secondary={health.orphans7d}
          alert={false}
          borderColor={borderColor}
          mutedText={mutedText}
          textColor={textColor}
        />
        <StatCell
          label="Stale Skipped"
          primary={health.staleSkipped24h}
          secondaryLabel="7d"
          secondary={health.staleSkipped7d}
          alert={false}
          borderColor={borderColor}
          mutedText={mutedText}
          textColor={textColor}
        />
        <StatCell
          label="Payment Failed"
          primary={health.paymentFailed24h}
          secondaryLabel="7d"
          secondary={health.paymentFailed7d}
          alert={health.paymentFailed24h > 0}
          borderColor={borderColor}
          mutedText={mutedText}
          textColor={textColor}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <FoundingStatCell
          label="Founding redemptions"
          count={health.foundingRedeemed}
          borderColor={borderColor}
          mutedText={mutedText}
          textColor={textColor}
        />
        <FoundingStatCell
          label="Lifetime coupons applied"
          count={health.foundingLifetimeApplied}
          borderColor={borderColor}
          mutedText={mutedText}
          textColor={textColor}
        />
      </div>

      {health.recentErrors.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2" style={{ color: textColor }}>
            Recent errors (last 7 days)
          </h3>
          <ul className="space-y-2">
            {health.recentErrors.map((err, idx) => (
              <li
                key={`${err.createdAt}-${idx}`}
                className="rounded p-2 text-xs"
                style={{
                  border: `1px solid ${borderColor}55`,
                  fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                }}
              >
                <div style={{ color: mutedText }}>{err.createdAt}</div>
                <div className="mt-1 whitespace-pre-wrap break-words" style={{ color: textColor }}>
                  {err.message}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
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
  brandColor: string;
  yScale: { max: number; ticks: number[] };
};

function SignupChartCard({ data, cardBg, axisStroke, mutedText, brandColor, yScale }: SignupChartCardProps) {
  const proColor = brandColor;
  const basicColor = lighten(brandColor, 0.45);
  const latest = data.length > 0 ? data[data.length - 1] : { basic: 0, pro: 0 };
  const total = latest.basic + latest.pro;
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: axisStroke }}>Daily Total</h3>
        <div className="flex items-center gap-4 text-xs" style={{ color: mutedText }}>
          <span><span style={{ color: proColor }}>●</span> Pro: {latest.pro.toLocaleString()}</span>
          <span><span style={{ color: basicColor }}>●</span> Basic: {latest.basic.toLocaleString()}</span>
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
                domain={[0, yScale.max]}
                ticks={yScale.ticks}
                interval={0}
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
                      <div>Pro: {pro.toLocaleString()}</div>
                      <div>Basic: {basic.toLocaleString()}</div>
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
                stroke={basicColor}
                fill={basicColor}
                fillOpacity={0.5}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="pro"
                name="Pro"
                stackId="signups"
                stroke={proColor}
                fill={proColor}
                fillOpacity={0.5}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </MobileScrollableChart>
      )}
    </div>
  );
}

type DisclaimerChartCardProps = {
  data: SignupPoint[];
  cardBg: string;
  axisStroke: string;
  mutedText: string;
  brandColor: string;
  yScale: { max: number; ticks: number[] };
};

function DisclaimerChartCard({ data, cardBg, axisStroke, mutedText, brandColor, yScale }: DisclaimerChartCardProps) {
  const latest = data.length > 0 ? data[data.length - 1] : { disclaimer: 0 };
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: axisStroke }}>Disclaimer Acceptance</h3>
        <div className="flex items-center gap-4 text-xs" style={{ color: mutedText }}>
          <span><span style={{ color: brandColor }}>●</span> Accepted: {latest.disclaimer.toLocaleString()}</span>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="text-sm py-12 text-center" style={{ color: mutedText }}>No disclaimer data captured yet.</div>
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
                domain={[0, yScale.max]}
                ticks={yScale.ticks}
                interval={0}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  const disclaimer = Number(payload.find((p) => p.dataKey === 'disclaimer')?.value ?? 0);
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                    >
                      <div className="font-semibold mb-1">{formatDayLabel(String(label))}</div>
                      <div>Accepted: {disclaimer.toLocaleString()}</div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="disclaimer"
                name="Accepted"
                stroke={brandColor}
                fill={brandColor}
                fillOpacity={0.5}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </MobileScrollableChart>
      )}
    </div>
  );
}
