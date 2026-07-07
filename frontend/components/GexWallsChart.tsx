'use client';

import { useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Info, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import ExpandableCard from './ExpandableCard';
import TooltipWrapper from './TooltipWrapper';
import MobileScrollableChart from './MobileScrollableChart';
import StrikeRangeScrollbar from './StrikeRangeScrollbar';
import { useIsMobile } from '@/hooks/useIsMobile';

// Each zoom click narrows / widens the visible strike range by this factor.
// 1.4 is roughly the geometric mean of 1 and 2, giving comfortable single-
// click steps without bouncing across the whole chain.
const X_ZOOM_STEP = 1.4;

// Pick a 1 / 2 / 5 × 10^k step that gives roughly `targetCount` ticks across
// the given range. The same cadence as the y-axis helpers elsewhere — yields
// labels like 580/585/590 rather than 581.5/583/584.5.
function niceStep(range: number, targetCount: number): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const rough = range / Math.max(1, targetCount);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / magnitude;
  if (norm < 1.5) return 1 * magnitude;
  if (norm < 3.5) return 2 * magnitude;
  if (norm < 7.5) return 5 * magnitude;
  return 10 * magnitude;
}

// Generate evenly-spaced x-axis ticks across the visible strike range. Floor
// at step=1 so we never sub-divide a strike.
function selectStrikeTicks(visibleDomain: [number, number]): number[] {
  const [lo, hi] = visibleDomain;
  const range = hi - lo;
  if (range <= 0) return [];
  const step = Math.max(1, niceStep(range, 8));
  const start = Math.ceil(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + 1e-9; v += step) {
    ticks.push(v);
  }
  return ticks;
}

interface OpenInterestRow {
  strike?: number | string;
  expiration?: string;
  option_type?: string | null;
  open_interest?: number | string | null;
  exposure?: number | string | null;
  call_oi?: number | string | null;
  put_oi?: number | string | null;
  call_exposure?: number | string | null;
  put_exposure?: number | string | null;
}

interface GexWallsChartProps {
  openInterestData?: OpenInterestRow[] | null;
  spotPrice?: number | string | null;
  byStrikeFallback?: Array<{ strike?: number | string; call_oi?: number | string | null; put_oi?: number | string | null }> | null;
}

type DisplayMode = 'oi' | 'gamma' | 'notional';

type ChartRow = {
  strike: number;
  strikeLabel: string;
  callValue: number;
  putValue: number;
};

