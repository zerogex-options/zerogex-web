'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Info, LineChart as LineChartIcon, LayoutGrid } from 'lucide-react';
import TooltipWrapper from '@/components/TooltipWrapper';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import MsiGauge from '@/components/MsiGauge';
import { useTimeframe } from '@/core/TimeframeContext';
import { useSignalScore, useSignalScoreHistory } from '@/hooks/useApiData';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import { asObject, getNumber } from '@/core/signalHelpers';

interface ComponentEntry {
  name: string;
  label: string;
  maxPoints: number;
  contribution: number | null;
  score: number | null;
}

const COMPONENT_LABELS: Record<string, { label: string; description: string; sign: string }> = {
  net_gex_sign: {
    label: 'Net GEX Sign',
    description: 'Sign of dealer net gamma',
    sign: 'Negative GEX ⇒ +1 (expansion); Positive ⇒ −1 (pinning)',
  },
  flip_distance: {
    label: 'Flip Distance',
    description: 'Distance from spot to gamma-flip strike',
    sign: 'Near flip ⇒ +1 (fragile); Far ⇒ −1 (stable)',
  },
  local_gamma: {
    label: 'Local Gamma',
    description: 'Density of gamma near spot',
    sign: 'Low local gamma ⇒ +1 (air pocket); High ⇒ −1',
  },
  put_call_ratio: {
    label: 'Put/Call Ratio',
    description: 'OI-weighted put/call tilt',
    sign: 'Extreme ⇒ +1; Balanced ⇒ −1',
  },
  price_vs_max_gamma: {
    label: 'Price vs Max Gamma',
    description: 'Distance from max-gamma strike',
    sign: 'Far ⇒ +1; Pinned ⇒ −1',
  },
  volatility_regime: {
    label: 'Volatility Regime',
    description: 'Realized / VIX regime',
    sign: 'High vol ⇒ +1; Dead ⇒ −1',
  },
};

const COMPONENT_ORDER = [
  'net_gex_sign',
  'flip_distance',
  'local_gamma',
  'put_call_ratio',
  'price_vs_max_gamma',
  'volatility_regime',
];

function parseComponents(raw: unknown): ComponentEntry[] {
  const obj = asObject(raw);
  if (!obj) return [];
  return COMPONENT_ORDER.filter((name) => obj[name] != null).map((name) => {
    const cObj = asObject(obj[name]) ?? {};
    return {
      name,
      label: COMPONENT_LABELS[name]?.label ?? name,
      maxPoints: getNumber(cObj.max_points) ?? 0,
      contribution: getNumber(cObj.contribution),
      score: getNumber(cObj.score),
    };
  });
}

