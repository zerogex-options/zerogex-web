'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
  Line,
  Bar,
  Scatter,
} from 'recharts';
import { useSignalEvents, type SignalEventName, type SignalEventHorizon } from '@/hooks/useApiData';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import { formatEtTime, getNumber } from '@/core/signalHelpers';
import MobileScrollableChart from './MobileScrollableChart';

interface SignalEventsPanelProps {
  signalName: SignalEventName;
  symbol: string;
  title?: string;
}

const HORIZONS: SignalEventHorizon[] = ['30m', '60m', '120m'];

export default function SignalEventsPanel({ signalName, symbol, title = 'Event Timeline' }: SignalEventsPanelProps) {
  const [horizon, setHorizon] = useState<SignalEventHorizon>('60m');
  const { data, loading, error } = useSignalEvents(signalName, symbol, {
    horizon,
    limit: 150,
    refreshInterval: PROPRIETARY_SIGNALS_REFRESH.signalEventsMs,
  });

  const rows = useMemo(() => {
    const raw = data?.rows ?? [];
    return [...raw]
      .map((row) => {
        const score = getNumber(row.score) ?? 0;
        const flip = row.direction_flip === true;
        const direction = String(row.direction ?? 'neutral').toLowerCase();
        return {
          time: String(row.timestamp ?? ''),
          score,
          flipScore: flip ? score : null,
          flipBullish: flip && direction === 'bullish' ? score : null,
          flipBearish: flip && direction === 'bearish' ? score : null,
          realized: getNumber(row.realized_return),
        };
      })
      .filter((row) => row.time)
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [data]);

  const summary = data?.summary ?? {};

  return (
    <section className="zg-feature-shell p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Historical score path with forward realized return at the chosen horizon. Triangles mark direction flips.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {data?.summary && (
            <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-secondary)]">
              <span>Flips: <span className="text-[var(--color-text-primary)] font-semibold">{summary.flips ?? 0}</span></span>
              <span className="text-[var(--color-bull)]">Bull {summary.bullish ?? 0}</span>
              <span className="text-[var(--color-bear)]">Bear {summary.bearish ?? 0}</span>
              <span>Flat {summary.neutral ?? 0}</span>
            </div>
          )}
          <div className="inline-flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                className="px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  background: horizon === h ? 'var(--color-warning)' : 'var(--color-surface)',
                  color: horizon === h ? 'var(--color-surface)' : 'var(--color-text-secondary)',
                }}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4" style={{ height: 320 }}>
        {rows.length > 0 ? (
          <MobileScrollableChart>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="time" tickFormatter={formatEtTime} tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} stroke="var(--color-border)" minTickGap={40} />
              <YAxis yAxisId="score" domain={[-100, 100]} tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} stroke="var(--color-border)" width={36} />
              <YAxis yAxisId="ret" orientation="right" tickFormatter={(v: number) => `${(v * 100).toFixed(2)}%`} tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} stroke="var(--color-border)" width={60} />
              <Tooltip
                contentStyle={{ background: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-chart-tooltip-text)', fontSize: 12 }}
                labelFormatter={formatEtTime}
                formatter={(value: number | string | undefined, name: string | undefined) => {
                  const key = name ?? '';
                  if (key === 'Realized') return [typeof value === 'number' ? `${(value * 100).toFixed(3)}%` : '—', key];
                  if (key === 'Flip ↑' || key === 'Flip ↓') return [typeof value === 'number' ? value.toFixed(2) : '—', key];
                  return [typeof value === 'number' ? value.toFixed(2) : String(value ?? '—'), key];
                }}
              />
              <ReferenceLine yAxisId="score" y={0} stroke="var(--color-text-secondary)" strokeOpacity={0.4} />
              <Bar yAxisId="ret" dataKey="realized" name="Realized" fill="var(--color-border)" opacity={0.6} />
              <Line yAxisId="score" type="monotone" dataKey="score" name="Score" stroke="var(--color-warning)" strokeWidth={2} dot={false} />
              <Scatter yAxisId="score" dataKey="flipBullish" name="Flip ↑" fill="var(--color-bull)" shape="triangle" />
              <Scatter yAxisId="score" dataKey="flipBearish" name="Flip ↓" fill="var(--color-bear)" shape="triangle" />
            </ComposedChart>
          </ResponsiveContainer>
          </MobileScrollableChart>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-[var(--color-text-secondary)] gap-1">
            <div>Unable to load event history.</div>
            <div className="text-xs opacity-80">{error}</div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-secondary)]">Loading event history…</div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-secondary)]">No event history yet.</div>
        )}
      </div>
    </section>
  );
}
