'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Info } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import { useFlipTermStructure } from '@/hooks/useApiData';
import { useIsMobile } from '@/hooks/useIsMobile';
import ExpandableCard from './ExpandableCard';
import TooltipWrapper from './TooltipWrapper';
import MobileScrollableChart from './MobileScrollableChart';

interface FlipTermStructureChartProps {
  symbol: string;
}

const DEFAULT_HORIZONS = [1, 3, 5, 10, 20, 60];
const AVAILABLE_HORIZONS = [0.5, 1, 3, 5, 10, 20, 60, 120];

const FLIP_LINE_COLOR = '#C9A36A';
const HISTORICAL_COLOR = '#8FA8C9';
const SPOT_COLOR = '#06B6D4';

function formatHorizon(days: number): string {
  if (!Number.isFinite(days)) return '';
  if (days < 1) {
    const hours = days * 24;
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  }
  return Number.isInteger(days) ? `${days}d` : `${days.toFixed(1)}d`;
}

function formatUsd(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '--';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function formatGex(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : value > 0 ? '+' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatSpan(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  return `${(value * 100).toFixed(1)}%`;
}

function formatDrift(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

interface ChartRow {
  horizon: number;
  todayFlip: number | null;
  unresolvedY: number | null;
  historicalFlip: number | null;
  spanUsed: number;
  netGexAtSpot: number | null;
  resolved: boolean;
}

type FlipDotPayload = ChartRow;

function renderTodayFlipDot(props: {
  cx?: number;
  cy?: number;
  payload?: FlipDotPayload;
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || payload == null) return <g />;
  if (payload.todayFlip == null) return <g />;
  const sign = payload.netGexAtSpot;
  const fill = sign == null
    ? FLIP_LINE_COLOR
    : sign >= 0
      ? 'var(--color-brand-accent)'
      : 'var(--color-bear)';
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={fill} stroke="var(--color-surface)" strokeWidth={1.25} />
    </g>
  );
}

function renderHistoricalDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return <g />;
  const s = 5.5;
  return (
    <g>
      <polygon
        points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`}
        fill="none"
        stroke={HISTORICAL_COLOR}
        strokeWidth={1.5}
      />
    </g>
  );
}

function renderUnresolvedDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return <g />;
  const s = 5;
  return (
    <g stroke={'var(--color-bear)'} strokeWidth={2} strokeLinecap="round">
      <line x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} />
      <line x1={cx - s} y1={cy + s} x2={cx + s} y2={cy - s} />
    </g>
  );
}

interface FlipTooltipPayload {
  payload?: ChartRow;
}

function FlipTooltip({
  active,
  payload,
  spot,
}: {
  active?: boolean;
  payload?: FlipTooltipPayload[];
  spot: number | null;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const drift =
    row.todayFlip != null && row.historicalFlip != null
      ? row.todayFlip - row.historicalFlip
      : null;
  return (
    <div
      style={{
        background: 'var(--color-chart-tooltip-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '8px 12px',
        color: 'var(--color-chart-tooltip-text)',
        fontSize: 12,
        minWidth: 220,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        Horizon {formatHorizon(row.horizon)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px' }}>
        <span style={{ opacity: 0.75 }}>Today&apos;s flip</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          {row.resolved ? formatUsd(row.todayFlip) : 'unresolved'}
        </span>
        <span style={{ opacity: 0.75 }}>Span used</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          {formatSpan(row.spanUsed)}
        </span>
        <span style={{ opacity: 0.75 }}>Net GEX @ spot</span>
        <span
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            color:
              row.netGexAtSpot == null
                ? undefined
                : row.netGexAtSpot >= 0
                  ? 'var(--color-brand-accent)'
                  : 'var(--color-bear)',
          }}
        >
          {formatGex(row.netGexAtSpot)}
        </span>
        <span style={{ opacity: 0.75 }}>Historical (h-ago)</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          {formatUsd(row.historicalFlip)}
        </span>
        <span style={{ opacity: 0.75 }}>Drift</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          {formatDrift(drift)}
        </span>
        {spot != null && (
          <>
            <span style={{ opacity: 0.75 }}>Spot</span>
            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
              {formatUsd(spot)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default function FlipTermStructureChart({ symbol }: FlipTermStructureChartProps) {
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const isDark = theme === 'dark';
  const textColor = 'var(--text-primary)';
  const axisStroke = 'var(--color-text-primary)';
  const gridStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const mutedText = isDark ? 'var(--text-secondary)' : 'var(--color-text-secondary)';

  const [selectedHorizons, setSelectedHorizons] = useState<number[]>(DEFAULT_HORIZONS);

  const { data, loading, error } = useFlipTermStructure(symbol, selectedHorizons, 7000);

  const { chartData, priceDomain } = useMemo(() => {
    if (!data) return { chartData: [] as ChartRow[], priceDomain: undefined };
    const historicalByHorizon = new Map<number, number | null>();
    (data.historical ?? []).forEach((h) => {
      historicalByHorizon.set(h.horizon_days, h.flip);
    });

    const rows: ChartRow[] = (data.curve ?? [])
      .slice()
      .sort((a, b) => a.horizon_days - b.horizon_days)
      .map((c) => ({
        horizon: c.horizon_days,
        todayFlip: c.resolved ? c.flip : null,
        unresolvedY: c.resolved ? null : data.spot,
        historicalFlip: historicalByHorizon.get(c.horizon_days) ?? null,
        spanUsed: c.span_used,
        netGexAtSpot: c.net_gex_at_spot,
        resolved: c.resolved,
      }));

    const prices: number[] = [];
    if (Number.isFinite(data.spot)) prices.push(data.spot);
    rows.forEach((r) => {
      if (r.todayFlip != null && Number.isFinite(r.todayFlip)) prices.push(r.todayFlip);
      if (r.historicalFlip != null && Number.isFinite(r.historicalFlip)) prices.push(r.historicalFlip);
    });
    if (prices.length === 0) return { chartData: rows, priceDomain: undefined };
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    const span = hi - lo;
    const pad = span < 1 ? Math.max(5, hi * 0.005) : span * 0.15;
    return { chartData: rows, priceDomain: [lo - pad, hi + pad] as [number, number] };
  }, [data]);

  const horizonTicks = useMemo(() => selectedHorizons.slice().sort((a, b) => a - b), [selectedHorizons]);
  const horizonDomain = useMemo<[number, number] | undefined>(() => {
    if (horizonTicks.length === 0) return undefined;
    const lo = horizonTicks[0];
    const hi = horizonTicks[horizonTicks.length - 1];
    return [lo / 1.2, hi * 1.2];
  }, [horizonTicks]);

  const toggleHorizon = (h: number) => {
    setSelectedHorizons((current) => {
      if (current.includes(h)) {
        if (current.length <= 1) return current;
        return current.filter((v) => v !== h);
      }
      return [...current, h].sort((a, b) => a - b);
    });
  };

  const applyPreset = (preset: number[]) => {
    setSelectedHorizons(preset);
  };

  const hasData = chartData.length > 0;
  const hasHistorical = chartData.some((row) => row.historicalFlip != null);
  const anyUnresolved = chartData.some((row) => !row.resolved);

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart" className="h-full">
      <div
        className="rounded-2xl p-6 h-full flex flex-col"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `1px solid ${'var(--text-secondary)'}`,
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <h3 className="zg-h3" style={{ color: textColor }}>
            Gamma Flip · Term Structure
          </h3>
          <TooltipWrapper text="Today's resolved gamma-flip price across option horizons (1d → 60d), versus the persisted production flip from h days ago. The line traces today's flip; markers carry sign info via color. Diamond outlines mark the production flip that was recorded h days ago — read 'above spot' as 'regime sat above price then', not 'h-day flip h days ago.' Red X markers flag horizons where the resolver could not land an interior crossing inside the scan span.">
            <Info size={14} />
          </TooltipWrapper>
        </div>

        {/* Horizon controls */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs" style={{ color: mutedText }}>Horizons:</span>
          {AVAILABLE_HORIZONS.map((h) => {
            const active = selectedHorizons.includes(h);
            return (
              <button
                key={h}
                type="button"
                onClick={() => toggleHorizon(h)}
                className="px-2.5 py-1 text-xs rounded border transition-colors"
                style={
                  active
                    ? {
                        backgroundColor: 'var(--color-info-soft)',
                        borderColor: 'var(--color-info)',
                        color: 'var(--text-primary)',
                      }
                    : {
                        backgroundColor: 'var(--color-surface-subtle)',
                        borderColor: 'var(--color-border)',
                        color: mutedText,
                      }
                }
                title={`Toggle ${formatHorizon(h)} horizon`}
              >
                {formatHorizon(h)}
              </button>
            );
          })}
          <div className="ml-2 inline-flex gap-1">
            <button
              type="button"
              onClick={() => applyPreset([1, 3, 5, 10, 20, 60])}
              className="px-2 py-1 text-xs rounded border"
              style={{
                backgroundColor: 'var(--color-surface-subtle)',
                borderColor: 'var(--color-border)',
                color: mutedText,
              }}
              title="Apply default 1/3/5/10/20/60 preset"
            >
              Std
            </button>
            <button
              type="button"
              onClick={() => applyPreset([0.5, 1, 3, 5])}
              className="px-2 py-1 text-xs rounded border"
              style={{
                backgroundColor: 'var(--color-surface-subtle)',
                borderColor: 'var(--color-border)',
                color: mutedText,
              }}
              title="Short-dated preset"
            >
              Short
            </button>
            <button
              type="button"
              onClick={() => applyPreset([10, 20, 60, 120])}
              className="px-2 py-1 text-xs rounded border"
              style={{
                backgroundColor: 'var(--color-surface-subtle)',
                borderColor: 'var(--color-border)',
                color: mutedText,
              }}
              title="Long-dated preset"
            >
              Long
            </button>
          </div>
        </div>

        {/* Fixed minHeight prevents the page from bouncing as the chart
            transitions between loading / error / data states. */}
        <div className="flex-1" style={{ minHeight: isMobile ? 520 : 520 }}>
          {error ? (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--color-bear)' }}>
              {error === 'No data available yet'
                ? `No usable option snapshot for ${symbol} — check ingestion.`
                : `Backend error: ${error}`}
            </div>
          ) : loading && !data ? (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: mutedText }}>
              Loading term structure…
            </div>
          ) : !hasData ? (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: mutedText }}>
              No term-structure data available.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
              <MobileScrollableChart>
                <ResponsiveContainer width="100%" height={isMobile ? 360 : 460}>
                  <ComposedChart
                    layout="vertical"
                    data={chartData}
                    margin={{ top: 12, right: 24, left: 16, bottom: 24 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                    <XAxis
                      type="number"
                      domain={priceDomain ?? ['dataMin', 'dataMax']}
                      stroke={axisStroke}
                      tick={{ fontSize: 11, fill: axisStroke }}
                      tickFormatter={(v) => formatUsd(Number(v), 0)}
                      label={{
                        value: 'Flip price (USD)',
                        position: 'insideBottom',
                        offset: -10,
                        fill: axisStroke,
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      dataKey="horizon"
                      type="number"
                      scale="log"
                      domain={horizonDomain ?? ['dataMin', 'dataMax']}
                      allowDataOverflow
                      ticks={horizonTicks}
                      reversed
                      width={64}
                      stroke={axisStroke}
                      tick={{ fontSize: 11, fill: axisStroke }}
                      tickFormatter={(v) => formatHorizon(Number(v))}
                      label={{
                        value: 'Horizon (days, log)',
                        angle: -90,
                        position: 'insideLeft',
                        offset: 8,
                        style: { fill: axisStroke, fontSize: 11, textAnchor: 'middle' },
                      }}
                    />
                    <Tooltip content={<FlipTooltip spot={data?.spot ?? null} />} />

                    {data?.spot != null && Number.isFinite(data.spot) && (
                      <ReferenceLine
                        x={data.spot}
                        stroke={SPOT_COLOR}
                        strokeDasharray="4 4"
                        label={{
                          value: `Spot: ${formatUsd(data.spot, 2)}`,
                          position: 'top',
                          fill: SPOT_COLOR,
                          fontSize: 10,
                        }}
                      />
                    )}

                    {/* Today's flip line.  connectNulls=false skips unresolved
                        horizons so they appear as gaps, with the red-X scatter
                        series taking over the gap visually. */}
                    <Line
                      type="monotone"
                      dataKey="todayFlip"
                      name="Today's flip"
                      stroke={FLIP_LINE_COLOR}
                      strokeWidth={2}
                      dot={renderTodayFlipDot}
                      activeDot={{ r: 7, fill: FLIP_LINE_COLOR }}
                      isAnimationActive={false}
                      connectNulls={false}
                    />

                    {/* Historical persisted flip from h days ago — diamond outlines. */}
                    <Scatter
                      dataKey="historicalFlip"
                      name="h-ago flip"
                      shape={renderHistoricalDot}
                      isAnimationActive={false}
                    />

                    {/* Unresolved horizons rendered as red X markers at the spot
                        level so a too-narrow chain reads visually instead of as
                        missing data. */}
                    <Scatter
                      dataKey="unresolvedY"
                      name="Unresolved"
                      shape={renderUnresolvedDot}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </MobileScrollableChart>

              {/* Right column: per-horizon table, vertical legend, and the
                  h-ago caveat — all stacked so the chart stays uncluttered. */}
              <div className="flex flex-col gap-4 overflow-y-auto">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--color-border)', color: mutedText }}>
                        <th className="text-left py-2 px-2">Horizon</th>
                        <th className="text-right py-2 px-2">Today&apos;s flip</th>
                        <th className="text-right py-2 px-2">Span used</th>
                        <th className="text-right py-2 px-2">Net GEX @ spot</th>
                        <th className="text-right py-2 px-2">h-ago flip</th>
                        <th className="text-right py-2 px-2">Drift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((row) => {
                        const drift =
                          row.todayFlip != null && row.historicalFlip != null
                            ? row.todayFlip - row.historicalFlip
                            : null;
                        const gexColor =
                          row.netGexAtSpot == null
                            ? undefined
                            : row.netGexAtSpot >= 0
                              ? 'var(--color-bull)'
                              : 'var(--color-bear)';
                        return (
                          <tr key={row.horizon} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <td className="text-left py-1.5 px-2 font-mono" style={{ color: textColor }}>
                              {formatHorizon(row.horizon)}
                            </td>
                            <td className="text-right py-1.5 px-2 font-mono">
                              {row.resolved ? formatUsd(row.todayFlip) : <span style={{ color: 'var(--color-bear)' }}>unresolved</span>}
                            </td>
                            <td className="text-right py-1.5 px-2 font-mono">{formatSpan(row.spanUsed)}</td>
                            <td className="text-right py-1.5 px-2 font-mono font-semibold" style={{ color: gexColor }}>
                              {formatGex(row.netGexAtSpot)}
                            </td>
                            <td className="text-right py-1.5 px-2 font-mono">{formatUsd(row.historicalFlip)}</td>
                            <td className="text-right py-1.5 px-2 font-mono">
                              {drift == null ? (
                                '--'
                              ) : (
                                <span
                                  style={{
                                    color: drift >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
                                  }}
                                >
                                  {formatDrift(drift)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Vertical legend text box — sized to fit its content
                    (self-start + w-fit) instead of stretching the column. */}
                <div
                  className="rounded-md border p-3 text-xs self-start w-fit"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-surface-subtle)',
                    color: textColor,
                  }}
                >
                  <div className="font-semibold uppercase tracking-wider text-[10px] mb-2" style={{ color: mutedText }}>
                    Legend
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    <li className="flex items-center gap-2">
                      <span className="inline-block h-0.5 w-4 shrink-0" style={{ backgroundColor: FLIP_LINE_COLOR }} />
                      <span>Today&apos;s flip</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-brand-accent)' }} />
                      <span>Long γ (positive net GEX at spot)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-bear)' }} />
                      <span>Short γ (negative net GEX at spot)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 shrink-0"
                        style={{
                          border: `1.5px solid ${HISTORICAL_COLOR}`,
                          transform: 'rotate(45deg)',
                        }}
                      />
                      <span>h-ago flip</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 shrink-0 text-center"
                        style={{ color: 'var(--color-bear)', fontWeight: 700, fontSize: 14, lineHeight: 1 }}
                      >
                        ×
                      </span>
                      <span>Unresolved horizon</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span
                        className="inline-block h-0.5 w-4 shrink-0"
                        style={{
                          backgroundImage: `repeating-linear-gradient(90deg, ${SPOT_COLOR} 0 4px, transparent 4px 8px)`,
                          height: 2,
                        }}
                      />
                      <span>Spot</span>
                    </li>
                  </ul>
                </div>

                {/* h-ago note as a text box — sits under the legend. */}
                {hasHistorical && (
                  <div
                    className="rounded-md border p-3 text-[11px] leading-relaxed"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-surface-subtle)',
                      color: mutedText,
                    }}
                  >
                    <strong>h-ago dots:</strong> the persisted rows were written with the production
                    DTE_REF_DAYS (5d), so they are &ldquo;production flip h days ago,&rdquo; not
                    &ldquo;h-day-horizon flip h days ago.&rdquo; A diamond above today&apos;s spot means the
                    regime sat above price h days ago; below means it sat below.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {anyUnresolved && !hasHistorical && (
          <p className="mt-2 text-[11px]" style={{ color: mutedText }}>
            Red × markers flag horizons where the resolver could not land an interior crossing inside the
            scan span — widen the chain or expand span_pct on the backend.
          </p>
        )}

        {data?.timestamp && (
          <div className="mt-3 text-right text-[11px]" style={{ color: mutedText }}>
            Snapshot: {new Date(data.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </ExpandableCard>
  );
}
