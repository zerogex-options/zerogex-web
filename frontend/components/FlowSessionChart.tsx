'use client';

/**
 * The Flow Analysis page's one chart: the session's options flow on one
 * clock, in stacked panes that share a crosshair. The underlying's price;
 * net premium, with the call and put legs; the contracts each bar on each
 * side; and the put/call ratio. An events lane across the top carries the
 * numbered markers of the page's flow log. Behind the price line, optionally:
 * the strike ribbon (who crossed the spread at each strike, bar by bar;
 * core/flowStrikes) and the flip and walls.
 *
 * Drawn in pixels against the measured width (not a scaled viewBox), so type
 * stays the same size from a phone to a full-screen monitor. The height is the
 * caller's: the panes share whatever it is by weight, so the full-screen view
 * fills the window instead of floating a short chart in it.
 *
 * Geometry decisions live in core/flowAnalysis (paneLayout, valueDomain)
 * where they are tested; this file only draws.
 */

import { useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useChipInk, useLevelInk } from '@/hooks/useChartTheme';
import { useChartReadout } from '@/hooks/useChartReadout';
import { ET_HM, etMinuteOfDay, generateNiceTicks, trimEdgeTicks } from '@/core/technicalsCharts';
import { fmtLevel, priceDomain, spreadTags } from '@/core/technicalsSession';
import { inferStrikeStep, RIBBON_TIER_OPACITY } from '@/core/gexRibbons';
import { buildStrikeRibbon, cellNear, ribbonPriceDomain, strikeLean, type StrikeCell, type StrikeLean } from '@/core/flowStrikes';
import {
  bearishSide,
  bullishSide,
  FLOW_PANE_WEIGHT,
  FLOW_PANE_WEIGHT_STRIKES,
  fmtContracts,
  fmtContractsCompact,
  fmtUsdCompact,
  paneLayout,
  valueDomain,
  type FlowBar,
  type FlowEvent,
  type FlowEventTone,
  type FlowPaneKey,
} from '@/core/flowAnalysis';

const MONO = 'var(--font-mono)';

export interface FlowChartLayers {
  price: boolean;
  premium: boolean;
  /** The call and put premium lines inside the premium pane. */
  legs: boolean;
  contracts: boolean;
  pcr: boolean;
  events: boolean;
  /** The strike ribbon behind the price line. */
  strikes: boolean;
  /** The flip and the call and put walls across the price pane. */
  walls: boolean;
}

/** The dealer levels the walls layer draws: the Key Levels strip's read. */
export interface FlowLevels {
  flip: number | null;
  callWall: number | null;
  putWall: number | null;
}

interface Props {
  bars: FlowBar[];
  /** 09:30 ET of the session. */
  sessionStartMs: number;
  /** The end of the session's last bar slot. */
  sessionEndMs: number;
  barMs: number;
  /** Shade the part of the session still to come. */
  live: boolean;
  layers: FlowChartLayers;
  events: FlowEvent[];
  /** The whole drawing, in px. */
  height: number;
  compact: boolean;
  symbol: string;
  ariaLabel: string;
  /** Contracts bought and sold at each strike, by bar start (ms). */
  strikeCells?: ReadonlyMap<number, readonly StrikeCell[]> | null;
  levels?: FlowLevels | null;
}

const TONE_STROKE: Record<FlowEventTone, string> = {
  bullish: 'var(--color-bull)',
  bearish: 'var(--color-bear)',
  neutral: 'var(--color-hazy)',
};

const PANE_ORDER: FlowPaneKey[] = ['price', 'premium', 'contracts', 'pcr'];

// The ribbon's inks: the page's sides, and a quiet one for a strike where
// neither side led. Scaled under the GEX ribbon's tier opacities so the price
// line keeps the lead.
const LEAN_FILL: Record<StrikeLean, string> = {
  bullish: 'var(--color-bull)',
  bearish: 'var(--color-bear)',
  even: 'var(--text-muted)',
};
const LEAN_OPACITY: Record<StrikeLean, number> = { bullish: 0.85, bearish: 0.85, even: 0.38 };
const LEAN_WORDS: Record<StrikeLean, string> = {
  bullish: 'bullish side led',
  bearish: 'bearish side led',
  even: 'two-way',
};

interface Tag {
  key: string;
  label: string;
  y: number;
  color: string;
  outline?: boolean;
  /** A level off the price window, pinned to its edge with an arrow. */
  edge?: 'top' | 'bottom';
  title?: string;
}

