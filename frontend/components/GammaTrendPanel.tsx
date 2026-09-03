'use client';

/**
 * GammaTrendPanel — dealer gamma and the flip↔spot cushion, plotted.
 *
 * The rest of the product reports dealer gamma as a LEVEL ("+$50.83B, long
 * gamma, flip 7636"). A level cannot answer the two questions a trader asks
 * next: is that number building or bleeding off, and is the flip closing on
 * spot or pulling away? This panel plots both.
 *
 * ---------------------------------------------------------------------------
 * Why two charts and not one
 * ---------------------------------------------------------------------------
 * The obvious design is one plot with gamma on the left axis and price on the
 * right. It is also wrong: the alignment of two y-scales is arbitrary, so the
 * point where the lines appear to cross is an artifact of the scales chosen,
 * not an event in the data. On a chart whose entire purpose is "is the flip
 * converging on spot," a reader could be shown a convergence that the numbers
 * do not contain. So the measures are split into two stacked plots that share
 * an x-axis — and the second plot legitimately carries two series on ONE axis,
 * because spot and the flip are both prices in the same units.
 *
 * Everything is derived client-side from `useStrikeProfileTimeseries`, the
 * same cache the ladder reads, so this costs no new endpoint and no extra
 * network: the buckets are already seeded and polled for the page.
 */

import { useMemo, useState } from 'react';
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStrikeProfileTimeseries } from '@/hooks/useStrikeProfileTimeseries';
import { useChartTheme } from '@/hooks/useChartTheme';
import { useTimeframe } from '@/core/TimeframeContext';
import { useChartExpirations } from '@/hooks/useChartExpirations';
import { useGexUnit, gexScaleFactor, GEX_UNIT_LABEL } from '@/core/GexUnitContext';
import { formatEtTime } from '@/core/signalHelpers';
import {
  buildTrendAxis,
  buildTrendSeries,
  cushionTone,
  describeCushionTrend,
  describeGammaTrend,
  formatGexAxis,
  formatSignedGex,
  formatSignedPoints,
  formatStrike,
  gammaDomain,
  gammaTone,
  priceDomain,
  summarizeTrend,
  type GammaTrendPoint,
  type TrendAxis,
} from '@/core/gammaTrend';
import { Note, PanelHeader, PanelMessage, Zone, toneColor } from './RegimeShiftUI';

const HEADER_TOOLTIP =
  'Dealer gamma and the gap between spot and the gamma flip, plotted across the session. The top plot answers whether the book is building or decaying; the bottom answers whether the flip is closing on spot (cushion thinning) or pulling away. The two are on separate plots because they are measured in different units — putting them on one pair of axes would invent a crossing point that is not in the data.';

interface ChartRow {
  /** Position in the stored series — the x value both plots use.
   *  See core/gammaTrend.buildTrendAxis for why this is not `t`. */
  i: number;
  t: number;
  gamma: number;
  flip: number | null;
  spot: number | null;
  /** [low, high] of the spot↔flip gap — Recharts renders this as a band. */
  band: [number, number] | null;
  cushion: number | null;
}

function toChartRows(points: GammaTrendPoint[]): ChartRow[] {
  return points.map((p, i) => ({
    i,
    t: p.t,
    gamma: p.gamma,
    flip: p.flip,
    spot: p.spot,
    band:
      p.flip != null && p.spot != null
        ? [Math.min(p.flip, p.spot), Math.max(p.flip, p.spot)]
        : null,
    cushion: p.cushion,
  }));
}

/**
 * Where zero sits as a fraction from the top of the gamma plot, so the fill
 * can be green above it and red below. A single flat color would misreport
 * a session that crossed zero — the one moment on this chart that changes
 * which way dealers hedge.
 */
function zeroOffset(domain: [number, number]): number {
  const [lo, hi] = domain;
  if (hi <= 0) return 0;
  if (lo >= 0) return 1;
  return hi / (hi - lo);
}