function asNum(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAxisValue(value: number, mode: DisplayMode): string {
  const abs = Math.abs(value);
  const isDollar = mode === 'gamma' || mode === 'notional';
  const prefix = isDollar ? '$' : '';
  if (abs >= 1e9) return `${prefix}${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${prefix}${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${prefix}${(value / 1e3).toFixed(0)}k`;
  return `${prefix}${value.toFixed(isDollar ? 2 : 0)}`;
}

function formatTooltipValue(value: number, mode: DisplayMode): string {
  if (mode === 'gamma' || mode === 'notional') {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return value.toLocaleString();
}

function modeLabel(mode: DisplayMode): string {
  if (mode === 'oi') return 'OI';
  if (mode === 'gamma') return '$ Gamma';
  return 'Notional';
}

function WallMapTooltip({
  active,
  payload,
  label,
  mode,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string;
  mode: DisplayMode;
}) {
  if (!active || !payload?.length) return null;
  const unitLabel = modeLabel(mode);
  return (
    <div style={{ background: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', color: 'var(--color-chart-tooltip-text)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Strike {label}</div>
      {payload.map((entry, i) => {
        if (entry.dataKey === 'callValue') {
          return <div key={i} style={{ color: 'var(--color-bull)' }}>Call {unitLabel}: {formatTooltipValue(Number(entry.value), mode)}</div>;
        }
        if (entry.dataKey === 'putValue') {
          return <div key={i} style={{ color: 'var(--color-bear)' }}>Put {unitLabel}: {formatTooltipValue(Number(entry.value), mode)}</div>;
        }
        return null;
      })}
    </div>
  );
}

export default function GexWallsChart({ openInterestData, spotPrice, byStrikeFallback }: GexWallsChartProps) {
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const isDark = theme === 'dark';
  const textColor = 'var(--text-primary)';
  const axisStroke = 'var(--color-text-primary)';
  const gridStroke = isDark ? 'var(--color-text-secondary)' : 'var(--color-border)';
  const inputBg = 'var(--color-surface-subtle)';
  const inputBorder = 'var(--color-border)';
  const inputColor = 'var(--color-text-primary)';

  const expirationOptions = useMemo(() => {
    const source = openInterestData || [];
    return Array.from(new Set(source.map((row) => String(row.expiration || '')).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [openInterestData]);

  const [selectedExpiration, setSelectedExpiration] = useState<string>('all');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('oi');

  const chartData = useMemo<ChartRow[]>(() => {
    const source = openInterestData || [];
    const filtered = selectedExpiration === 'all' ? source : source.filter((row) => String(row.expiration || '') === selectedExpiration);
    const grouped = new Map<number, ChartRow>();

    filtered.forEach((row) => {
      const strike = asNum(row.strike);
      if (!Number.isFinite(strike) || strike <= 0) return;
      const existing = grouped.get(strike) ?? { strike, strikeLabel: strike.toFixed(0), callValue: 0, putValue: 0 };
      const optionType = String(row.option_type || '').toUpperCase();
      // Per-contract value for this row's display mode.  Notional is
      // strike × multiplier × OI — the dollar value of underlying
      // controlled if exercised at this strike, the standard derivative-
      // industry definition of position size.
      const oi = asNum(row.open_interest);
      const value =
        displayMode === 'oi'
          ? oi
          : displayMode === 'notional'
            ? oi * 100 * strike
            : asNum(row.exposure);

      if (optionType.startsWith('C')) {
        existing.callValue += value;
      } else if (optionType.startsWith('P')) {
        existing.putValue += value;
      } else {
        const callOi = asNum(row.call_oi);
        const putOi = asNum(row.put_oi);
        if (displayMode === 'oi') {
          existing.callValue += callOi;
          existing.putValue += putOi;
        } else if (displayMode === 'notional') {
          existing.callValue += callOi * 100 * strike;
          existing.putValue += putOi * 100 * strike;
        } else {
          existing.callValue += asNum(row.call_exposure);
          existing.putValue += asNum(row.put_exposure);
        }
      }
      grouped.set(strike, existing);
    });

    let rows = Array.from(grouped.values());

    if (rows.length === 0 && displayMode !== 'gamma' && byStrikeFallback?.length) {
      byStrikeFallback.forEach((row) => {
        const strike = asNum(row.strike);
        if (!Number.isFinite(strike) || strike <= 0) return;
        const existing = grouped.get(strike) ?? { strike, strikeLabel: strike.toFixed(0), callValue: 0, putValue: 0 };
        const callOi = asNum(row.call_oi);
        const putOi = asNum(row.put_oi);
        if (displayMode === 'notional') {
          existing.callValue += callOi * 100 * strike;
          existing.putValue += putOi * 100 * strike;
        } else {
          existing.callValue += callOi;
          existing.putValue += putOi;
        }
        grouped.set(strike, existing);
      });
      rows = Array.from(grouped.values());
    }

    return rows.sort((a, b) => a.strike - b.strike);
  }, [openInterestData, selectedExpiration, displayMode, byStrikeFallback]);

  const spot = asNum(spotPrice);

  const closestStrike = useMemo(() => {
    if (spot <= 0 || !chartData.length) return null;
    const closest = chartData.reduce((best, row) =>
      Math.abs(row.strike - spot) < Math.abs(best.strike - spot) ? row : best,
    );
    return closest.strike;
  }, [spot, chartData]);

  // The full strike range available in the filtered data — the boundary of
  // how far out the user can pan / zoom out.
  const fullStrikeDomain = useMemo<[number, number] | null>(() => {
    if (chartData.length === 0) return null;
    const strikes = chartData.map((r) => r.strike).filter((s) => Number.isFinite(s));
    if (strikes.length === 0) return null;
    return [Math.min(...strikes), Math.max(...strikes)];
  }, [chartData]);

  // visibleDomain controls ONLY which slice of strikes the XAxis renders;
  // the chart container width and the YAxis stay put. `null` until data
  // arrives, then initialised to the full range (zoomed out).
  const [visibleDomain, setVisibleDomain] = useState<[number, number] | null>(null);

  if (fullStrikeDomain != null) {
    if (visibleDomain == null) {
      setVisibleDomain(fullStrikeDomain);
    } else if (
      visibleDomain[0] < fullStrikeDomain[0] ||
      visibleDomain[1] > fullStrikeDomain[1]
    ) {
      const start = Math.max(fullStrikeDomain[0], visibleDomain[0]);
      const end = Math.min(fullStrikeDomain[1], visibleDomain[1]);
      if (end > start) setVisibleDomain([start, end]);
    }
  }

  const handleZoomIn = () => {
    if (!visibleDomain || !fullStrikeDomain) return;
    const [start, end] = visibleDomain;
    const center = (start + end) / 2;
    const newHalfWidth = (end - start) / 2 / X_ZOOM_STEP;
    let newStart = center - newHalfWidth;
    let newEnd = center + newHalfWidth;
    newStart = Math.max(fullStrikeDomain[0], newStart);
    newEnd = Math.min(fullStrikeDomain[1], newEnd);
    const fullSpan = fullStrikeDomain[1] - fullStrikeDomain[0];
    const minSpan = Math.max(1, fullSpan * 0.02);
    if (newEnd - newStart < minSpan) return;
    setVisibleDomain([newStart, newEnd]);
  };

  const handleZoomOut = () => {
    if (!visibleDomain || !fullStrikeDomain) return;
    const [start, end] = visibleDomain;
    const center = (start + end) / 2;
    const newHalfWidth = ((end - start) / 2) * X_ZOOM_STEP;
    let newStart = center - newHalfWidth;
    let newEnd = center + newHalfWidth;
    if (newStart < fullStrikeDomain[0]) {
      newStart = fullStrikeDomain[0];
      newEnd = Math.min(fullStrikeDomain[1], newStart + 2 * newHalfWidth);
    }
    if (newEnd > fullStrikeDomain[1]) {
      newEnd = fullStrikeDomain[1];
      newStart = Math.max(fullStrikeDomain[0], newEnd - 2 * newHalfWidth);
    }
    setVisibleDomain([newStart, newEnd]);
  };

  const handleResetView = () => {
    if (!fullStrikeDomain) return;
    setVisibleDomain(fullStrikeDomain);
  };

  const isFullyZoomedOut =
    visibleDomain != null &&
    fullStrikeDomain != null &&
    visibleDomain[0] <= fullStrikeDomain[0] + 1e-6 &&
    visibleDomain[1] >= fullStrikeDomain[1] - 1e-6;

  // Explicit ticks at uniform-step strikes (1, 2, 5, 10… depending on the
  // visible range) so every tick lands on a clean integer and minTickGap
  // doesn't skip labels mid-axis.
  const xTicks = useMemo(() => {
    if (visibleDomain == null) return undefined;
    return selectStrikeTicks(visibleDomain);
  }, [visibleDomain]);

  const renderLegend = () => (
    <div className="w-full flex flex-wrap justify-end items-center gap-4 text-xs" style={{ color: textColor }}>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--color-bull)' }} />
        Call {modeLabel(displayMode)}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--color-bear)' }} />
        Put {modeLabel(displayMode)}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4" style={{ backgroundColor: 'var(--color-gold)' }} />
        Spot (nearest strike)
      </div>
    </div>
  );

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart">
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `1px solid ${'var(--text-secondary)'}`,
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="zg-h3" style={{ color: textColor }}>
              Open Interest &amp; Exposure by Strike
            </h3>
            <TooltipWrapper text="Strike-level view by call/put with three toggleable units. OI = open contracts outstanding (raw count). $ Gamma = dealer dollar gamma exposure (sign × γ × OI × 100 × spot) — the same fundamental quantity as the Gamma Exposure by Strike chart above, just measured per $1 spot move instead of per 1% spot move (differ by a factor of spot × 0.01); puts negative, calls positive. Notional = strike × 100 × OI — the dollar value of underlying that would change hands if every contract at this strike were exercised (industry-standard option position notional). The yellow dotted line marks spot at the nearest strike.">
              <Info size={14} />
            </TooltipWrapper>
            <div
              className="ml-1 inline-flex rounded border"
              style={{ borderColor: inputBorder, backgroundColor: inputBg }}
            >
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={isFullyZoomedOut}
                title="Zoom out (widen visible strike range)"
                className="px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <ZoomOut size={12} />
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom in (narrow visible strike range)"
                className="px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-secondary)', borderLeft: `1px solid ${inputBorder}` }}
              >
                <ZoomIn size={12} />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                disabled={isFullyZoomedOut}
                title="Reset to full strike range"
                className="px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-secondary)', borderLeft: `1px solid ${inputBorder}` }}
              >
                <RotateCcw size={12} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 mr-8">
            <label className="text-xs" style={{ color: textColor }}>
              Expiration
              <select
                className="ml-2 rounded px-2 py-1"
                style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputColor, border: `1px solid ${inputBorder}` }}
                value={selectedExpiration}
                onChange={(e) => setSelectedExpiration(e.target.value)}
              >
                <option value="all">All</option>
                {expirationOptions.map((exp) => <option key={exp} value={exp}>{exp}</option>)}
              </select>
            </label>
            <div className="inline-flex rounded border" style={{ borderColor: inputBorder, backgroundColor: inputBg }}>
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-semibold"
                style={{
                  color: displayMode === 'oi' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: displayMode === 'oi' ? 'var(--color-info-soft)' : 'transparent',
                }}
                onClick={() => setDisplayMode('oi')}
                title="Open interest (contracts outstanding)"
              >
                OI
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-semibold"
                style={{
                  color: displayMode === 'gamma' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: displayMode === 'gamma' ? 'var(--color-info-soft)' : 'transparent',
                  borderLeft: `1px solid ${inputBorder}`,
                }}
                onClick={() => setDisplayMode('gamma')}
                title="Dealer dollar gamma exposure per $1 spot move (sign × γ × OI × 100 × spot)"
              >
                $ Gamma
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-semibold"
                style={{
                  color: displayMode === 'notional' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: displayMode === 'notional' ? 'var(--color-info-soft)' : 'transparent',
                  borderLeft: `1px solid ${inputBorder}`,
                }}
                onClick={() => setDisplayMode('notional')}
                title="Notional value of position (strike × 100 × OI) — dollars of underlying that would change hands at exercise"
              >
                Notional
              </button>
            </div>
          </div>
        </div>

        {!chartData.length ? (
          <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: 'var(--text-secondary)' }}>
            No open-interest data available for the selected expiration.
          </div>
        ) : (
          <MobileScrollableChart>
            <ResponsiveContainer width="100%" height={isMobile ? 290 : 340}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 24, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.3} />
                <XAxis dataKey="strike" type="number" domain={visibleDomain ?? ['dataMin', 'dataMax']} allowDataOverflow ticks={xTicks} padding={{ left: 20, right: 20 }} stroke={axisStroke} tick={{ fontSize: 11, fill: axisStroke }} tickFormatter={(v) => Math.round(Number(v)).toString()} minTickGap={22} />
                <YAxis
                  yAxisId="value"
                  stroke={axisStroke}
                  tick={{ fontSize: 11, fill: axisStroke }}
                  tickFormatter={(v) => formatAxisValue(Number(v), displayMode)}
                  label={{
                    value:
                      displayMode === 'oi'
                        ? 'Open Interest (contracts)'
                        : displayMode === 'gamma'
                          ? '$ Gamma (per $1 move)'
                          : 'Notional ($ at exercise)',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 8,
                    style: { fill: axisStroke, fontSize: 11, textAnchor: 'middle' },
                  }}
                />
                <Tooltip content={<WallMapTooltip mode={displayMode} />} />
                <Legend verticalAlign="top" align="right" content={renderLegend} wrapperStyle={{ top: 0, right: 0 }} />
                <Bar yAxisId="value" dataKey="callValue" name={`Call ${modeLabel(displayMode)}`} fill={'var(--color-bull)'} opacity={1} barSize={14} />
                <Bar yAxisId="value" dataKey="putValue" name={`Put ${modeLabel(displayMode)}`} fill={'var(--color-bear)'} opacity={1} barSize={14} />

                {closestStrike != null && (
                  <ReferenceLine yAxisId="value" x={closestStrike} stroke="var(--color-gold)" strokeDasharray="4 4" label={{ value: `Spot ${spot.toFixed(2)}`, fill: 'var(--color-gold)', position: 'top', fontSize: 11 }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </MobileScrollableChart>
        )}
        {chartData.length > 0 && visibleDomain && fullStrikeDomain && (
          <div className="mt-2 px-2">
            <StrikeRangeScrollbar
              visibleDomain={visibleDomain}
              fullDomain={fullStrikeDomain}
              onChange={setVisibleDomain}
            />
          </div>
        )}
      </div>
    </ExpandableCard>
  );
}