export default function CompositeScorePage() {
  const { symbol } = useTimeframe();

  const { data: scoreData, loading: scoreLoading, error: scoreError, refetch } = useSignalScore(
    symbol,
    PROPRIETARY_SIGNALS_REFRESH.compositeScoreMs,
  );
  const { data: historyData, loading: historyLoading, error: historyError } = useSignalScoreHistory(
    symbol,
    PROPRIETARY_SIGNALS_REFRESH.compositeHistoryMs,
    100,
  );

  const payload = useMemo(() => asObject(scoreData) ?? {}, [scoreData]);
  const compositeScore = getNumber(payload.composite_score ?? payload.score);
  const components = useMemo(() => parseComponents(payload.components), [payload]);

  const historyRows = useMemo(() => {
    const rows = Array.isArray(historyData) ? [...historyData] : [];
    // Router returns rows in timestamp DESC order and spec notes no timestamps
    // in the normalized payload — so reverse to show oldest→newest left→right.
    rows.reverse();
    return rows.map((row, i) => {
      const obj = asObject(row) ?? {};
      const composite = getNumber(obj.composite_score ?? obj.score);
      const comps = parseComponents(obj.components);
      const rec: Record<string, number | null | string> = { index: i, composite: composite ?? 0 };
      comps.forEach((c) => {
        rec[c.name] = c.contribution ?? 0;
      });
      return rec;
    });
  }, [historyData]);

  if (scoreLoading && !scoreData) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <h1 className="text-3xl font-bold">Composite Score</h1>
        <TooltipWrapper
          text="Market State Index (MSI): a 0–100 regime gauge built from six option-structure components. 50 = neutral; deviations reflect structural expansion or pinning bias. Each component returns a raw score in [−1, +1], is multiplied by its weight, summed and added to a 50-point baseline, then clamped to [0, 100]."
          placement="bottom"
        >
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      {scoreError && <ErrorMessage message={scoreError} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-8 items-start">
          <div className="flex flex-col items-center min-w-0 w-full">
            <MsiGauge score={compositeScore} size={280} label="MSI (0–100)" />
            <div className="mt-5 grid grid-cols-2 gap-2 text-[11px] w-full max-w-[320px]">
              <div className="rounded-lg border border-[var(--color-border)] p-2" style={{ background: 'var(--color-bear-soft)' }}>
                <div className="font-semibold text-[var(--color-bear)]">0–20</div>
                <div className="text-[var(--color-text-secondary)]">High-risk reversal</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-2" style={{ background: 'var(--color-warning-soft)' }}>
                <div className="font-semibold text-[var(--color-warning)]">20–40</div>
                <div className="text-[var(--color-text-secondary)]">Chop / range</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-2 bg-[var(--color-surface-subtle)]">
                <div className="font-semibold">40–70</div>
                <div className="text-[var(--color-text-secondary)]">Controlled trend</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-2" style={{ background: 'var(--color-bull-soft)' }}>
                <div className="font-semibold text-[var(--color-bull)]">70–100</div>
                <div className="text-[var(--color-text-secondary)]">Trend / expansion</div>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <LayoutGrid size={18} />
              <h2 className="text-lg font-semibold">Component Contributions</h2>
              <TooltipWrapper
                text="Each bar shows a component's signed contribution to the 50-point baseline. Bar length is |contribution|/max_points. Positive contributions push toward expansion; negative toward pinning/stability."
                placement="bottom"
              >
                <Info size={13} className="text-[var(--color-text-secondary)]" />
              </TooltipWrapper>
            </div>

            {components.length === 0 ? (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
                No component data available yet for {symbol}.
              </div>
            ) : (
              <div className="overflow-x-auto md:overflow-visible -mx-2 md:mx-0 pb-1">
                <div className="min-w-[420px] md:min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] divide-y divide-[var(--color-border)] mx-2 md:mx-0">
                  {components.map((c) => (
                    <ComponentBar key={c.name} entry={c} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <LineChartIcon size={20} />
          Score History
          <TooltipWrapper
            text="Recent composite score path with regime bands at 20 / 40 / 70. Rows are ordered oldest → newest."
            placement="bottom"
          >
            <Info size={14} className="text-[var(--color-text-secondary)] cursor-help" />
          </TooltipWrapper>
        </h2>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4" style={{ height: 320 }}>
          {historyRows.length > 0 ? (
            <MobileScrollableChart>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyRows} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="index" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} stroke="var(--color-border)" />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} stroke="var(--color-border)" width={36} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-chart-tooltip-text)', fontSize: 12 }}
                    formatter={(value: number | string | undefined) => [typeof value === 'number' ? value.toFixed(2) : String(value ?? '—'), 'Composite']}
                    labelFormatter={(label) => `Snapshot #${label}`}
                  />
                  <ReferenceArea y1={0} y2={20} fill="var(--color-bear)" fillOpacity={0.08} />
                  <ReferenceArea y1={20} y2={40} fill="var(--color-warning)" fillOpacity={0.08} />
                  <ReferenceArea y1={70} y2={100} fill="var(--color-bull)" fillOpacity={0.08} />
                  <ReferenceLine y={50} stroke="var(--color-text-secondary)" strokeOpacity={0.5} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="composite" stroke="var(--color-warning)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--color-warning)', fill: 'var(--color-surface)' }} />
                </LineChart>
              </ResponsiveContainer>
            </MobileScrollableChart>
          ) : historyError ? (
            <div className="flex flex-col items-center justify-center h-full text-sm text-[var(--color-text-secondary)] gap-1">
              <div>Unable to load score history.</div>
              <div className="text-xs opacity-80">{historyError}</div>
            </div>
          ) : historyLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-secondary)]">Loading score history…</div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-secondary)]">No score history available.</div>
          )}
        </div>
      </section>

      {historyRows.length > 0 && components.length > 0 && (
        <section className="zg-feature-shell mt-8 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            Component Stack
            <TooltipWrapper
              text="Stacked area of each component's contribution over time. Surfaces which component flipped the regime."
              placement="bottom"
            >
              <Info size={14} className="text-[var(--color-text-secondary)] cursor-help" />
            </TooltipWrapper>
          </h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4" style={{ height: 320 }}>
            <MobileScrollableChart>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyRows} margin={{ top: 8, right: 16, bottom: 4, left: 8 }} stackOffset="sign">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="index" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} stroke="var(--color-border)" />
                  <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} stroke="var(--color-border)" width={36} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-chart-tooltip-text)', fontSize: 12 }}
                    formatter={(value: number | string | undefined, name: string | undefined) => {
                      const key = name ?? '';
                      return [typeof value === 'number' ? value.toFixed(2) : String(value ?? '—'), COMPONENT_LABELS[key]?.label ?? key];
                    }}
                    labelFormatter={(label) => `Snapshot #${label}`}
                  />
                  <ReferenceLine y={0} stroke="var(--color-text-secondary)" strokeOpacity={0.5} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => COMPONENT_LABELS[value]?.label ?? value} />
                  {components.map((c, i) => (
                    <Area key={c.name} type="monotone" stackId="1" dataKey={c.name} stroke={stackColor(i)} fill={stackColor(i)} fillOpacity={0.55} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </MobileScrollableChart>
          </div>
        </section>
      )}

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Component Reference</h2>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                <th className="pb-2">Component</th>
                <th className="pb-2">Max Points</th>
                <th className="pb-2">What It Measures</th>
                <th className="pb-2">Sign Convention</th>
              </tr>
            </thead>
            <tbody>
              {COMPONENT_ORDER.map((name) => {
                const def = COMPONENT_LABELS[name];
                const live = components.find((c) => c.name === name);
                return (
                  <tr key={name} className="border-b border-[var(--color-border)]/30">
                    <td className="py-1.5 font-medium">{def.label}</td>
                    <td className="py-1.5">{live?.maxPoints ?? '—'}</td>
                    <td className="py-1.5 text-[var(--color-text-secondary)]">{def.description}</td>
                    <td className="py-1.5 text-[var(--color-text-secondary)]">{def.sign}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ComponentBar({ entry }: { entry: ComponentEntry }) {
  const { label, maxPoints, contribution, score } = entry;
  const def = COMPONENT_LABELS[entry.name];
  const pct = maxPoints > 0 && contribution != null
    ? Math.max(0, Math.min(1, Math.abs(contribution) / maxPoints))
    : 0;
  const positive = (contribution ?? 0) >= 0;
  const color = positive ? 'var(--color-bull)' : 'var(--color-bear)';

  return (
    <div className="p-3">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{label}</span>
          {def && (
            <TooltipWrapper text={`${def.description}. ${def.sign}`} placement="bottom">
              <Info size={11} className="text-[var(--color-text-secondary)]" />
            </TooltipWrapper>
          )}
        </div>
        <div className="font-mono text-xs text-[var(--color-text-secondary)]">
          score <span className="text-[var(--color-text-primary)]">{score != null ? score.toFixed(2) : '—'}</span>
          {' · '}
          max <span className="text-[var(--color-text-primary)]">{maxPoints}</span>
        </div>
      </div>
      <div className="relative h-5 rounded-md bg-[var(--color-border)]/40 overflow-hidden">
        <div className="absolute top-0 bottom-0" style={{ left: '50%', width: 1, background: 'var(--color-text-secondary)', opacity: 0.5 }} />
        {contribution != null && (
          <div
            className="absolute top-0 bottom-0"
            style={{
              background: color,
              left: positive ? '50%' : `${50 - pct * 50}%`,
              width: `${pct * 50}%`,
              opacity: 0.85,
            }}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-mono" style={{ color: pct > 0.35 ? '#fff' : 'var(--color-text-primary)' }}>
          {contribution != null ? `${contribution >= 0 ? '+' : ''}${contribution.toFixed(2)} pts` : '—'}
        </div>
      </div>
    </div>
  );
}

function stackColor(i: number): string {
  const palette = [
    'var(--color-bull)',
    'var(--color-bear)',
    'var(--color-warning)',
    '#6EA8FE',
    '#C084FC',
    '#F59E0B',
  ];
  return palette[i % palette.length];
}
