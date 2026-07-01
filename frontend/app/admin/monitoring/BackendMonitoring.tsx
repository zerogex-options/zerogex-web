'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import { formatDayLabel, formatHourLabel, lighten } from './monitoringHelpers';

type BackendPoint = {
  bucket: string;
  cpuAvg: number | null;
  cpuMax: number | null;
  memAvg: number | null;
  memMax: number | null;
  cycleAvg: number | null;
  cycleMax: number | null;
  cycleMedian: number | null;
  diskRootLatest: number | null;
  diskVarLogLatest: number | null;
  ingestionErrors: number;
  ingestionWarnings: number;
  analyticsErrors: number;
  analyticsWarnings: number;
  signalsErrors: number;
  signalsWarnings: number;
  apiErrors: number;
  apiWarnings: number;
};

type BackendSnapshot = {
  ok: boolean;
  hourly: BackendPoint[];
  daily: BackendPoint[];
  lastSampleIso: string | null;
  generatedAt: string;
};

// One brand color per row on the Backend tab. Order matches the rows below:
// 1. CPU, 2. Memory, 3. Cycle Time, 4. Disk
// 5. Ingestion errors/warnings, 6. Analytics errors/warnings
// 7. Signals errors/warnings, 8. API errors/warnings
const ROW_COLORS = {
  cpu: '#003f5c',
  mem: '#2c4875',
  cycle: '#8a508f',
  disk: '#bc5090',
  ingestion: '#ff6361',
  analytics: '#ff8531',
  signals: '#ffa600',
  api: '#ffd380',
} as const;

type LineSeries<TKey extends keyof BackendPoint> = {
  key: TKey;
  name: string;
  color: string;
};

type LineRow = {
  title: string;
  description: string;
  unit: 'pct' | 'sec';
  series: LineSeries<keyof BackendPoint>[];
};

type StackedRow = {
  title: string;
  description: string;
  brandColor: string;
  errorsKey: keyof BackendPoint;
  warningsKey: keyof BackendPoint;
};

