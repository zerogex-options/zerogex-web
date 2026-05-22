'use client';

import { useMemo } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Info } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import { useGEXProfile } from '@/hooks/useApiData';
import { useIsMobile } from '@/hooks/useIsMobile';
import ExpandableCard from './ExpandableCard';
import TooltipWrapper from './TooltipWrapper';
import MobileScrollableChart from './MobileScrollableChart';

interface StrikeRow {
  strike: number;
  netGex: number;
  callGex: number;
  putGex: number;
}

interface GexProfileChartProps {
  symbol: string;
  strikeData: StrikeRow[];
  spotPrice?: number | null;
  gammaFlip?: number | null;
  callWall?: number | null;
  putWall?: number | null;
}

interface MergedRow {
  strike: number;
  callGex?: number;
  putGex?: number;
  netGex?: number;
  profileGex?: number;
}

const PROFILE_LINE_COLOR = '#C9A36A';
const PROFILE_FILL_COLOR = 'rgba(201, 163, 106, 0.18)';
const NET_LINE_COLOR = '#94A3B8';

// Match the bar width used by GexWallsChart (OPEN INTEREST & EXPOSURE BY
// STRIKE) so the two stacked charts read as a cohesive pair.
const BAR_SIZE = 14;

function formatExposure(value: number): string {
  const abs = Math.abs(value);
  if (!Number.isFinite(value) || abs === 0) return '0';
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

interface Denomination {
  divisor: number;
  suffix: string;
}

// Pick the denomination off the LARGER of the two axes (typically the
// profile axis — each profile point integrates the full chain) so both
// y-axes can share it.  Mixing M and B on stacked axes makes "is the
// profile bigger than the bars?" require mental arithmetic; one suffix
// makes the comparison visual.
function pickSharedDenomination(maxAbs: number): Denomination {
  if (maxAbs >= 1e9) return { divisor: 1e9, suffix: 'B' };
  if (maxAbs >= 1e6) return { divisor: 1e6, suffix: 'M' };
  if (maxAbs >= 1e3) return { divisor: 1e3, suffix: 'K' };
  return { divisor: 1, suffix: '' };
}

function formatTick(value: number, denom: Denomination): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';
  const scaled = value / denom.divisor;
  const abs = Math.abs(scaled);
  // 1 decimal place keeps the labels uniform width and matches the
  // user-visible style ($0.5B, $1.0B, $2.5B).  Drop to whole numbers
  // once we're past 10× the denomination so we don't overrun the axis
  // with redundant trailing zeros ("$12.0B" → "$12B").
  const text = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
  return `${scaled < 0 ? '-' : ''}$${text}${denom.suffix}`;
}

function formatStrike(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value >= 1000 ? value.toFixed(0) : value.toFixed(2);
}

// Pick a "nice" step (1, 2, 5 × 10^k) that lands ~targetCount ticks across
// the half-range.  Both y-axes need symmetric ticks centred on 0 with clean
// round values like $1B, $2B — recharts' default tick generator picks
// fractional values when the domain is set to data-driven extremes.
function niceStep(halfRange: number, targetCount: number): number {
  if (!Number.isFinite(halfRange) || halfRange <= 0) return 1;
  const rough = halfRange / Math.max(1, targetCount);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / magnitude;
  if (norm < 1.5) return 1 * magnitude;
  if (norm < 3.5) return 2 * magnitude;
  if (norm < 7.5) return 5 * magnitude;
  return 10 * magnitude;
}

// Symmetric ticks anchored at zero: [-N*step, ..., -step, 0, step, ..., N*step].
// Caller picks `step` via niceStep so the labels read $1B, $2B, $3B etc.
function symmetricTicks(maxAbs: number, step: number): { ticks: number[]; domainMax: number } {
  if (!Number.isFinite(maxAbs) || maxAbs <= 0 || step <= 0) {
    return { ticks: [0], domainMax: 1 };
  }
  const upper = Math.ceil(maxAbs / step) * step;
  const ticks: number[] = [];
  // Floating-point safety: count rungs then multiply, instead of repeated
  // additions that drift (e.g. step=0.1 sums to 0.30000000000000004).
  const rungs = Math.round(upper / step);
  for (let i = -rungs; i <= rungs; i += 1) {
    ticks.push(i * step);
  }
  return { ticks, domainMax: upper };
}