export default function GammaTrendPanel({ symbol: symbolProp }: { symbol?: string }) {
  const chart = useChartTheme();
  const { symbol: ctxSymbol } = useTimeframe();
  const symbol = symbolProp ?? ctxSymbol;
  const { param: expParam } = useChartExpirations(symbol, true);
  const { gexUnit } = useGexUnit();
  const [showTable, setShowTable] = useState(false);

  // '5min' shares the cache key the ladder and the Strike Profile page already
  // warm, so mounting this panel adds no fetch of its own.
  const { buckets, loading, error } = useStrikeProfileTimeseries(symbol, '5min', expParam);

  // One scale for the whole series, taken from the latest spot. Re-deriving it
  // per bucket would move the divisor with price and slope a flat book.
  const scale = useMemo(() => {
    const last = buckets[buckets.length - 1];
    const spot = last?.close == null ? null : Number(last.close);
    return gexScaleFactor(gexUnit, Number.isFinite(spot as number) ? spot : null);
  }, [buckets, gexUnit]);

  const points = useMemo(() => buildTrendSeries(buckets, scale), [buckets, scale]);
  const summary = useMemo(() => summarizeTrend(points), [points]);
  const rows = useMemo(() => toChartRows(points), [points]);

  const gamma = useMemo(() => gammaDomain(rows.map((r) => r.gamma)), [rows]);
  const offset = useMemo(() => zeroOffset(gamma.domain), [gamma]);
  const domain = useMemo(
    () => priceDomain(rows.flatMap((r) => [r.flip, r.spot])),
    [rows],
  );

  // Ticks on round ET times and the seams where a closed market was cut out
  // — see core/gammaTrend.buildTrendAxis for why the plots are indexed by
  // position rather than drawn on a time scale.
  const axis = useMemo(() => buildTrendAxis(points), [points]);

  const gTone = gammaTone(summary);
  const cTone = cushionTone(summary);

  if (loading && points.length === 0) {
    return (
      <div className="zg-panel">
        <PanelHeader title="Gamma Trend" tooltip={HEADER_TOOLTIP} />
        <PanelMessage>Loading the session&apos;s gamma history…</PanelMessage>
      </div>
    );
  }

  if (error && points.length === 0) {
    return (
      <div className="zg-panel">
        <PanelHeader title="Gamma Trend" tooltip={HEADER_TOOLTIP} />
        <PanelMessage tone="bear">{error}</PanelMessage>
      </div>
    );
  }

  if (points.length < 2) {
    return (
      <div className="zg-panel">
        <PanelHeader title="Gamma Trend" tooltip={HEADER_TOOLTIP} />
        <PanelMessage>
          Not enough of the session stored yet to plot a trend for {symbol}.
        </PanelMessage>
      </div>
    );
  }

  const axisTick = { fontSize: 11, fill: chart.axisText };
  const tickLabel = new Map(axis.ticks.map((t) => [t.index, t.label]));

  return (
    <div className="zg-panel">
      <PanelHeader
        title="Gamma Trend"
        tooltip={HEADER_TOOLTIP}
        right={
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            className="rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors"
            style={{
              border: `1px solid ${showTable ? 'var(--color-warning)' : 'var(--border-default)'}`,
              color: showTable ? 'var(--color-warning)' : 'var(--text-secondary)',
              background: showTable ? 'var(--color-warning-soft)' : 'transparent',
            }}
          >
            {showTable ? 'Chart' : 'Table'}
          </button>
        }
      />

      {/* The read, before the plots — a reader who only wants the answer gets
          it here and never has to interpret a line. */}
      <Zone flush padded>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
          <Stat
            label="Dealer gamma"
            value={formatSignedGex(summary.gammaNow)}
            delta={formatSignedGex(summary.gammaChange)}
            tone={gTone}
            sentence={describeGammaTrend(summary)}
          />
          <Stat
            label="Cushion to flip"
            value={summary.cushionNow == null ? '—' : `${formatStrike(Math.abs(summary.cushionNow))} pts`}
            delta={formatSignedPoints(summary.cushionChange)}
            tone={cTone}
            sentence={describeCushionTrend(summary)}
          />
        </div>
      </Zone>

      {showTable ? (
        <Zone label="Session readings">
          <TrendTable points={points} />
        </Zone>
      ) : (
        <>
          {/* ── Plot 1: is the book building or decaying? ──────────────── */}
          <Zone label={`Dealer gamma across the session (${GEX_UNIT_LABEL[gexUnit]})`}>
            <ResponsiveContainer width="100%" height={196}>
              <ComposedChart data={rows} margin={{ top: 8, right: 36, left: 8, bottom: 20 }}>
                <defs>
                  <linearGradient id="gammaTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={offset} stopColor={chart.bull} stopOpacity={0.32} />
                    <stop offset={offset} stopColor={chart.bear} stopOpacity={0.32} />
                  </linearGradient>
                  <linearGradient id="gammaTrendStroke" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={offset} stopColor={chart.bull} />
                    <stop offset={offset} stopColor={chart.bear} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chart.gridLine} opacity={0.5} vertical={false} />
                <SessionBreaks axis={axis} color={chart.borderStrong} />
                <XAxis
                  dataKey="i"
                  type="number"
                  domain={[0, rows.length - 1]}
                  ticks={axis.ticks.map((t) => t.index)}
                  stroke={chart.axisText}
                  tick={axisTick}
                  tickFormatter={(v) => tickLabel.get(Number(v)) ?? ''}
                  // The tick SET is anchored (only round ET times are
                  // candidates); this only thins that set when the labels
                  // would collide on a narrow screen, so a phone drops to
                  // hourly rather than overprinting half-hourly.
                  minTickGap={40}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke={chart.axisText}
                  width={72}
                  domain={gamma.domain}
                  tick={axisTick}
                  tickFormatter={(v) => formatGexAxis(Number(v))}
                />
                {/* The regime boundary. Above it dealers dampen moves, below
                    it they amplify them — worth a rule, not just a gridline.
                    Only drawn when zero is actually in frame; a rule pinned to
                    the floor of a domain that never reaches zero would imply a
                    boundary the session never came near. */}
                {gamma.includesZero && (
                  <ReferenceLine y={0} stroke={chart.borderStrong} strokeWidth={1} />
                )}
                <Tooltip
                  cursor={{ stroke: chart.borderStrong, strokeWidth: 1 }}
                  content={<TrendTooltip chart={chart} />}
                />
                <Area
                  type="monotone"
                  dataKey="gamma"
                  name="Dealer gamma"
                  stroke="url(#gammaTrendStroke)"
                  strokeWidth={2}
                  fill="url(#gammaTrendFill)"
                  baseValue={gamma.includesZero ? 0 : 'dataMin'}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: chart.bgCard }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Zone>

          {/* ── Plot 2: is the flip closing on spot? ───────────────────── */}
          <Zone label="Spot vs gamma flip — the shaded gap is the cushion">
            <ResponsiveContainer width="100%" height={216}>
              <ComposedChart data={rows} margin={{ top: 8, right: 36, left: 8, bottom: 20 }}>
                <CartesianGrid stroke={chart.gridLine} opacity={0.5} vertical={false} />
                <SessionBreaks axis={axis} color={chart.borderStrong} />
                <XAxis
                  dataKey="i"
                  type="number"
                  domain={[0, rows.length - 1]}
                  ticks={axis.ticks.map((t) => t.index)}
                  stroke={chart.axisText}
                  tick={axisTick}
                  tickFormatter={(v) => tickLabel.get(Number(v)) ?? ''}
                  // The tick SET is anchored (only round ET times are
                  // candidates); this only thins that set when the labels
                  // would collide on a narrow screen, so a phone drops to
                  // hourly rather than overprinting half-hourly.
                  minTickGap={40}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke={chart.axisText}
                  width={72}
                  domain={domain}
                  tick={axisTick}
                  tickFormatter={(v) => formatStrike(Number(v))}
                />
                <Tooltip
                  cursor={{ stroke: chart.borderStrong, strokeWidth: 1 }}
                  content={<TrendTooltip chart={chart} price />}
                />
                <Legend
                  verticalAlign="top"
                  height={26}
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 11, color: chart.axisText }}
                />
                {/* The cushion itself. Tinted by what it is doing — thinning
                    reads as a warning — with the same verdict stated in words
                    above, so the meaning is never carried by color alone. */}
                <Area
                  type="monotone"
                  dataKey="band"
                  name="Cushion"
                  stroke="none"
                  fill={toneColor(cTone)}
                  fillOpacity={0.16}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />
                <Line
                  type="monotone"
                  dataKey="spot"
                  name="Spot"
                  stroke={chart.text}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: chart.bgCard }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="flip"
                  name="Gamma flip"
                  stroke={chart.flip}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: chart.bgCard }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Zone>
        </>
      )}

      <Zone>
        <Note>
          Modeled dealer gamma (calls positive, puts negative open-interest convention); actual
          dealer inventory is not directly observable from public option-chain data. Values shown{' '}
          {GEX_UNIT_LABEL[gexUnit]}, summed across the expirations selected above, over the{' '}
          {summary.count} five-minute buckets stored for this session. Gamma and price are plotted
          separately because they are different units — a shared pair of axes would imply a
          crossing point that the data does not contain. The x-axis is one slot per stored
          reading, so hours the market was shut take no width;{' '}
          {axis.breaks.length > 0
            ? 'a dashed rule marks each session boundary that was closed up.'
            : 'ticks land on round ET times rather than on whichever reading happened to fall there.'}
        </Note>
      </Zone>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// sub-render helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * The seam where a closed market was cut out of the axis.
 *
 * Collapsing the overnight gap is what stops most of the plot being dead
 * space, but it also puts 15:55 next to 09:35 — so the join has to be visible
 * or the chart quietly asserts those were consecutive readings. A dashed rule
 * with the resuming session's date is the smallest mark that says "time was
 * removed here" without competing with the data.
 */