export default function BackendMonitoring() {
  const cardBg = 'var(--color-surface)';
  const mutedText = 'var(--color-text-secondary)';
  const textColor = 'var(--color-text-primary)';
  const borderColor = 'var(--color-border)';
  const axisStroke = 'var(--color-text-primary)';

  const [data, setData] = useState<BackendSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/monitoring/backend', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!res.ok) {
          if (!cancelled) {
            setError(
              res.status === 403
                ? 'Admin access required'
                : `Failed to load backend monitoring data (HTTP ${res.status})`,
            );
            setLoading(false);
          }
          return;
        }
        const json = (await res.json()) as BackendSnapshot;
        if (!cancelled) {
          setData(json);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load backend monitoring data');
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

  const lineRows: LineRow[] = useMemo(
    () => [
      {
        title: 'CPU Utilization',
        description: 'Per-bucket CPU% — line for the mean and a separate line for the peak across 1-minute samples.',
        unit: 'pct',
        series: [
          { key: 'cpuAvg', name: 'Avg', color: lighten(ROW_COLORS.cpu, 0.45) },
          { key: 'cpuMax', name: 'Max', color: ROW_COLORS.cpu },
        ],
      },
      {
        title: 'Memory Utilization',
        description: 'Per-bucket memory% (1 − MemAvailable/MemTotal) — mean and peak across 1-minute samples.',
        unit: 'pct',
        series: [
          { key: 'memAvg', name: 'Avg', color: lighten(ROW_COLORS.mem, 0.45) },
          { key: 'memMax', name: 'Max', color: ROW_COLORS.mem },
        ],
      },
      {
        title: 'Analytics Cycle Time',
        description: 'Per-bucket analytics cycle duration (seconds) — avg, max, and median across the bucket.',
        unit: 'sec',
        series: [
          { key: 'cycleAvg', name: 'Avg', color: lighten(ROW_COLORS.cycle, 0.55) },
          { key: 'cycleMedian', name: 'Median', color: lighten(ROW_COLORS.cycle, 0.25) },
          { key: 'cycleMax', name: 'Max', color: ROW_COLORS.cycle },
        ],
      },
      {
        title: 'Disk Utilization',
        description: 'Most recent df reading per bucket for / and /var/log (avg ignored).',
        unit: 'pct',
        series: [
          { key: 'diskRootLatest', name: '/', color: ROW_COLORS.disk },
          { key: 'diskVarLogLatest', name: '/var/log', color: lighten(ROW_COLORS.disk, 0.45) },
        ],
      },
    ],
    [],
  );

  const stackedRows: StackedRow[] = useMemo(
    () => [
      {
        title: 'Ingestion Engine (zerogex-oa-ingestion)',
        description: '- ERROR - and - WARNING - log lines from the ingestion systemd unit per bucket.',
        brandColor: ROW_COLORS.ingestion,
        errorsKey: 'ingestionErrors',
        warningsKey: 'ingestionWarnings',
      },
      {
        title: 'Analytics Engine (zerogex-oa-analytics)',
        description: '- ERROR - and - WARNING - log lines from the analytics systemd unit per bucket.',
        brandColor: ROW_COLORS.analytics,
        errorsKey: 'analyticsErrors',
        warningsKey: 'analyticsWarnings',
      },
      {
        title: 'Signals Engine (zerogex-oa-signals)',
        description: '- ERROR - and - WARNING - log lines from the signals systemd unit per bucket.',
        brandColor: ROW_COLORS.signals,
        errorsKey: 'signalsErrors',
        warningsKey: 'signalsWarnings',
      },
      {
        title: 'API Engine (zerogex-oa-api)',
        description: '- ERROR - and - WARNING - log lines from the API systemd unit per bucket.',
        brandColor: ROW_COLORS.api,
        errorsKey: 'apiErrors',
        warningsKey: 'apiWarnings',
      },
    ],
    [],
  );

  if (loading) return <LoadingSpinner size="lg" />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  return (
    <div>
      {lineRows.map((row) => (
        <section key={row.title} className="mb-8">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-lg font-semibold" style={{ color: textColor }}>
              {row.title}
            </h2>
            <span className="text-xs" style={{ color: mutedText }}>
              {row.description}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LineChartCard
              title="Hourly"
              data={data.hourly}
              series={row.series}
              unit={row.unit}
              cardBg={cardBg}
              borderColor={borderColor}
              axisStroke={axisStroke}
              mutedText={mutedText}
              labelFormatter={formatHourLabel}
            />
            <LineChartCard
              title="Daily"
              data={data.daily}
              series={row.series}
              unit={row.unit}
              cardBg={cardBg}
              borderColor={borderColor}
              axisStroke={axisStroke}
              mutedText={mutedText}
              labelFormatter={formatDayLabel}
            />
          </div>
        </section>
      ))}

      {stackedRows.map((row) => (
        <section key={row.title} className="mb-8">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-lg font-semibold" style={{ color: textColor }}>
              {row.title}
            </h2>
            <span className="text-xs" style={{ color: mutedText }}>
              {row.description}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StackedBarCard
              title="Hourly"
              data={data.hourly}
              errorsKey={row.errorsKey}
              warningsKey={row.warningsKey}
              brandColor={row.brandColor}
              cardBg={cardBg}
              borderColor={borderColor}
              axisStroke={axisStroke}
              mutedText={mutedText}
              labelFormatter={formatHourLabel}
            />
            <StackedBarCard
              title="Daily"
              data={data.daily}
              errorsKey={row.errorsKey}
              warningsKey={row.warningsKey}
              brandColor={row.brandColor}
              cardBg={cardBg}
              borderColor={borderColor}
              axisStroke={axisStroke}
              mutedText={mutedText}
              labelFormatter={formatDayLabel}
            />
          </div>
        </section>
      ))}
    </div>
  );
}

function formatValue(value: number | null | undefined, unit: 'pct' | 'sec'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (unit === 'pct') return `${value.toFixed(1)}%`;
  return `${value.toFixed(2)}s`;
}

type LineChartCardProps = {
  title: string;
  data: BackendPoint[];
  series: LineSeries<keyof BackendPoint>[];
  unit: 'pct' | 'sec';
  cardBg: string;
  borderColor: string;
  axisStroke: string;
  mutedText: string;
  labelFormatter: (bucket: string) => string;
};