// Spot-shift GEX profile points are sampled at the resolver's grid step
// (~0.5% of spot), which lands on fractional strikes. The per-strike bars
// live on integer-ish strikes. Merging on the same x-axis means snapping
// each profile sample to its nearest bar bucket — Recharts' ComposedChart
// only honors values that share a row in `data`.
function mergeProfileWithStrikes(
  strikes: StrikeRow[],
  profile: Array<{ price: number; gex: number }>,
): MergedRow[] {
  const map = new Map<string, MergedRow>();
  strikes.forEach((row) => {
    if (!Number.isFinite(row.strike)) return;
    map.set(row.strike.toFixed(4), {
      strike: row.strike,
      callGex: row.callGex,
      putGex: row.putGex,
      netGex: row.netGex,
    });
  });

  // Sort the per-strike axis once; each profile sample gets snapped to the
  // closest strike via binary search.  For SPX with ~70 strikes and ~80
  // profile points this is well under a millisecond.
  const sortedStrikes = Array.from(map.values()).sort((a, b) => a.strike - b.strike);
  if (sortedStrikes.length === 0) {
    // No strike data — render the profile alone so the chart still shows
    // something useful (smooth curve plus reference lines).
    profile.forEach((p) => {
      if (!Number.isFinite(p.price)) return;
      map.set(p.price.toFixed(4), { strike: p.price, profileGex: p.gex });
    });
    return Array.from(map.values()).sort((a, b) => a.strike - b.strike);
  }

  const findNearest = (target: number): MergedRow => {
    let lo = 0;
    let hi = sortedStrikes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedStrikes[mid].strike < target) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0 && Math.abs(sortedStrikes[lo - 1].strike - target) < Math.abs(sortedStrikes[lo].strike - target)) {
      return sortedStrikes[lo - 1];
    }
    return sortedStrikes[lo];
  };

  profile.forEach((p) => {
    if (!Number.isFinite(p.price) || !Number.isFinite(p.gex)) return;
    const nearest = findNearest(p.price);
    // When multiple profile samples snap to the same strike (denser
    // profile than strike grid) keep the one closest to its target —
    // this stays a true "profile-at-that-strike" reading instead of
    // averaging two samples from different sides of the bucket.
    const existing = nearest.profileGex;
    if (existing == null) {
      nearest.profileGex = p.gex;
    } else {
      const existingDist = Math.abs(nearest.strike - p.price);
      const newDist = Math.abs(nearest.strike - p.price);
      if (newDist < existingDist) nearest.profileGex = p.gex;
    }
  });

  return sortedStrikes;
}

