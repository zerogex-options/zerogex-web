'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  alignedTimeTicksMs,
  formatEtTime,
  type ScoreHistoryPoint,
} from '@/core/signalHelpers';
import ChartTimeAxisTick from './ChartTimeAxisTick';
import CompactTimeAxisTick, { firstTickOfEachDay, thinTicks } from './CompactTimeAxisTick';
import { useIsMobile } from '@/hooks/useIsMobile';

// Match SignalEventsPanel: candidate step sizes (in minutes) for the x-axis
// tick generator, picked so labels land on familiar wall-clock boundaries.
const SCORE_TIME_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 720, 1440];

function pickScoreTimeStep(spanMinutes: number, targetTicks = 6): number {
  const raw = spanMinutes / Math.max(1, targetTicks);
  for (const c of SCORE_TIME_STEPS) {
    if (c >= raw) return c;
  }
  return SCORE_TIME_STEPS[SCORE_TIME_STEPS.length - 1];
}
import { useExpandedCard } from './ExpandableCard';

/**
 * Callers ask for a tint as `${trendColor(trend)}1f`, but trendColor() returns
 * a CSS variable and "var(--color-bull)1f" is not a color: SVG drops the fill
 * and paints the area BLACK. This turns that form into the tint it meant.
 */
function tintFill(fill: string): string {
  const m = /^(var\(--[\w-]+\))([0-9a-f]{2})$/i.exec(fill.trim());
  if (!m) return fill;
  const pct = Math.round((parseInt(m[2], 16) / 255) * 100);
  return `color-mix(in srgb, ${m[1]} ${pct}%, transparent)`;
}

interface SignalSparklineProps {
  points: ScoreHistoryPoint[];
  height?: number;
  min?: number;
  max?: number;
  strokeColor?: string;
  fillColor?: string;
}

export default function SignalSparkline({
  points,
  height = 48,
  min = -100,
  max = 100,
  strokeColor = 'var(--color-warning)',
  fillColor = 'var(--color-warning-soft)',
}: SignalSparklineProps) {
  const expanded = useExpandedCard();

  if (expanded) {
    return (
      <ExpandedSparkline
        points={points}
        min={min}
        max={max}
        strokeColor={strokeColor}
        fillColor={fillColor}
      />
    );
  }

  return (
    <InlineSparkline
      points={points}
      height={height}
      min={min}
      max={max}
      strokeColor={strokeColor}
      fillColor={fillColor}
    />
  );
}