function LineChartCard({
  title,
  data,
  series,
  unit,
  cardBg,
  axisStroke,
  mutedText,
  labelFormatter,
}: LineChartCardProps) {
  // Headline peak: largest finite value across all series in the window.
  const peak = useMemo(() => {
    let m = 0;
    let any = false;
    for (const point of data) {
      for (const s of series) {
        const raw = point[s.key];
        const v = typeof raw === 'number' ? raw : null;
        if (v !== null && Number.isFinite(v)) {
          if (!any || v > m) m = v;
          any = true;
        }
      }
    }
    return any ? m : null;
  }, [data, series]);
  const latestPoint = data.length > 0 ? data[data.length - 1] : null;
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: axisStroke }}>
          {title}
        </h3>
        <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: mutedText }}>
          {series.map((s) => {
            const raw = latestPoint ? latestPoint[s.key] : null;
            const v = typeof raw === 'number' ? raw : null;
            return (
              <span key={String(s.key)}>
                <span style={{ color: s.color }}>●</span> {s.name}: {formatValue(v, unit)}
              </span>
            );
          })}
          <span>Peak: {formatValue(peak, unit)}</span>
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
              tickFormatter={(v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return '--';
                return unit === 'pct' ? `${n}%` : `${n}s`;
              }}
              domain={unit === 'pct' ? [0, 100] : ['auto', 'auto']}
            />
            <Tooltip
              cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div
                    className="rounded-lg border px-3 py-2 text-xs"
                    style={{
                      backgroundColor: 'var(--color-chart-tooltip-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-chart-tooltip-text)',
                    }}
                  >
                    <div className="font-semibold mb-1">{labelFormatter(String(label))}</div>
                    {series.map((s) => {
                      const entry = payload.find((p) => p.dataKey === s.key);
                      const v = entry?.value;
                      const numeric = typeof v === 'number' ? v : null;
                      return (
                        <div key={String(s.key)}>
                          <span style={{ color: s.color }}>●</span> {s.name}: {formatValue(numeric, unit)}
                        </div>
                      );
                    })}
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
            {series.map((s) => (
              <Line
                key={String(s.key)}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </MobileScrollableChart>
    </div>
  );
}

type StackedBarCardProps = {
  title: string;
  data: BackendPoint[];
  errorsKey: keyof BackendPoint;
  warningsKey: keyof BackendPoint;
  brandColor: string;
  cardBg: string;
  borderColor: string;
  axisStroke: string;
  mutedText: string;
  labelFormatter: (bucket: string) => string;
};

function StackedBarCard({
  title,
  data,
  errorsKey,
  warningsKey,
  brandColor,
  cardBg,
  axisStroke,
  mutedText,
  labelFormatter,
}: StackedBarCardProps) {
  const errorsColor = brandColor;
  const warningsColor = lighten(brandColor, 0.45);
  const { errorsTotal, warningsTotal } = useMemo(() => {
    let e = 0;
    let w = 0;
    for (const point of data) {
      const ev = point[errorsKey];
      const wv = point[warningsKey];
      if (typeof ev === 'number') e += ev;
      if (typeof wv === 'number') w += wv;
    }
    return { errorsTotal: e, warningsTotal: w };
  }, [data, errorsKey, warningsKey]);
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: axisStroke }}>
          {title}
        </h3>
        <div className="flex items-center gap-3 text-xs" style={{ color: mutedText }}>
          <span>
            <span style={{ color: errorsColor }}>●</span> Errors: {errorsTotal.toLocaleString()}
          </span>
          <span>
            <span style={{ color: warningsColor }}>●</span> Warnings: {warningsTotal.toLocaleString()}
          </span>
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
                const errVal = Number(payload.find((p) => p.dataKey === errorsKey)?.value ?? 0);
                const warnVal = Number(payload.find((p) => p.dataKey === warningsKey)?.value ?? 0);
                return (
                  <div
                    className="rounded-lg border px-3 py-2 text-xs"
                    style={{
                      backgroundColor: 'var(--color-chart-tooltip-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-chart-tooltip-text)',
                    }}
                  >
                    <div className="font-semibold mb-1">{labelFormatter(String(label))}</div>
                    <div>
                      <span style={{ color: errorsColor }}>●</span> Errors: {errVal.toLocaleString()}
                    </div>
                    <div>
                      <span style={{ color: warningsColor }}>●</span> Warnings: {warnVal.toLocaleString()}
                    </div>
                    <div className="mt-1">Total: {(errVal + warnVal).toLocaleString()}</div>
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
            <Bar dataKey={warningsKey} name="Warnings" stackId="logs" fill={warningsColor} isAnimationActive={false} />
            <Bar dataKey={errorsKey} name="Errors" stackId="logs" fill={errorsColor} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </MobileScrollableChart>
    </div>
  );
}