function ProfileTooltip({
  active,
  payload,
  label,
  spotPrice,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; color?: string }>;
  label?: number | string;
  spotPrice?: number | null;
}) {
  if (!active || !payload?.length) return null;
  const strike = typeof label === 'number' ? label : Number(label);
  const distance =
    Number.isFinite(strike) && spotPrice != null && Number.isFinite(spotPrice)
      ? strike - spotPrice
      : null;
  const findValue = (key: string) =>
    payload.find((entry) => entry.dataKey === key)?.value;
  const call = findValue('callGex');
  const put = findValue('putGex');
  const net = findValue('netGex');
  const profile = findValue('profileGex');
  return (
    <div
      style={{
        background: 'var(--color-chart-tooltip-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '8px 12px',
        color: 'var(--color-chart-tooltip-text)',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        Strike {formatStrike(strike)}
        {distance != null && (
          <span style={{ opacity: 0.7, marginLeft: 6, fontWeight: 400 }}>
            ({distance >= 0 ? '+' : ''}
            {distance.toFixed(2)} vs spot)
          </span>
        )}
      </div>
      {call != null && (
        <div style={{ color: colors.bullish }}>Call GEX: {formatExposure(Number(call))}</div>
      )}
      {put != null && (
        <div style={{ color: colors.bearish }}>Put GEX: {formatExposure(Number(put))}</div>
      )}
      {net != null && (
        <div style={{ color: 'var(--color-text-primary)' }}>Net GEX: {formatExposure(Number(net))}</div>
      )}
      {profile != null && (
        <div style={{ color: PROFILE_LINE_COLOR }}>
          GEX Profile: {formatExposure(Number(profile))}
        </div>
      )}
    </div>
  );
}

export default function GexProfileChart({
  symbol,
  strikeData,
  spotPrice,
  gammaFlip,
  callWall,
  putWall,
}: GexProfileChartProps) {
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const isDark = theme === 'dark';
  const textColor = isDark ? colors.light : colors.dark;
  const axisStroke = 'var(--color-text-primary)';
  const gridStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  // The profile endpoint is keyed (underlying, timestamp) and refreshed
  // each analytics cycle (~30-60s).  10s polling keeps it in step with
  // gex/by-strike without hammering a dataset that changes far less
  // often than the per-bar quote feed.
  const { data: profileData, loading, error } = useGEXProfile(symbol, 10000);

  const merged = useMemo<MergedRow[]>(() => {
    const profile = profileData?.profile ?? [];
    return mergeProfileWithStrikes(strikeData, profile);
  }, [strikeData, profileData?.profile]);

  // Two y-axes: the bars and Net GEX share the LEFT scale (per-strike
  // dealer dollar GEX), the spot-shift profile sits on the RIGHT scale
  // (the same units but typically an order of magnitude larger because
  // each profile point integrates the entire chain at the hypothetical
  // spot).  Mixing them on a single axis squishes the bars into a flat
  // line at zero — matches the screenshot reference's two-axis layout.
  //
  // Both axes use symmetric nice-stepped ticks (1/2/5 × 10^k) so the
  // labels read $1B, $2B, $3B etc. instead of the data-driven extremes
  // recharts would otherwise pick (e.g. $884.1M, -$1.1B).
  const { strikeTicks, strikeDomain, profileTicks, profileDomain, denom } = useMemo(() => {
    let strikeAbs = 0;
    let profileAbs = 0;
    merged.forEach((row) => {
      if (row.callGex != null) strikeAbs = Math.max(strikeAbs, Math.abs(row.callGex));
      if (row.putGex != null) strikeAbs = Math.max(strikeAbs, Math.abs(row.putGex));
      if (row.netGex != null) strikeAbs = Math.max(strikeAbs, Math.abs(row.netGex));
      if (row.profileGex != null) profileAbs = Math.max(profileAbs, Math.abs(row.profileGex));
    });
    // ~4 ticks per side keeps the y-axis legible without crowding labels
    // at smaller chart heights.
    const strikeStep = niceStep(strikeAbs, 4);
    const profileStep = niceStep(profileAbs, 4);
    const strike = symmetricTicks(strikeAbs, strikeStep);
    const profile = symmetricTicks(profileAbs, profileStep);
    // Single denomination shared across both axes so the smaller scale
    // (bars) renders as e.g. "$0.5B" instead of "$500.0M" when the
    // larger scale (profile) is in billions.
    return {
      strikeTicks: strike.ticks,
      strikeDomain: [-strike.domainMax, strike.domainMax] as [number, number],
      profileTicks: profile.ticks,
      profileDomain: [-profile.domainMax, profile.domainMax] as [number, number],
      denom: pickSharedDenomination(Math.max(strike.domainMax, profile.domainMax)),
    };
  }, [merged]);

  const hasData = merged.length > 0;

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart">
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: isDark ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
        }}
      >
        {/* Header: title on the left, legend top-right above the plot area so
            it never collides with reference-line labels or profile peaks. */}
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>
              GAMMA EXPOSURE BY STRIKE
            </h3>
            <TooltipWrapper text="Per-strike dealer GEX bars (left axis) overlaid with the spot-shift GEX Profile curve (right axis). The profile is the shared primitive whose zero crossing is the gamma flip and whose value at spot is the headline Net GEX at Spot. Reference lines mark spot, the gamma flip, and the call/put walls.">
              <Info size={14} />
            </TooltipWrapper>
          </div>
          <div
            // pr-14 reserves room for the absolutely-positioned Expand
            // button (right-3, ~36px wide) in the card's top-right corner,
            // so the rightmost legend entry never tucks under it.
            className="flex flex-wrap items-center gap-4 text-xs pr-14"
            style={{ color: textColor }}
          >
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: colors.bullish }} />
              Call GEX
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: colors.bearish }} />
              Put GEX
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ backgroundColor: NET_LINE_COLOR }} />
              Net GEX
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ backgroundColor: PROFILE_LINE_COLOR }} />
              GEX Profile
            </div>
          </div>
        </div>

        {error ? (
          <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: colors.bearish }}>
            Failed to load GEX profile: {error}
          </div>
        ) : loading && !profileData ? (
          <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: colors.muted }}>
            Loading GEX profile…
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: colors.muted }}>
            No GEX profile data available.
          </div>
        ) : (
          <MobileScrollableChart>
            <ResponsiveContainer width="100%" height={isMobile ? 320 : 420}>
              {/* Each YAxis track (width=84 below) reserves room for the
                  rotated axis title AND the tick labels with ~25px of
                  clear separation between them.  Outer margin is small
                  because the YAxis width is doing the spacing work. */}
              <ComposedChart data={merged} margin={{ top: 16, right: 16, left: 16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                <XAxis
                  dataKey="strike"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  padding={{ left: 8, right: 8 }}
                  stroke={axisStroke}
                  tick={{ fontSize: 11, fill: axisStroke }}
                  tickFormatter={(v) => formatStrike(Number(v))}
                  minTickGap={28}
                  label={{
                    value: 'Strikes',
                    position: 'insideBottom',
                    offset: -4,
                    fill: axisStroke,
                    fontSize: 11,
                  }}
                />
                <YAxis
                  yAxisId="strike"
                  // Wider YAxis track so the rotated title sits fully
                  // inside the YAxis area (offset is measured inward
                  // from the outer edge) with ~25px of clear space
                  // between the title and the tick labels.
                  width={84}
                  domain={strikeDomain}
                  ticks={strikeTicks}
                  stroke={axisStroke}
                  tick={{ fontSize: 11, fill: axisStroke }}
                  tickFormatter={(v) => formatTick(Number(v), denom)}
                  label={{
                    value: 'Gamma Exposure',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 12,
                    style: { fill: axisStroke, fontSize: 11, textAnchor: 'middle' },
                  }}
                />
                {/* Right axis colour matches the left so the two y-scales read
                    as a pair; the profile curve and its legend swatch are
                    enough to associate the right axis with the profile
                    series visually. */}
                <YAxis
                  yAxisId="profile"
                  orientation="right"
                  width={84}
                  domain={profileDomain}
                  ticks={profileTicks}
                  stroke={axisStroke}
                  tick={{ fontSize: 11, fill: axisStroke }}
                  tickFormatter={(v) => formatTick(Number(v), denom)}
                  label={{
                    value: 'GEX Profile',
                    angle: -90,
                    position: 'insideRight',
                    offset: 12,
                    style: { fill: axisStroke, fontSize: 11, textAnchor: 'middle' },
                  }}
                />
                <Tooltip content={<ProfileTooltip spotPrice={spotPrice ?? null} />} />

                {/* Zero line for the bar axis, drawn first so bars/lines paint over it. */}
                <ReferenceLine yAxisId="strike" y={0} stroke={axisStroke} opacity={0.4} />

                {/* Filled GEX-Profile curve.  Drawn first so the bars and net-GEX
                    line render on top, matching the screenshot reference. */}
                <Area
                  yAxisId="profile"
                  type="monotone"
                  dataKey="profileGex"
                  name="GEX Profile"
                  stroke={PROFILE_LINE_COLOR}
                  strokeWidth={1.5}
                  fill={PROFILE_FILL_COLOR}
                  isAnimationActive={false}
                  connectNulls
                  dot={false}
                />

                {/* Per-strike bars: calls push up (positive), puts push down. */}
                <Bar
                  yAxisId="strike"
                  dataKey="callGex"
                  name="Call GEX"
                  fill={colors.bullish}
                  barSize={BAR_SIZE}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="strike"
                  dataKey="putGex"
                  name="Put GEX"
                  fill={colors.bearish}
                  barSize={BAR_SIZE}
                  isAnimationActive={false}
                />

                {/* Net GEX per strike as a thin line — same axis as the bars
                    so it tracks the bar magnitudes, not the profile. */}
                <Line
                  yAxisId="strike"
                  type="monotone"
                  dataKey="netGex"
                  name="Net GEX"
                  stroke={NET_LINE_COLOR}
                  strokeWidth={1.25}
                  dot={false}
                  isAnimationActive={false}
                />

                {spotPrice != null && Number.isFinite(spotPrice) && (
                  <ReferenceLine
                    yAxisId="strike"
                    x={spotPrice}
                    stroke="#06B6D4"
                    strokeDasharray="4 4"
                    label={{
                      value: `Spot: ${formatStrike(spotPrice)}`,
                      position: 'top',
                      fill: '#06B6D4',
                      fontSize: 10,
                    }}
                  />
                )}
                {gammaFlip != null && Number.isFinite(gammaFlip) && (
                  <ReferenceLine
                    yAxisId="strike"
                    x={gammaFlip}
                    stroke={colors.warning}
                    strokeDasharray="4 4"
                    label={{
                      value: `Flip: ${formatStrike(gammaFlip)}`,
                      position: 'top',
                      fill: colors.warning,
                      fontSize: 10,
                    }}
                  />
                )}
                {callWall != null && Number.isFinite(callWall) && (
                  <ReferenceLine
                    yAxisId="strike"
                    x={callWall}
                    stroke={colors.bullish}
                    strokeDasharray="2 4"
                    label={{
                      value: `Call Wall: ${formatStrike(callWall)}`,
                      position: 'top',
                      fill: colors.bullish,
                      fontSize: 10,
                    }}
                  />
                )}
                {putWall != null && Number.isFinite(putWall) && (
                  <ReferenceLine
                    yAxisId="strike"
                    x={putWall}
                    stroke={colors.bearish}
                    strokeDasharray="2 4"
                    label={{
                      value: `Put Wall: ${formatStrike(putWall)}`,
                      position: 'top',
                      fill: colors.bearish,
                      fontSize: 10,
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </MobileScrollableChart>
        )}
      </div>
    </ExpandableCard>
  );
}