/** A strike as a reader writes it: 665, or 6,745.25 for a projected one. */
function fmtStrike(strike: number): string {
  return Number.isInteger(strike) ? strike.toLocaleString('en-US') : fmtLevel(strike);
}

/** Split a series where it crosses zero, so the area above and below it fills exactly. */
function withZeroCrossings(pts: Array<{ x: number; v: number }>): Array<{ x: number; v: number }> {
  const out: Array<{ x: number; v: number }> = [];
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    out.push(a);
    const b = pts[i + 1];
    if (b && ((a.v > 0 && b.v < 0) || (a.v < 0 && b.v > 0))) {
      const t = a.v / (a.v - b.v);
      out.push({ x: a.x + (b.x - a.x) * t, v: 0 });
    }
  }
  return out;
}

export default function FlowSessionChart({
  bars,
  sessionStartMs,
  sessionEndMs,
  barMs,
  live,
  layers,
  events,
  height,
  compact,
  symbol,
  ariaLabel,
  strikeCells = null,
  levels = null,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const readout = useChartReadout(wrapRef);
  const { index: hoverIdx, setIndex: setHoverIdx } = readout;
  // The price under the pointer, for the strike it is over.
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const chipInk = useChipInk();
  const levelInk = useLevelInk();
  const clipId = useId().replace(/[^a-zA-Z0-9]/g, '');

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const TAG_W = compact ? 64 : 84;
  const AXIS_H = 22;
  const LANE_H = layers.events && events.length > 0 ? 22 : 0;
  const PANE_GAP = compact ? 12 : 16;
  // Axis numbers get a gutter of their own: the session's tallest bars are the
  // open's, right where labels inside the plot would sit on them.
  const AXIS_W = compact ? 36 : 46;
  const plotW = Math.max(0, width - AXIS_W - TAG_W - 6);
  const plotR = AXIS_W + plotW;
  const panesTop = LANE_H ? LANE_H + 6 : 4;
  const panesBottom = Math.max(panesTop + 40, height - AXIS_H);


  const spanMs = Math.max(barMs, sessionEndMs - sessionStartMs);
  const slots = Math.max(1, Math.round(spanMs / barMs));
  const slotW = plotW / slots;
  const x = (ms: number) => AXIS_W + ((ms - sessionStartMs) / barMs + 0.5) * slotW;

  // ── Strikes and levels ──────────────────────────────────────────────────
  const ribbonOn = layers.price && layers.strikes && strikeCells != null && strikeCells.size > 0;
  const strikeStep = useMemo(() => {
    if (!strikeCells) return null;
    const all: number[] = [];
    for (const cells of strikeCells.values()) for (const c of cells) all.push(c.strike);
    return inferStrikeStep(all);
  }, [strikeCells]);
  const wallsOn = layers.price && layers.walls && levels != null;
  const flip = wallsOn ? levels.flip : null;
  const callWall = wallsOn ? levels.callWall : null;
  const putWall = wallsOn ? levels.putWall : null;

  // ── Domains ─────────────────────────────────────────────────────────────
  const domains = useMemo(() => {
    const prices: number[] = [];
    const premiums: number[] = [0];
    const ratios: number[] = [];
    let volMax = 0;
    for (const b of bars) {
      if (b.price != null) prices.push(b.price);
      premiums.push(b.netPremium);
      if (layers.legs) premiums.push(b.callPremium, b.putPremium);
      if (b.putCallRatio != null) ratios.push(b.putCallRatio);
      volMax = Math.max(volMax, bullishSide(b.bar), bearishSide(b.bar));
    }
    const v = volMax > 0 ? volMax * 1.08 : 1;
    // A level near the session's prices joins the window; a far one gets an
    // edge tag instead of squashing the line (core/technicalsSession).
    const lvls = [flip, callWall, putWall];
    return {
      price: ribbonOn
        ? ribbonPriceDomain(prices, lvls, strikeStep)
        : lvls.some((l) => l != null)
          ? priceDomain(prices, lvls)
          : valueDomain(prices, null, 0.06),
      premium: valueDomain(premiums, null, 0.08),
      contracts: { min: -v, max: v },
      // A put/call wandering by a few hundredths is flat; draw it flat.
      pcr: valueDomain(ratios, 1, 0.12, 0.2),
    } as Record<FlowPaneKey, { min: number; max: number } | null>;
  }, [bars, layers.legs, ribbonOn, strikeStep, flip, callWall, putWall]);

  // A pane with nothing to draw (no underlying price on the rows, say) hands
  // its height to the others rather than sitting blank.
  const shownKey = PANE_ORDER.filter((k) => layers[k] && domains[k] != null).join(',');
  const bands = useMemo(
    () =>
      paneLayout(
        shownKey ? (shownKey.split(',') as FlowPaneKey[]) : [],
        panesTop,
        panesBottom - panesTop,
        PANE_GAP,
        ribbonOn ? FLOW_PANE_WEIGHT_STRIKES : FLOW_PANE_WEIGHT,
      ),
    [shownKey, panesTop, panesBottom, PANE_GAP, ribbonOn],
  );

  // The ribbon, built once per data or layout change rather than on every
  // hover: a session of SPX strikes is thousands of orbs.
  const ribbon = useMemo(() => {
    const d = domains.price;
    const band = bands.find((b) => b.key === 'price');
    if (!ribbonOn || !strikeCells || !d || !band || band.height <= 0 || plotW <= 0) return null;
    return buildStrikeRibbon(
      strikeCells,
      bars.map((b) => b.ms),
      {
        x: (ms) => AXIS_W + ((ms - sessionStartMs) / barMs + 0.5) * slotW,
        yPrice: (v) => band.top + ((d.max - v) / (d.max - d.min)) * band.height,
        slotW,
        dMin: d.min,
        dMax: d.max,
      },
    );
  }, [ribbonOn, strikeCells, bars, domains.price, bands, plotW, slotW, AXIS_W, sessionStartMs, barMs]);

  if (width === 0 || bars.length === 0) {
    return <div ref={wrapRef} style={{ width: '100%', height }} aria-hidden="true" />;
  }

  const bandOf = (key: FlowPaneKey) => bands.find((b) => b.key === key) ?? null;
  const yIn = (key: FlowPaneKey) => {
    const band = bandOf(key);
    const d = domains[key];
    if (!band || !d) return null;
    return (v: number) => band.top + ((d.max - v) / (d.max - d.min)) * band.height;
  };

  const last = bars[bars.length - 1];
  const nowX = x(last.ms) + slotW / 2;
  const bodyW = Math.max(1, Math.min(9, slotW * 0.66));

  // ── Time axis ───────────────────────────────────────────────────────────
  // The ET clock is read once: a session never spans a DST change, so every
  // other minute is an offset from the open.
  const stepMin = compact ? 120 : spanMs / 3_600_000 <= 7 ? 60 : 120;
  const openMinute = etMinuteOfDay(sessionStartMs);
  const timeTicks: Array<{ ms: number; label: string }> = [];
  if (openMinute >= 0) {
    for (let off = 0; off * 60_000 < spanMs; off += 1) {
      const m = openMinute + off;
      if (m % stepMin !== 0) continue;
      timeTicks.push({ ms: sessionStartMs + off * 60_000, label: `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` });
    }
  }
  const axisTop = panesBottom;

  // ── Pointer ─────────────────────────────────────────────────────────────
  const onPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (px < AXIS_W || px > plotR) {
      setHoverIdx(null);
      return;
    }
    const py = e.clientY - rect.top;
    const pb = bandOf('price');
    const dp = domains.price;
    setHoverPrice(
      ribbonOn && pb && dp && py >= pb.top && py <= pb.top + pb.height
        ? dp.max - ((py - pb.top) / pb.height) * (dp.max - dp.min)
        : null,
    );
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < bars.length; i += 1) {
      const d = Math.abs(x(bars[i].ms) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHoverIdx(best);
  };
  const hover = hoverIdx != null ? bars[hoverIdx] ?? null : null;
  const hoverCell =
    hover && ribbonOn && hoverPrice != null ? cellNear(strikeCells?.get(hover.ms), hoverPrice, strikeStep) : null;

  // ── Panes ───────────────────────────────────────────────────────────────
  // A backing behind the label's own text, so a level or a ribbon lane that
  // runs along the top of a pane passes under it rather than through it.
  // Mono at 9px with 0.1em tracking is ~6.3px a character.
  const paneLabel = (text: string, top: number, extra?: ReactNode) => (
    <g>
      <rect x={AXIS_W + 1} y={top + 1} width={text.length * 6.3 + 6} height={13} fill="var(--bg-card)" fillOpacity={0.88} />
      <text x={AXIS_W + 4} y={top + 10} fontFamily={MONO} fontSize={9} letterSpacing="0.1em" fill="var(--text-muted)" stroke="var(--bg-card)" strokeWidth={3} paintOrder="stroke">
        {text}
        {extra}
      </text>
    </g>
  );

  const grid = (key: FlowPaneKey, fmt: (v: number) => string) => {
    const band = bandOf(key);
    const d = domains[key];
    const y = yIn(key);
    if (!band || !d || !y) return null;
    const ticks = trimEdgeTicks(generateNiceTicks(d.min, d.max)).filter((t) => y(t) > band.top + 6 && y(t) < band.top + band.height - 2);
    // At least ~22px between labels: thin to multiples of a wider step, which
    // keeps the zero line labelled on the two-sided panes.
    const stepVal = ticks.length > 1 ? ticks[1] - ticks[0] : 0;
    const stepPx = ticks.length > 1 ? Math.abs(y(ticks[0]) - y(ticks[1])) : Infinity;
    const every = Math.max(1, Math.ceil(22 / stepPx));
    const thin = every > 1 && stepVal > 0 ? ticks.filter((t) => Math.round(t / stepVal) % every === 0) : ticks;
    return (
      <g>
        {thin.map((t) => (
          <g key={`g-${key}-${t}`}>
            <line x1={AXIS_W} x2={plotR} y1={y(t)} y2={y(t)} stroke="var(--color-grid-line)" strokeWidth={1} />
            <text x={AXIS_W - 6} y={y(t) + 3.5} textAnchor="end" fontFamily={MONO} fontSize={10} fill="var(--text-muted)">
              {fmt(t)}
            </text>
          </g>
        ))}
      </g>
    );
  };

  const tags: Tag[] = [];
  const panes: ReactNode[] = [];

  // Price
  const priceBand = bandOf('price');
  const yPrice = yIn('price');
  if (priceBand && yPrice) {
    const d = domains.price!;
    const pts = bars.filter((b) => b.price != null).map((b) => `${x(b.ms).toFixed(1)},${yPrice(b.price as number).toFixed(1)}`);
    // The flip and walls: a line where the level is on the scale, an edge tag
    // with an arrow where it is not, and its name above the line.
    const walls: Array<{ key: string; name: string; value: number; color: string; dash: string; w: number }> = [];
    if (callWall != null) walls.push({ key: 'callWall', name: 'CALL WALL', value: callWall, color: 'var(--color-bear)', dash: '6 4', w: 1.2 });
    if (putWall != null) walls.push({ key: 'putWall', name: 'PUT WALL', value: putWall, color: 'var(--color-bull)', dash: '6 4', w: 1.2 });
    if (flip != null) walls.push({ key: 'flip', name: 'FLIP', value: flip, color: 'var(--color-flip)', dash: '8 4', w: 1.4 });
    const onScale = walls.filter((l) => l.value >= d.min && l.value <= d.max);
    // A name sits above its line, or below it where the pane's own label
    // leaves no room above; one that would land on another is skipped (its
    // tag still carries the price).
    const names = onScale
      .map((l) => {
        const ly = yPrice(l.value);
        return { ...l, ly: ly - 4 < priceBand.top + 14 ? ly + 11 : ly - 4 };
      })
      .sort((a, b) => a.ly - b.ly);
    const drawnNames: typeof names = [];
    for (const n of names) {
      if (drawnNames.every((o) => Math.abs(o.ly - n.ly) >= 11)) drawnNames.push(n);
    }
    panes.push(
      <g key="price">
        {grid('price', (v) => fmtLevel(v).replace(/\.00$/, ''))}
        {ribbon?.paths.map((r) => (
          <path key={`rib-${r.lean}-${r.tier}`} d={r.d} fill={LEAN_FILL[r.lean]} fillOpacity={RIBBON_TIER_OPACITY[r.tier] * LEAN_OPACITY[r.lean]} />
        ))}
        {onScale.map((l) => (
          <line key={`lvl-${l.key}`} x1={AXIS_W} x2={plotR} y1={yPrice(l.value)} y2={yPrice(l.value)} stroke={l.color} strokeWidth={l.w} strokeDasharray={l.dash} />
        ))}
        {pts.length > 1 && <polyline points={pts.join(' ')} fill="none" stroke="var(--text-primary)" strokeOpacity={0.85} strokeWidth={1.5} strokeLinejoin="round" />}
        {drawnNames.map((n) => (
          <text key={`lvl-name-${n.key}`} x={plotR - 4} y={n.ly} textAnchor="end" fontFamily={MONO} fontSize={9} letterSpacing="0.1em" fill={levelInk(n.color)} stroke="var(--bg-card)" strokeWidth={3} paintOrder="stroke">
            {n.name}
          </text>
        ))}
        {paneLabel(`PRICE · ${symbol}`, priceBand.top)}
      </g>,
    );
    for (const l of walls) {
      const edge = l.value > d.max ? 'top' : l.value < d.min ? 'bottom' : undefined;
      tags.push({
        key: l.key,
        label: `${edge === 'top' ? '▲ ' : edge === 'bottom' ? '▼ ' : ''}${fmtLevel(l.value)}`,
        y: edge === 'top' ? priceBand.top : edge === 'bottom' ? priceBand.top + priceBand.height : yPrice(l.value),
        color: l.color,
        edge,
        title: `${l.name.toLowerCase().replace(/^./, (c) => c.toUpperCase())} ${fmtLevel(l.value)}${edge ? ', off the visible scale' : ''}`,
      });
    }
    if (last.price != null) tags.push({ key: 'last', label: fmtLevel(last.price), y: yPrice(last.price), color: 'var(--color-accent-hot)' });
  }

  // Net premium
  const premBand = bandOf('premium');
  const yPrem = yIn('premium');
  if (premBand && yPrem) {
    const y0 = yPrem(0);
    const pts = withZeroCrossings(bars.map((b) => ({ x: x(b.ms), v: b.netPremium })));
    const first = pts[0];
    const end = pts[pts.length - 1];
    const area = (pick: (v: number) => number) =>
      `M${first.x.toFixed(1)},${y0.toFixed(1)} ` + pts.map((p) => `L${p.x.toFixed(1)},${yPrem(pick(p.v)).toFixed(1)}`).join(' ') + ` L${end.x.toFixed(1)},${y0.toFixed(1)} Z`;
    const line = (pick: (b: FlowBar) => number) => bars.map((b) => `${x(b.ms).toFixed(1)},${yPrem(pick(b)).toFixed(1)}`).join(' ');
    panes.push(
      <g key="premium">
        {grid('premium', (v) => fmtUsdCompact(v).replace('.0M', 'M'))}
        <line x1={AXIS_W} x2={plotR} y1={y0} y2={y0} stroke="var(--text-secondary)" strokeOpacity={0.55} strokeWidth={1} />
        <path d={area((v) => Math.max(0, v))} fill="var(--color-bull)" fillOpacity={0.16} />
        <path d={area((v) => Math.min(0, v))} fill="var(--color-bear)" fillOpacity={0.16} />
        {layers.legs && bars.length > 1 && (
          <>
            <polyline points={line((b) => b.callPremium)} fill="none" stroke="var(--color-bull)" strokeWidth={1.2} strokeOpacity={0.8} />
            <polyline points={line((b) => b.putPremium)} fill="none" stroke="var(--color-bear)" strokeWidth={1.2} strokeOpacity={0.8} />
          </>
        )}
        {bars.length > 1 && <polyline points={line((b) => b.netPremium)} fill="none" stroke="var(--text-primary)" strokeWidth={1.8} strokeLinejoin="round" />}
        {paneLabel(
          'NET PREMIUM',
          premBand.top,
          layers.legs ? (
            <>
              <tspan fill="var(--text-muted)">{'  ·  '}</tspan>
              <tspan fill="var(--color-bull)">CALLS</tspan>
              <tspan fill="var(--text-muted)">{' / '}</tspan>
              <tspan fill="var(--color-bear)">PUTS</tspan>
            </>
          ) : null,
        )}
      </g>,
    );
    tags.push({
      key: 'net',
      label: fmtUsdCompact(last.netPremium, true),
      y: yPrem(last.netPremium),
      color: last.netPremium >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
    });
    if (layers.legs) {
      tags.push({ key: 'calls', label: fmtUsdCompact(last.callPremium, true), y: yPrem(last.callPremium), color: 'var(--color-bull)', outline: true });
      tags.push({ key: 'puts', label: fmtUsdCompact(last.putPremium, true), y: yPrem(last.putPremium), color: 'var(--color-bear)', outline: true });
    }
  }

  // Contracts per bar, by side
  const volBand = bandOf('contracts');
  const yVol = yIn('contracts');
  if (volBand && yVol) {
    const y0 = yVol(0);
    panes.push(
      <g key="contracts">
        {grid('contracts', (v) => fmtContractsCompact(Math.abs(v)))}
        {bars.map((b) => {
          const cx = x(b.ms) - bodyW / 2;
          const cb = b.bar.callsBought;
          const ps = b.bar.putsSold;
          const pb = b.bar.putsBought;
          const cs = b.bar.callsSold;
          return (
            <g key={`v-${b.ms}`}>
              <rect x={cx} y={yVol(cb)} width={bodyW} height={Math.max(0, y0 - yVol(cb))} fill="var(--color-bull)" fillOpacity={0.85} />
              <rect x={cx} y={yVol(cb + ps)} width={bodyW} height={Math.max(0, yVol(cb) - yVol(cb + ps))} fill="var(--color-bull)" fillOpacity={0.38} />
              <rect x={cx} y={y0} width={bodyW} height={Math.max(0, yVol(-pb) - y0)} fill="var(--color-bear)" fillOpacity={0.85} />
              <rect x={cx} y={yVol(-pb)} width={bodyW} height={Math.max(0, yVol(-(pb + cs)) - yVol(-pb))} fill="var(--color-bear)" fillOpacity={0.38} />
            </g>
          );
        })}
        <line x1={AXIS_W} x2={plotR} y1={y0} y2={y0} stroke="var(--text-secondary)" strokeOpacity={0.55} strokeWidth={1} />
        {paneLabel(
          compact ? 'CONTRACTS / BAR' : 'CONTRACTS PER BAR',
          volBand.top,
          compact ? null : (
            <>
              <tspan fill="var(--text-muted)">{'  ·  '}</tspan>
              <tspan fill="var(--color-bull)">▲ CALLS BOUGHT + PUTS SOLD</tspan>
              <tspan fill="var(--text-muted)">{'   '}</tspan>
              <tspan fill="var(--color-bear)">▼ PUTS BOUGHT + CALLS SOLD</tspan>
            </>
          ),
        )}
      </g>,
    );
  }

  // Put/call
  const pcrBand = bandOf('pcr');
  const yPcr = yIn('pcr');
  if (pcrBand && yPcr) {
    const d = domains.pcr!;
    const pts = bars.filter((b) => b.putCallRatio != null).map((b) => `${x(b.ms).toFixed(1)},${yPcr(b.putCallRatio as number).toFixed(1)}`);
    panes.push(
      <g key="pcr">
        {grid('pcr', (v) => v.toFixed(2))}
        {d.min <= 1 && d.max >= 1 && (
          <line x1={AXIS_W} x2={plotR} y1={yPcr(1)} y2={yPcr(1)} stroke="var(--text-secondary)" strokeOpacity={0.55} strokeWidth={1} strokeDasharray="4 3" />
        )}
        {pts.length > 1 && <polyline points={pts.join(' ')} fill="none" stroke="var(--color-info)" strokeWidth={1.6} strokeLinejoin="round" />}
        {paneLabel('PUT / CALL', pcrBand.top)}
      </g>,
    );
    if (last.putCallRatio != null) {
      tags.push({ key: 'pcr', label: last.putCallRatio.toFixed(2), y: yPcr(last.putCallRatio), color: 'var(--color-info)', outline: true });
    }
  }

  // Tags spread within their own pane, so a premium tag never lands in the price pane.
  const placedTags = tags.map((t) => ({ ...t }));
  for (const band of bands) {
    const inBand = placedTags.filter((t) => t.y >= band.top - 1 && t.y <= band.top + band.height + 1);
    const ys = spreadTags(inBand.map((t) => t.y), 16, band.top + 7, band.top + band.height - 7);
    inBand.forEach((t, i) => {
      t.y = ys[i];
    });
  }

  // Event markers, spread so neighbours never sit on each other.
  // In marker order, which is time order with same-bar ties settled, so 1 sits left of 2.
  const shownEvents = layers.events ? [...events].sort((a, b) => a.marker - b.marker) : [];
  const markerXs = spreadTags(shownEvents.map((e) => x(e.ms)), 18, AXIS_W + 9, Math.max(AXIS_W + 9, plotR - 9));

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={readout.onPointerLeave}
        onPointerCancel={readout.onPointerCancel}
      >
        <defs>
          <clipPath id={`${clipId}-plot`}>
            {/* The plot and its axis gutter; only the tag column is kept out. */}
            <rect x={0} y={0} width={plotR} height={axisTop} />
          </clipPath>
        </defs>

        {/* The part of the session still to come */}
        {live && nowX < plotR && (
          <g>
            <rect x={nowX} y={panesTop - 4} width={plotR - nowX} height={axisTop - panesTop + 4} fill="var(--bg-subtle)" fillOpacity={0.55} />
            <line x1={nowX} x2={nowX} y1={panesTop - 4} y2={axisTop} stroke="var(--border-default)" strokeWidth={1} />
          </g>
        )}

        <g clipPath={`url(#${clipId}-plot)`}>{panes}</g>

        {/* Pane separators */}
        {bands.slice(1).map((b) => (
          <line key={`sep-${b.key}`} x1={0} x2={width} y1={b.top - PANE_GAP / 2} y2={b.top - PANE_GAP / 2} stroke="var(--border-subtle)" strokeWidth={1} />
        ))}

        {/* Events lane */}
        {shownEvents.length > 0 && (
          <g>
            <line x1={AXIS_W} x2={plotR} y1={LANE_H - 1} y2={LANE_H - 1} stroke="var(--border-subtle)" strokeWidth={1} />
            {shownEvents.map((e, i) => {
              const mx = markerXs[i];
              const tx = x(e.ms);
              const stroke = TONE_STROKE[e.tone];
              return (
                <g key={`m-${e.id}`}>
                  <title>{`${e.marker}. ${ET_HM.format(new Date(e.ms))} ET · ${e.title}${e.detail ? ` · ${e.detail}` : ''}`}</title>
                  <line x1={tx} x2={tx} y1={LANE_H - 1} y2={panesTop} stroke={stroke} strokeOpacity={0.6} strokeWidth={1} />
                  <circle cx={mx} cy={10} r={8} fill="var(--bg-card)" stroke={stroke} strokeWidth={1.4} />
                  <text x={mx} y={13.5} textAnchor="middle" fontFamily={MONO} fontSize={10} fontWeight={600} fill="var(--text-primary)">
                    {e.marker}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Hover crosshair, and a dot on each series at that bar */}
        {hover && (
          <g pointerEvents="none">
            <line x1={x(hover.ms)} x2={x(hover.ms)} y1={panesTop - 4} y2={axisTop} stroke="var(--text-muted)" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 3" />
            {yPrice && hover.price != null && <circle cx={x(hover.ms)} cy={yPrice(hover.price)} r={3} fill="var(--text-primary)" />}
            {yPrice && hoverCell && (
              <circle cx={x(hover.ms)} cy={yPrice(hoverCell.strike)} r={Math.max(5, slotW * 0.6)} fill="none" stroke="var(--text-primary)" strokeWidth={1.2} />
            )}
            {yPrem && <circle cx={x(hover.ms)} cy={yPrem(hover.netPremium)} r={3} fill="var(--text-primary)" />}
            {yPcr && hover.putCallRatio != null && <circle cx={x(hover.ms)} cy={yPcr(hover.putCallRatio)} r={3} fill="var(--color-info)" />}
          </g>
        )}

        {/* Right-edge tags: the latest value of each series */}
        {placedTags.map((t) => (
          <g key={`tag-${t.key}`}>
            <rect
              x={plotR + 4}
              y={t.y - 7.5}
              width={TAG_W - 2}
              height={15}
              rx={2}
              fill={t.outline ? 'var(--bg-card)' : t.color}
              stroke={t.outline ? t.color : 'none'}
              strokeWidth={t.outline ? 1 : 0}
            />
            <text
              x={plotR + 4 + (TAG_W - 2) / 2}
              y={t.y + 3.5}
              textAnchor="middle"
              fontFamily={MONO}
              fontSize={compact ? 9 : 10}
              fontWeight={600}
              fill={t.outline ? 'var(--text-primary)' : chipInk(t.color)}
            >
              {t.label}
            </text>
            {t.title && <title>{t.title}</title>}
          </g>
        ))}

        {/* Time axis */}
        <g transform={`translate(0, ${axisTop})`}>
          <line x1={AXIS_W} x2={plotR} y1={0.5} y2={0.5} stroke="var(--border-default)" strokeWidth={1} />
          {timeTicks.map((t) => {
            const tx = x(t.ms) - slotW / 2;
            return (
              <g key={`t-${t.ms}`}>
                <line x1={tx} x2={tx} y1={0} y2={5} stroke="var(--text-muted)" strokeWidth={1} />
                <text x={tx} y={16} textAnchor="middle" fontFamily={MONO} fontSize={10} fill="var(--text-muted)">
                  {t.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {hover && (
        <div
          className="zg-panel"
          style={{
            position: 'absolute',
            top: panesTop + 4,
            left: x(hover.ms) > AXIS_W + plotW / 2 ? AXIS_W + 8 : undefined,
            right: x(hover.ms) > AXIS_W + plotW / 2 ? undefined : TAG_W + 14,
            padding: '8px 10px',
            pointerEvents: 'none',
            fontFamily: MONO,
            fontSize: 11,
            fontVariantNumeric: 'tabular-nums',
            minWidth: compact ? 176 : 210,
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{ET_HM.format(new Date(hover.ms))} ET</div>
          {hoverCell && (
            <div style={{ marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: 'var(--text-primary)' }}>At {fmtStrike(hoverCell.strike)}</span>
                <span style={{ color: strikeLean(hoverCell) === 'even' ? 'var(--text-muted)' : LEAN_FILL[strikeLean(hoverCell)] }}>
                  {LEAN_WORDS[strikeLean(hoverCell)]}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', columnGap: 10, marginTop: 2 }}>
                <span />
                <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>bought</span>
                <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>sold</span>
                <span style={{ color: 'var(--text-secondary)' }}>Calls</span>
                <span style={{ textAlign: 'right' }}>{fmtContracts(hoverCell.callsBought)}</span>
                <span style={{ textAlign: 'right' }}>{fmtContracts(hoverCell.callsSold)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>Puts</span>
                <span style={{ textAlign: 'right' }}>{fmtContracts(hoverCell.putsBought)}</span>
                <span style={{ textAlign: 'right' }}>{fmtContracts(hoverCell.putsSold)}</span>
              </div>
              <Row k="Net flow" v={fmtContracts(hoverCell.net, true)} color={hoverCell.net > 0 ? 'var(--color-bull)' : hoverCell.net < 0 ? 'var(--color-bear)' : undefined} top />
            </div>
          )}
          {hover.price != null && <Row k="Price" v={fmtLevel(hover.price)} />}
          <Row k="Net premium" v={fmtUsdCompact(hover.netPremium, true)} color={hover.netPremium >= 0 ? 'var(--color-bull)' : 'var(--color-bear)'} />
          <Row k="  calls" v={fmtUsdCompact(hover.callPremium, true)} muted />
          <Row k="  puts" v={fmtUsdCompact(hover.putPremium, true)} muted />
          <Row k="Net flow" v={fmtContracts(hover.netFlow, true)} color={hover.netFlow >= 0 ? 'var(--color-bull)' : 'var(--color-bear)'} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', columnGap: 10, marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{hoverCell ? 'All strikes' : 'This bar'}</span>
            <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>bought</span>
            <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>sold</span>
            <span style={{ color: 'var(--text-secondary)' }}>Calls</span>
            <span style={{ textAlign: 'right' }}>{fmtContracts(hover.bar.callsBought)}</span>
            <span style={{ textAlign: 'right' }}>{fmtContracts(hover.bar.callsSold)}</span>
            <span style={{ color: 'var(--text-secondary)' }}>Puts</span>
            <span style={{ textAlign: 'right' }}>{fmtContracts(hover.bar.putsBought)}</span>
            <span style={{ textAlign: 'right' }}>{fmtContracts(hover.bar.putsSold)}</span>
          </div>
          {hover.putCallRatio != null && <Row k="Put/call" v={hover.putCallRatio.toFixed(2)} top />}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, color, muted = false, top = false }: { k: string; v: string; color?: string; muted?: boolean; top?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: top ? 4 : 0 }}>
      <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text-secondary)', whiteSpace: 'pre' }}>{k}</span>
      <span style={{ color: color ?? (muted ? 'var(--text-secondary)' : 'var(--text-primary)') }}>{v}</span>
    </div>
  );
}
