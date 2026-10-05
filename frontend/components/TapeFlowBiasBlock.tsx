'use client';

import { useMemo, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import {
  Area,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { buildThirtyMinGridlines, sessionTimeTick } from '@/components/ChartGridlines';
import { compactUsdTick, niceAxisAround } from '@/components/phoneAxisFormat';
import {
  getFiveMinuteSessionTimeline,
  netDirectionalPremiumSeries,
} from '@/core/flowSeriesCharts';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import {
  asObject,
  formatGexCompact,
  getNumber,
  tapeFlowInterpretation,
} from '@/core/signalHelpers';
import { spectrumIndicatorLeft } from '@/core/spectrumIndicator';
import { etDateKeyFor, etTodayDateKey } from '@/core/utils';
import { useTapeFlowBiasSignal } from '@/hooks/useApiData';
import { useFlowSeries } from '@/hooks/useFlowSeries';

const COMPACT_HEIGHT = 96;
const EXPANDED_HEIGHT = 260;

/**
 * Tape Flow Bias, compact, on the Hedging Flow page.
 *
 * A DIFFERENT measurement from everything else on this page and deliberately
 * kept in its own frame for that reason. Gamma Weather and the two charts below
 * it are about dealer positioning and the hedging it implies; this is the
 * aggressor split on the option tape, which is what the other side of the
 * market was doing. They inform each other and they are not the same number,
 * and a reader who fuses them will be confidently wrong on the days they
 * disagree, which are the interesting days.
 *
 * Deliberately not the whole signal page. Score history answers "how has this
 * signal scored", which is a question about the signal rather than about today,
 * and the four premium components are the decomposition of the two nets shown
 * here. Both are one click away and neither belongs in a glance.
 */
export default function TapeFlowBiasBlock({ symbol }: { symbol: string }) {
  const [expanded, setExpanded] = useState(false);

  const { data } = useTapeFlowBiasSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.tapeFlowBiasMs);
  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const callNet = getNumber(payload.call_net_premium);
  const putNet = getNumber(payload.put_net_premium);

  // The premium path. Unfiltered on purpose: this is the whole tape, and the
  // page's 0DTE toggle is about hedging pressure rather than about what traded.
  const { rows: flowRows } = useFlowSeries(symbol, 'current');

  const premium = useMemo(() => {
    const last = flowRows?.[flowRows.length - 1]?.timestamp;
    const dateKey = (last ? etDateKeyFor(last) : null) ?? etTodayDateKey();
    return netDirectionalPremiumSeries(flowRows, getFiveMinuteSessionTimeline(dateKey));
  }, [flowRows]);

  const hasPremium = premium.some((r) => r.premium != null);

  // Rounded outward from the plotted extent, so tidying the labels cannot clip
  // the line. See niceAxisAround.
  const axis = useMemo(() => {
    const values = premium
      .map((r) => r.premium)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (values.length === 0) return null;
    return niceAxisAround(Math.min(0, ...values), Math.max(0, ...values), 3);
  }, [premium]);

  // Collapsed, the full tick list does not fit in 96px and Recharts thins it by
  // dropping whichever labels collide. It dropped zero, which on a chart whose
  // whole point is which side of zero the tape is on is the one label that has
  // to survive. Floor, zero and ceiling instead, chosen rather than left to
  // chance, and on the same scale either way.
  const ticks = useMemo(() => {
    if (!axis) return [];
    return expanded ? axis.ticks : [axis.domain[0], 0, axis.domain[1]];
  }, [axis, expanded]);

  // The meter runs -100 to +100; the needle wants 0% to 100%.
  const needlePct = score != null ? Math.max(0, Math.min(100, (score + 100) / 2)) : 50;

  return (
    // Peer framing, not inset: this used to sit inside the Gamma Weather box
    // between the chips and the charts, where a smaller radius and the subtle
    // surface read correctly as a sub-card. It now sits ABOVE that box as its
    // own block, so it takes the same frame the Weather box and the signal
    // cards take. Margin is the caller's, as everywhere else on this page.
    <section
      className="rounded-2xl border p-4"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
      aria-label="Tape Flow Bias"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Tape Flow Bias
        </h3>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {score != null && (
            <span className="font-mono" style={{ color: 'var(--color-text-primary)' }}>
              {score > 0 ? '+' : ''}
              {score.toFixed(2)}
            </span>
          )}
          {score != null && ' · '}
          {tapeFlowInterpretation(score)}
        </p>
      </div>

      <div
        className="relative h-4 rounded-full"
        style={{
          background:
            'linear-gradient(90deg, var(--color-bear) 0%, var(--color-bear-soft) 35%, var(--color-surface) 50%, var(--color-bull-soft) 65%, var(--color-bull) 100%)',
        }}
      >
        <div
          className="absolute top-0 h-4 w-1"
          style={{
            backgroundColor: 'var(--color-text-primary)',
            left: spectrumIndicatorLeft(needlePct, 16, 4),
            transform: 'translateX(-50%)',
          }}
        />
      </div>
      <div
        className="mt-1 flex justify-between font-mono text-[10px]"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <span>−100</span>
        <span>0</span>
        <span>+100</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        {/* Call net positive is bullish and put net positive is bearish, which
            is why the two tiles read their colors off opposite comparisons. */}
        <Tile label="Call net" value={callNet} bullWhenPositive />
        <Tile label="Put net" value={putNet} bullWhenPositive={false} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          Net directional premium
        </p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded p-1 max-sm:min-h-8 max-sm:min-w-8"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse the premium chart' : 'Expand the premium chart'}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {!hasPremium ? (
        <p className="py-4 text-center text-xs italic" style={{ color: 'var(--color-text-secondary)' }}>
          No premium yet this session.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={expanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT}>
          <ComposedChart data={premium} margin={{ top: 4, right: 8, bottom: 2, left: 0 }}>
            <XAxis
              dataKey="timestamp"
              interval={0}
              tickLine={false}
              height={expanded ? undefined : 4}
              // Only worth the height when the chart is big enough to read a
              // time off. Collapsed, this is a shape, not a timeline.
              tick={expanded ? sessionTimeTick('var(--color-text-secondary)', 60) : false}
            />
            {expanded &&
              buildThirtyMinGridlines(premium, 'var(--color-border)', 'tape-premium', undefined, 60)}
            <YAxis
              // Draw every tick given rather than thinning on collision:
              // the collapsed list is three deliberate values, not a
              // suggestion, and Recharts' default dropped two of them.
              interval={0}
              width={expanded ? 56 : 44}
              tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
              tickFormatter={compactUsdTick}
              {...(axis ? { domain: axis.domain, ticks: ticks } : {})}
            />
            <ReferenceLine y={0} stroke="var(--color-text-secondary)" opacity={0.6} />
            <Tooltip content={() => null} cursor={{ stroke: 'var(--color-text-secondary)' }} />
            {/* Two areas rather than one signed series, so each fills on its
                own side of zero. The zero-crossing rows inserted upstream are
                what keep the fill from stepping at the bar boundary. */}
            <Area
              type="monotone"
              dataKey="positivePremium"
              stroke="var(--color-bull)"
              fill="var(--color-bull)"
              fillOpacity={0.25}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="negativePremium"
              stroke="var(--color-bear)"
              fill="var(--color-bear)"
              fillOpacity={0.25}
              isAnimationActive={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  bullWhenPositive,
}: {
  label: string;
  value: number | null;
  bullWhenPositive: boolean;
}) {
  const positive = (value ?? 0) > 0;
  const bullish = bullWhenPositive ? positive : !positive;
  return (
    <div
      className="rounded-lg border p-2"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div
        className="text-[10px] uppercase tracking-wide"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </div>
      <div
        className="font-mono text-base"
        style={{ color: bullish ? 'var(--color-bull)' : 'var(--color-bear)' }}
      >
        {formatGexCompact(value)}
      </div>
    </div>
  );
}