function SessionBreaks({ axis, color }: { axis: TrendAxis; color: string }) {
  return (
    <>
      {axis.breaks.map((b) => (
        <ReferenceLine
          key={b.index}
          x={b.index - 0.5}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="3 3"
          label={{
            value: b.label,
            position: 'insideTopLeft',
            fontSize: 10,
            fill: color,
          }}
        />
      ))}
    </>
  );
}

function Stat({
  label,
  value,
  delta,
  tone,
  sentence,
}: {
  label: string;
  value: string;
  delta: string;
  tone: 'bull' | 'bear' | 'warning' | 'muted';
  sentence: string;
}) {
  return (
    <div className="flex-1">
      <div className="zg-label mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-[22px] font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {value}
        </span>
        <span className="font-mono text-[13px]" style={{ color: toneColor(tone) }}>
          {delta}
        </span>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {sentence}
      </p>
    </div>
  );
}

interface TooltipPayloadEntry {
  payload?: ChartRow;
}

/** Shared crosshair readout. Prices and gamma both, so either plot's hover
 *  answers the whole question rather than half of it. */
function TrendTooltip({
  active,
  payload,
  chart,
  price = false,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  chart: ReturnType<typeof useChartTheme>;
  price?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      className="rounded-md px-3 py-2 text-[12px]"
      style={{
        background: chart.tooltipBg,
        border: `1px solid ${chart.tooltipBorder}`,
        color: chart.tooltipText,
      }}
    >
      <div className="mb-1 font-mono" style={{ color: chart.textDim }}>
        {formatEtTime(row.t)}
      </div>
      {price ? (
        <>
          <Row label="Spot" value={formatStrike(row.spot)} color={chart.text} />
          <Row label="Gamma flip" value={formatStrike(row.flip)} color={chart.flip} />
          <Row
            label="Cushion"
            value={row.cushion == null ? '—' : `${formatStrike(Math.abs(row.cushion))} pts`}
            color={chart.textDim}
          />
        </>
      ) : (
        <Row label="Dealer gamma" value={formatSignedGex(row.gamma)} color={chart.text} />
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-4 font-mono">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

/** The WCAG-clean twin of the plots — every value reachable without color,
 *  hover, or the ability to read a line. */
function TrendTable({ points }: { points: GammaTrendPoint[] }) {
  // Newest first: the current reading is the one a reader wants without
  // scrolling to the bottom of a session's worth of rows.
  const rows = [...points].reverse();
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full font-mono text-[12px]">
        <thead className="sticky top-0" style={{ background: 'var(--bg-card)' }}>
          <tr style={{ color: 'var(--text-secondary)' }}>
            <th className="px-2 py-1.5 text-left font-medium">Time (ET)</th>
            <th className="px-2 py-1.5 text-right font-medium">Dealer gamma</th>
            <th className="px-2 py-1.5 text-right font-medium">Spot</th>
            <th className="px-2 py-1.5 text-right font-medium">Gamma flip</th>
            <th className="px-2 py-1.5 text-right font-medium">Cushion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.timestamp} style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <td className="px-2 py-1.5" style={{ color: 'var(--text-secondary)' }}>
                {formatEtTime(p.t)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {formatSignedGex(p.gamma)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {formatStrike(p.spot)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {formatStrike(p.flip)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {p.cushion == null ? '—' : formatStrike(Math.abs(p.cushion))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