function InlineSparkline({
  points,
  height,
  min,
  max,
  strokeColor,
  fillColor,
}: Required<Omit<SignalSparklineProps, 'points'>> & { points: ScoreHistoryPoint[] }) {
  const width = 200;
  const areaFill = tintFill(fillColor);

  const path = useMemo(() => {
    if (!points.length) return { line: '', area: '', lastX: 0, lastY: 0 };
    const n = points.length;
    const xs = points.map((_, i) => (n === 1 ? width / 2 : (i / (n - 1)) * width));
    const ys = points.map((p) => {
      const clamped = Math.max(min, Math.min(max, p.score));
      const t = (clamped - min) / (max - min);
      return height - t * height;
    });
    let line = '';
    xs.forEach((x, i) => {
      line += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${ys[i].toFixed(2)} `;
    });
    const zeroY = height - ((0 - min) / (max - min)) * height;
    const area = `${line} L ${xs[n - 1].toFixed(2)} ${zeroY.toFixed(2)} L ${xs[0].toFixed(2)} ${zeroY.toFixed(2)} Z`;
    return { line, area, lastX: xs[n - 1], lastY: ys[n - 1] };
  }, [points, height, min, max]);

  if (!points.length) {
    return (
      <div className="flex items-center justify-center text-[11px] text-[var(--color-text-secondary)]" style={{ height }}>
        No history yet
      </div>
    );
  }

  const zeroY = height - ((0 - min) / (max - min)) * height;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="var(--color-border)" strokeDasharray="2 3" strokeWidth={1} />
      <path d={path.area} fill={areaFill} stroke="none" />
      <path d={path.line} fill="none" stroke={strokeColor} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={path.lastX} cy={path.lastY} r={2.25} fill={strokeColor} />
    </svg>
  );
}

function ExpandedSparkline({
  points,
  min,
  max,
  strokeColor,
  fillColor,
}: {
  points: ScoreHistoryPoint[];
  min: number;
  max: number;
  strokeColor: string;
  fillColor: string;
}) {
  // Expanded, the card goes full-bleed on a phone (~360px of chart), where
  // six "10:30 AM" labels overprint; thin them and print them short.
  const isMobile = useIsMobile();
  const areaFill = tintFill(fillColor);
  const data = useMemo(
    () =>
      points
        .map((p, i) => {
          const timeMs = p.timestamp ? new Date(p.timestamp).getTime() : Number.NaN;
          return {
            index: i,
            timestamp: p.timestamp ?? null,
            timeMs,
            score: Math.max(min, Math.min(max, p.score)),
          };
        })
        .filter((d) => Number.isFinite(d.timeMs)),
    [points, min, max],
  );

  // Match the Event Timeline tick standard: place the x-axis on a numeric
  // (epoch-ms) scale so ticks land on round ET wall-clock boundaries
  // (e.g. :15/:30/:45/:00) regardless of when score samples were recorded.
  const xDomain = useMemo<[number, number] | null>(() => {
    if (data.length === 0) return null;
    if (data.length === 1) return [data[0].timeMs - 60_000, data[0].timeMs + 60_000];
    return [data[0].timeMs, data[data.length - 1].timeMs];
  }, [data]);

  const { timeTicks, dailyTicks } = useMemo(() => {
    if (!xDomain) return { timeTicks: [] as number[], dailyTicks: false };
    const [startMs, endMs] = xDomain;
    const spanMin = Math.max(1, Math.round((endMs - startMs) / 60_000));
    const step = pickScoreTimeStep(spanMin, isMobile ? 4 : 6);
    let ticks = alignedTimeTicksMs(startMs, endMs, step);
    let idx = SCORE_TIME_STEPS.indexOf(step) - 1;
    let used = step;
    while (ticks.length < 2 && idx >= 0) {
      used = SCORE_TIME_STEPS[idx];
      ticks = alignedTimeTicksMs(startMs, endMs, used);
      idx -= 1;
    }
    return { timeTicks: isMobile ? thinTicks(ticks, 5) : ticks, dailyTicks: used >= 1440 };
  }, [xDomain, isMobile]);

  const dateTicks = useMemo(() => firstTickOfEachDay(timeTicks), [timeTicks]);

  const ticks = useMemo(() => {
    const span = max - min;
    if (span <= 0) return [min, max];
    const step = span / 5;
    const result: number[] = [];
    for (let i = 0; i <= 5; i += 1) {
      result.push(min + step * i);
    }
    return result;
  }, [min, max]);

  if (!points.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-[var(--color-text-secondary)]"
        style={{ height: 420 }}
      >
        No history yet
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 'min(70vh, 520px)', minHeight: 360 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          // 16px right on a phone: half of a centred "16:00" tick at the
          // domain's end hangs past the plot, and nothing sits to its right.
          margin={isMobile ? { top: 12, right: 16, bottom: 4, left: 0 } : { top: 16, right: 24, bottom: 12, left: 8 }}
        >
          <CartesianGrid vertical={false} stroke="var(--color-grid-line)" strokeWidth={1} />
          <XAxis
            type="number"
            dataKey="timeMs"
            domain={xDomain ?? ['dataMin', 'dataMax']}
            ticks={timeTicks}
            interval={0}
            height={isMobile ? (dailyTicks ? 22 : 34) : 44}
            tick={
              isMobile
                ? <CompactTimeAxisTick dateTicks={dateTicks} daily={dailyTicks} />
                : <ChartTimeAxisTick dateTicks={dateTicks} />
            }
            stroke="var(--color-border)"
            allowDuplicatedCategory={false}
          />
          <YAxis
            domain={[min, max]}
            ticks={ticks}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: isMobile ? 10 : 11 }}
            stroke="var(--color-border)"
            width={isMobile ? 34 : 40}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-chart-tooltip-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              color: 'var(--color-chart-tooltip-text)',
              fontSize: 12,
            }}
            formatter={(value: number | string | undefined) => [
              typeof value === 'number' ? value.toFixed(2) : String(value ?? '—'),
              'Score',
            ]}
            labelFormatter={formatEtTime}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke={strokeColor}
            strokeWidth={2}
            fill={areaFill}
            dot={false}
            activeDot={{ r: 4, stroke: strokeColor, fill: 'var(--color-surface)' }}
            isAnimationActive={false}
            baseValue={Math.max(min, Math.min(max, 0))}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
