'use client';

import { useMemo } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Activity, Brain, Gauge, ShieldCheck, Sparkles } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTradesLive } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import { useTheme } from '@/core/ThemeContext';

type TradeRow = Record<string, unknown>;

type RatingAxis = {
  axis: string;
  score: number;
  note: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function toRows(data: unknown): TradeRow[] {
  if (Array.isArray(data)) return data as TradeRow[];
  if (data && typeof data === 'object') {
    const values = Object.values(data as Record<string, unknown>);
    const firstArray = values.find((value) => Array.isArray(value));
    if (Array.isArray(firstArray)) return firstArray as TradeRow[];
  }
  return [];
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getString(value: unknown): string {
  if (value == null) return '—';
  return String(value);
}

function formatMoney(value: number | null) {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatDate(value: unknown) {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return getString(value);
  return parsed.toLocaleString();
}

function ratingLabel(score: number) {
  if (score >= 70) return 'High Conviction Bullish';
  if (score >= 55) return 'Moderate Bullish';
  if (score <= 30) return 'High Conviction Bearish';
  if (score <= 45) return 'Moderate Bearish';
  return 'Balanced / Two-Way';
}

export default function TradingSignalsPage() {
  const { symbol } = useTimeframe();
  const { theme } = useTheme();
  const { data, loading, error, refetch } = useTradesLive(symbol, 5000);

  const rows = useMemo(() => toRows(data), [data]);

  const analytics = useMemo(() => {
    const netPremium = rows.reduce((sum, row) => sum + (getNumber(row.net_premium ?? row.premium) ?? 0), 0);
    const netVolume = rows.reduce((sum, row) => sum + (getNumber(row.net_volume ?? row.flow) ?? 0), 0);
    const scoreValues = rows
      .map((row) => getNumber(row.score ?? row.signal_score ?? row.composite_score))
      .filter((value): value is number => value != null);
    const averageScoreRaw = scoreValues.length
      ? scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length
      : 0;

    const bullishCount = rows.filter((row) => getString(row.flow_bias ?? row.trade_side ?? row.direction).toLowerCase().includes('bull')).length;
    const bearishCount = rows.filter((row) => getString(row.flow_bias ?? row.trade_side ?? row.direction).toLowerCase().includes('bear')).length;
    const breadth = rows.length ? bullishCount / rows.length : 0.5;

    const normalizedSignal = clamp(((averageScoreRaw + 100) / 200) * 100);
    const netFlowStrength = clamp(50 + Math.sign(netVolume) * Math.min(45, Math.log10(Math.abs(netVolume) + 1) * 12));
    const premiumPressure = clamp(50 + Math.sign(netPremium) * Math.min(45, Math.log10(Math.abs(netPremium) + 1) * 12));
    const directionalBreadth = clamp(breadth * 100);
    const consistency = clamp(100 - Math.min(100, (bearishCount > bullishCount ? bearishCount - bullishCount : bullishCount - bearishCount) * 8));

    const overall = clamp((normalizedSignal * 0.36) + (netFlowStrength * 0.2) + (premiumPressure * 0.2) + (directionalBreadth * 0.14) + (consistency * 0.1));

    const radarAxes: RatingAxis[] = [
      { axis: 'Signal', score: normalizedSignal, note: 'Mean score strength from live rows' },
      { axis: 'Flow', score: netFlowStrength, note: 'Net directional contract flow pressure' },
      { axis: 'Premium', score: premiumPressure, note: 'Dollar premium pressure behind moves' },
      { axis: 'Breadth', score: directionalBreadth, note: 'Percent of rows aligned bullish' },
      { axis: 'Consistency', score: consistency, note: 'How concentrated the tape is in one direction' },
    ];

    return {
      netPremium,
      netVolume,
      bullishCount,
      bearishCount,
      normalizedSignal,
      overall,
      radarAxes,
      label: ratingLabel(overall),
    };
  }, [rows]);

  if (loading && !data) {
    return <LoadingSpinner size="lg" />;
  }

  const scoreColor = analytics.overall >= 55 ? 'var(--color-bull)' : analytics.overall <= 45 ? 'var(--color-bear)' : 'var(--color-warning)';

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Trade Ideas</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Real-time flow intelligence for fast trade selection and directional conviction.
      </p>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section
        className="mb-8 rounded-2xl border border-[var(--color-border)] p-6"
        style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Live Composite Trade Feel</div>
            <div className="text-5xl font-black leading-none" style={{ color: scoreColor }}>{analytics.overall.toFixed(1)}</div>
            <div className="mt-2 text-lg font-semibold">{analytics.label}</div>
            <div className="mt-4 text-sm text-[var(--color-text-secondary)] max-w-xl">
              This rating blends score quality, flow pressure, premium conviction, directional breadth, and consistency so you can quickly gauge whether to favor momentum continuation or mean-reversion setups.
            </div>
          </div>
          <div className="w-full lg:w-[430px] h-[300px] rounded-xl border border-[var(--color-border)] p-2" style={{ backgroundColor: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={analytics.radarAxes} outerRadius="72%">
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
                <Radar dataKey="score" name="Score" stroke="var(--color-brand-accent)" fill="var(--color-brand-accent)" fillOpacity={0.46} />
                <Tooltip
                  contentStyle={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10 }}
                  formatter={(value, _name, item) => [`${Number(value).toFixed(1)}/100`, String((item.payload as RatingAxis).note)]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Live Signals" value={rows.length} tooltip="Current number of live rows feeding the model." theme="dark" />
        <MetricCard
          title="Net Premium"
          value={formatMoney(analytics.netPremium)}
          trend={analytics.netPremium > 0 ? 'bullish' : analytics.netPremium < 0 ? 'bearish' : 'neutral'}
          tooltip="Aggregate premium pressure across live signal rows."
          theme="dark"
          icon={<Sparkles size={16} />}
        />
        <MetricCard
          title="Net Flow"
          value={Math.round(analytics.netVolume).toLocaleString()}
          trend={analytics.netVolume > 0 ? 'bullish' : analytics.netVolume < 0 ? 'bearish' : 'neutral'}
          tooltip="Net signed flow from live trade rows."
          theme="dark"
          icon={<Activity size={16} />}
        />
        <MetricCard
          title="Bull vs Bear"
          value={`${analytics.bullishCount}/${analytics.bearishCount}`}
          tooltip="Row count split between bullish and bearish directional tags."
          theme="dark"
          icon={<Gauge size={16} />}
        />
      </section>

      <section className="mb-8 rounded-2xl border border-[var(--color-border)] p-6" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface)' }}>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><Brain size={20} /> Rating Framework</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <div className="font-semibold mb-2">How it&apos;s calculated</div>
            <ul className="space-y-2 text-[var(--color-text-secondary)]">
              <li>• <strong>Signal (36%)</strong>: normalized average of live row score fields.</li>
              <li>• <strong>Flow (20%)</strong>: scaled intensity of signed net flow volume.</li>
              <li>• <strong>Premium (20%)</strong>: scaled intensity of signed net premium.</li>
              <li>• <strong>Breadth (14%)</strong>: percent of rows aligned in the bullish direction.</li>
              <li>• <strong>Consistency (10%)</strong>: concentration vs fragmentation of directional signals.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <div className="font-semibold mb-2">How to interpret</div>
            <ul className="space-y-2 text-[var(--color-text-secondary)]">
              <li>• <strong>70–100</strong>: aggressive bullish regime; favor directional upside structures.</li>
              <li>• <strong>55–69</strong>: constructive bullish tilt; continuation setups preferred.</li>
              <li>• <strong>45–54</strong>: mixed tape; reduce size and prioritize confirmation.</li>
              <li>• <strong>31–44</strong>: bearish tilt; downside strategies gain expectancy.</li>
              <li>• <strong>0–30</strong>: high-conviction bearish tape with elevated trend risk.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] p-4 overflow-x-auto" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Live Trade Stream</h2>
          <div className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1"><ShieldCheck size={14} /> Updated every few seconds</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[var(--color-border)]">
              <th className="py-2 pr-3">Timestamp</th>
              <th className="py-2 pr-3">Contract</th>
              <th className="py-2 pr-3">Flow Bias</th>
              <th className="py-2 pr-3">Notional</th>
              <th className="py-2 pr-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 60).map((row, idx) => {
              const score = getNumber(row.score ?? row.signal_score);
              return (
                <tr key={idx} className="border-b border-[var(--color-border)]/45">
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(row.timestamp)}</td>
                  <td className="py-2 pr-3">{getString(row.contract ?? row.symbol)}</td>
                  <td className="py-2 pr-3">{getString(row.flow_bias ?? row.trade_side ?? row.direction)}</td>
                  <td className="py-2 pr-3">{formatMoney(getNumber(row.notional ?? row.net_premium ?? row.premium))}</td>
                  <td className="py-2 pr-3" style={{ color: score != null && score > 0 ? 'var(--color-bull)' : score != null && score < 0 ? 'var(--color-bear)' : 'var(--color-text-primary)' }}>
                    {score != null ? score.toFixed(2) : '—'}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-[var(--color-text-secondary)]">
                  No live trade rows available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
