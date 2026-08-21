'use client';

/**
 * GammaRegimeShiftCard — the one-second read on the Gamma Shift page.
 *
 * The old page opened with a 27-row ladder of per-strike deltas and put the
 * conclusion underneath it, which left the reader to do the synthesis. This
 * inverts that. Three tiers, each answering one question and stopping, so a
 * reader drops out of the stack as soon as they have what they came for:
 *
 *   1s   Did something happen, and which way?   — the state chip + headline
 *   5s   Do I believe it?                        — the plane, the levels, the ribbon
 *   30s  What exactly moved?                     — the ladder, below this card
 *
 * Encoding rules this card holds to, both learned the hard way from the
 * ladder it replaces:
 *
 * * **Direction is positional, not just chromatic.** Gamma built BELOW spot
 *   is a floor; the identical build ABOVE spot is a ceiling. The old ladder
 *   coloured both green. Here the lean axis carries it, and the ribbon puts
 *   spot on the axis so the side is visible.
 * * **The arrow and the colour come from different fields.** A gamma flip
 *   dropping is a falling number and a bullish event. `LevelRow.direction`
 *   drives the glyph, `LevelRow.sense` drives the colour — see core/regimeShift.
 *
 * Colour is never load-bearing alone: bull/bear separate at ΔE ~34 for normal
 * vision but collapse to ~5 under deuteranopia, so every coloured mark here
 * also carries a glyph, a sign, or a position.
 */

import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { useChartTheme } from '@/hooks/useChartTheme';
import {
  LOOKBACK_LABEL,
  LOOKBACK_ORDER,
  STATE_META,
  buildExpiryCaveat,
  buildHeadline,
  buildLevelRows,
  buildNormalizationNote,
  buildSubhead,
  formatBand,
  formatPercent,
  formatSignedGex,
  formatStrike,
  formatZ,
  ribbonHeight,
  ribbonReference,
  type Lens,
  type LevelRow,
  type Lookback,
  type RegimeShiftPayload,
  type ShiftStrike,
  type StateMeta,
} from '@/core/regimeShift';
import ChartCaption from './ChartCaption';
import TooltipWrapper from './TooltipWrapper';

// ────────────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────────────

function toneColor(tone: StateMeta['tone']): string {
  switch (tone) {
    case 'bull':
      return 'var(--color-bull)';
    case 'bear':
      return 'var(--color-bear)';
    case 'warning':
      return 'var(--color-warning)';
    case 'info':
      return 'var(--color-info)';
    default:
      return 'var(--text-muted)';
  }
}

function toneSoft(tone: StateMeta['tone']): string {
  switch (tone) {
    case 'bull':
      return 'var(--color-bull-soft)';
    case 'bear':
      return 'var(--color-bear-soft)';
    case 'warning':
      return 'var(--color-warning-soft)';
    case 'info':
      return 'var(--color-info-soft)';
    default:
      return 'var(--bg-subtle)';
  }
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '--:--';
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/New_York',
    }).format(new Date(iso));
  } catch {
    return '--:--';
  }
}

const SENSE_COLOR: Record<LevelRow['sense'], string> = {
  good: 'var(--color-bull)',
  bad: 'var(--color-bear)',
  flat: 'var(--text-muted)',
};

const DIRECTION_GLYPH: Record<LevelRow['direction'], string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

// ────────────────────────────────────────────────────────────────────────────
// the shift plane
// ────────────────────────────────────────────────────────────────────────────

/**
 * Two axes, four quadrants, one arrow from the origin.
 *
 * The arrow IS the shift vector, so its length is the magnitude and the ring
 * it lands outside of is literally the adverb in the headline: past the 2σ
 * ring is "dramatically". That equivalence is the point — a reader who
 * glances at the arrow and a reader who reads the sentence get the same
 * answer, which is what makes the sentence trustworthy.
 */
function ShiftPlane({
  leanZ,
  stabilityZ,
  tone,
  normalized,
}: {
  leanZ: number;
  stabilityZ: number;
  tone: string;
  normalized: boolean;
}) {
  const SIZE = 230;
  const C = SIZE / 2;
  const R = 88;
  const MAX = 3;
  const px = (v: number) => C + (Math.max(-MAX, Math.min(MAX, v)) / MAX) * R;
  const py = (v: number) => C - (Math.max(-MAX, Math.min(MAX, v)) / MAX) * R;

  const ex = px(leanZ);
  const ey = py(stabilityZ);
  const len = Math.hypot(ex - C, ey - C);
  const showArrow = normalized && len > 4;

  const quadrants = [
    { x: C, y: 0, fill: 'var(--color-bull-soft)', label: 'FIRMING', lx: SIZE - 8, ly: 14, anchor: 'end' },
    { x: 0, y: 0, fill: 'var(--color-info-soft)', label: 'CAPPING', lx: 8, ly: 14, anchor: 'start' },
    { x: C, y: C, fill: 'var(--color-warning-soft)', label: 'FRAGILE BID', lx: SIZE - 8, ly: SIZE - 8, anchor: 'end' },
    { x: 0, y: C, fill: 'var(--color-bear-soft)', label: 'DETERIORATING', lx: 8, ly: SIZE - 8, anchor: 'start' },
  ] as const;

  let arrow = null;
  if (showArrow) {
    const ux = (ex - C) / len;
    const uy = (ey - C) / len;
    const sx = ex - ux * 7;
    const sy = ey - uy * 7;
    const a = Math.atan2(uy, ux);
    const W = 0.42;
    const H = 9;
    const head = [
      [ex, ey],
      [ex - H * Math.cos(a - W), ey - H * Math.sin(a - W)],
      [ex - H * Math.cos(a + W), ey - H * Math.sin(a + W)],
    ]
      .map((p) => p.join(','))
      .join(' ');
    arrow = (
      <>
        <line x1={C} y1={C} x2={sx} y2={sy} stroke={tone} strokeWidth={2.4} strokeLinecap="round" />
        <polygon points={head} fill={tone} />
      </>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      style={{ maxWidth: SIZE }}
      role="img"
      aria-label={`Shift plane: lean ${leanZ.toFixed(1)} sigma, stability ${stabilityZ.toFixed(1)} sigma`}
    >
      {quadrants.map((q) => (
        <g key={q.label}>
          <rect x={q.x} y={q.y} width={C} height={C} fill={q.fill} />
          <text
            x={q.lx}
            y={q.ly}
            textAnchor={q.anchor}
            fontFamily="var(--font-mono)"
            fontSize={7.5}
            fontWeight={600}
            letterSpacing={0.9}
            fill="var(--text-muted)"
            opacity={0.85}
          >
            {q.label}
          </text>
        </g>
      ))}

      {[1, 2].map((r) => (
        <g key={r}>
          <circle
            cx={C}
            cy={C}
            r={(r / MAX) * R}
            fill="none"
            stroke="var(--border-default)"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
          <text
            x={C + 3}
            y={py(r) - 3}
            fontFamily="var(--font-mono)"
            fontSize={7}
            fill="var(--text-muted)"
            opacity={0.7}
          >
            {r}σ
          </text>
        </g>
      ))}

      <line x1={C - R - 8} y1={C} x2={C + R + 8} y2={C} stroke="var(--border-default)" strokeWidth={1} />
      <line x1={C} y1={C - R - 8} x2={C} y2={C + R + 8} stroke="var(--border-default)" strokeWidth={1} />
      <text x={C + R + 8} y={C + 11} textAnchor="end" fontFamily="var(--font-mono)" fontSize={7} fill="var(--text-muted)">
        SUPPORT →
      </text>
      <text x={C - R - 8} y={C + 11} textAnchor="start" fontFamily="var(--font-mono)" fontSize={7} fill="var(--text-muted)">
        ← RESISTANCE
      </text>

      {arrow}
      <circle cx={C} cy={C} r={3.4} fill="var(--bg-subtle)" stroke="var(--text-muted)" strokeWidth={1.4} />
      {showArrow && <circle cx={ex} cy={ey} r={4.6} fill={tone} stroke="var(--bg-subtle)" strokeWidth={2} />}
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// the concentration ribbon
// ────────────────────────────────────────────────────────────────────────────

/**
 * Where the change landed on the price axis.
 *
 * A horizontal strip rather than the vertical ladder because this answers
 * "where", not "how much at each strike" — the ladder still does the latter,
 * below. Bars grow up for gamma added and down for gamma shed, so the sign is
 * carried by position as well as colour.
 */
function ConcentrationRibbon({
  strikes,
  lens,
  spot,
  band,
  bull,
  bear,
}: {
  strikes: ShiftStrike[];
  lens: Lens;
  spot: number;
  band: RegimeShiftPayload['band'];
  bull: string;
  bear: string;
}) {
  const W = 700;
  const H = 140;
  const PAD = 8;
  const TOP = 20;
  const BOT = 100;
  const MID = 60;
  const HMAX = 36;

  const ordered = useMemo(() => [...strikes].sort((a, b) => a.strike - b.strike), [strikes]);
  const reference = useMemo(() => ribbonReference(ordered, lens), [ordered, lens]);

  if (ordered.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
        No per-strike change in this window.
      </div>
    );
  }

  const lo = ordered[0].strike;
  const hi = ordered[ordered.length - 1].strike;
  const span = W - PAD * 2;
  const bw = span / ordered.length;
  const xOf = (k: number) => (hi === lo ? PAD : PAD + ((k - lo) / (hi - lo + 1)) * span);
  const bandResolved = band?.resolved && Number.isFinite(band.low) && Number.isFinite(band.high);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Change in dealer gamma by strike">
      {bandResolved && (
        <rect
          x={xOf(band.low)}
          y={TOP - 4}
          width={Math.max(bw, xOf(band.high) + bw - xOf(band.low))}
          height={BOT - TOP + 8}
          rx={5}
          fill="var(--color-warning-soft)"
          fillOpacity={0.45}
          stroke="var(--color-warning)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}

      <line x1={PAD} y1={MID} x2={W - PAD} y2={MID} stroke="var(--border-default)" strokeWidth={1} />

      {ordered.map((row) => {
        const value = lens === 'net' ? row.d_net : row.positioning;
        const h = Math.max(1.5, ribbonHeight(value, reference) * HMAX);
        const up = value >= 0;
        return (
          <rect
            key={row.strike}
            x={xOf(row.strike) + 1}
            width={Math.max(1, bw - 2)}
            y={up ? MID - h : MID}
            height={h}
            rx={1.5}
            fill={up ? bull : bear}
            opacity={h < 4 ? 0.5 : 0.92}
          >
            <title>{`${formatStrike(row.strike)}: ${formatSignedGex(value)}`}</title>
          </rect>
        );
      })}

      {spot > 0 && (
        <>
          <line
            x1={xOf(spot)}
            y1={TOP - 6}
            x2={xOf(spot)}
            y2={BOT + 4}
            stroke="var(--text-primary)"
            strokeWidth={1.3}
            strokeDasharray="4 3"
            opacity={0.7}
          />
          <text
            x={xOf(spot)}
            y={11}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={10}
            fontWeight={700}
            fill="var(--text-primary)"
          >
            SPOT {formatStrike(spot)}
          </text>
        </>
      )}

      <text x={PAD} y={BOT + 20} fontFamily="var(--font-mono)" fontSize={10} fill="var(--text-muted)">
        {formatStrike(lo)}
      </text>
      <text x={W - PAD} y={BOT + 20} textAnchor="end" fontFamily="var(--font-mono)" fontSize={10} fill="var(--text-muted)">
        {formatStrike(hi)}
      </text>
      <text
        x={bandResolved ? (xOf(band.low) + xOf(band.high) + bw) / 2 : W / 2}
        y={BOT + 34}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={10}
        fontWeight={600}
        fill={bandResolved ? 'var(--color-warning)' : 'var(--text-muted)'}
      >
        {bandResolved
          ? `${formatBand(band)}  ·  ${formatPercent(band.share)} of the move`
          : 'no concentration — change is diffuse across the chain'}
      </text>
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// main card
// ────────────────────────────────────────────────────────────────────────────

export interface GammaRegimeShiftCardProps {
  payload: RegimeShiftPayload | null;
  loading: boolean;
  error: string | null;
  lookback: Lookback;
  onLookbackChange: (l: Lookback) => void;
  lens: Lens;
  onLensChange: (l: Lens) => void;
  symbol: string;
  /** Rendered top-right — the page injects its expiry filter here. */
  control?: React.ReactNode;
}

export default function GammaRegimeShiftCard({
  payload,
  loading,
  error,
  lookback,
  onLookbackChange,
  lens,
  onLensChange,
  symbol,
  control,
}: GammaRegimeShiftCardProps) {
  const chart = useChartTheme();

  const heading = (
    <div className="flex flex-wrap items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
      <h3 className="zg-h3" style={{ color: 'var(--text-primary)' }}>
        Gamma Regime Shift
      </h3>
      <TooltipWrapper text="How dealer gamma CHANGED between two points in time, reduced to a read. Two independent axes: whether gamma near spot rose (stabilizing) or fell (fragile), and whether the change landed below spot (supportive) or above it (capping). The quadrant names the state; the distance from centre, in standard deviations of this symbol's own shift history, sets the wording.">
        <Info size={14} />
      </TooltipWrapper>
      <span
        className="rounded px-1.5 py-0.5 font-mono text-xs font-semibold"
        style={{ color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}
      >
        {symbol}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <LookbackPicker value={lookback} onChange={onLookbackChange} />
        {control}
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="zg-panel p-5">
        {heading}
        <div className="flex h-[220px] items-center justify-center px-6 text-center text-sm" style={{ color: 'var(--color-bear)' }}>
          {error === 'No data available yet'
            ? `No gamma history for ${symbol} yet.`
            : `Couldn’t load the regime shift: ${error}`}
        </div>
      </div>
    );
  }

  if (loading && !payload) {
    return (
      <div className="zg-panel p-5">
        {heading}
        <div className="flex h-[220px] items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          Reading the shift…
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="zg-panel p-5">
        {heading}
        <div className="flex h-[220px] items-center justify-center px-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          Not enough history for this window yet. Try a shorter lookback.
        </div>
      </div>
    );
  }

  const meta = STATE_META[payload.read.state];
  const tone = toneColor(meta.tone);
  const soft = toneSoft(meta.tone);
  const headline = buildHeadline(payload);
  const subhead = buildSubhead(payload);
  const caveat = buildExpiryCaveat(payload.expiry_scope);
  const normNote = buildNormalizationNote(payload.read);
  const levels = buildLevelRows(payload);
  const normalized = payload.read.normalization !== 'none';

  return (
    <div className="zg-panel p-5">
      {heading}

      {/* ── tier 1: the glance ─────────────────────────────────────────── */}
      <div className="mt-5 flex flex-wrap items-start gap-5">
        <div
          className="min-w-[170px] rounded-xl px-4 py-3"
          style={{ background: soft, border: `1px solid ${tone}`, color: tone }}
        >
          <span
            className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80"
          >
            Regime shift
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-[28px] font-bold leading-tight">
            <span className="font-mono text-xl">{meta.glyph}</span>
            {meta.label}
          </span>
          <span className="mt-1 block font-mono text-[11px] opacity-90">
            {normalized
              ? `${payload.read.magnitude.toFixed(1)}σ · ${payload.read.adverb}`
              : 'magnitude not measured'}
          </span>
        </div>

        <div className="min-w-[280px] flex-1">
          <p className="text-xl font-bold leading-snug md:text-2xl" style={{ color: 'var(--text-primary)' }}>
            {headline}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {subhead}
          </p>
          {/* The two axes as separate chips: a session can be stabilizing AND
              capping, and one quadrant word cannot carry both. */}
          {payload.read.state !== 'QUIET' && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <AxisChip label={meta.stability} value={formatZ(payload.read.stability_z)} />
              <AxisChip label={meta.direction} value={formatZ(payload.read.lean_z)} />
            </div>
          )}
        </div>
      </div>

      {/* ── tier 2: the evidence ───────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[264px_1fr]">
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
          <PanelHead
            left="Shift plane"
            right={normalized ? `σ vs ${payload.read.sessions_in_window}d` : 'unscaled'}
          />
          <div className="flex justify-center">
            <ShiftPlane
              leanZ={payload.read.lean_z}
              stabilityZ={payload.read.stability_z}
              tone={tone}
              normalized={normalized}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Centre is no change. The arrow tip is where the book sits now — past the
            2σ ring is the word “{payload.read.adverb}”. Upper half stabilizing,
            lower half fragile.
          </p>
        </div>

        <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
          <PanelHead
            left="Before → after"
            right={`${fmtTime(payload.from.timestamp)} → ${fmtTime(payload.to.timestamp)} ET`}
          />
          <div>
            {levels.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-[84px_1fr] items-baseline gap-2.5 border-b py-2.5 last:border-b-0"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {row.label}
                </span>
                <span className="flex flex-wrap items-baseline gap-2 font-mono text-[13px] tabular-nums">
                  {row.before && (
                    <>
                      <span className="line-through opacity-80" style={{ color: 'var(--text-muted)' }}>
                        {row.before}
                      </span>
                      <span className="text-[11px]" style={{ color: SENSE_COLOR[row.sense] }}>
                        {DIRECTION_GLYPH[row.direction]}
                      </span>
                    </>
                  )}
                  <span className="font-bold" style={{ color: SENSE_COLOR[row.sense] }}>
                    {row.after}
                  </span>
                  <span className="font-sans text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                    {row.note}
                  </span>
                </span>
              </div>
            ))}
          </div>
          {caveat && (
            <p
              className="mt-3 border-t pt-2.5 text-[11.5px] leading-relaxed"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
            >
              {caveat}
            </p>
          )}
        </div>
      </div>

      {/* ── where it landed ────────────────────────────────────────────── */}
      <div className="mt-4 rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
        <PanelHead
          left="Where the change landed"
          right={`${payload.strikes.length} strikes${payload.strikes_truncated ? ' (largest movers)' : ''}`}
        />
        <ConcentrationRibbon
          strikes={payload.strikes}
          lens={lens}
          spot={payload.spot}
          band={payload.band}
          bull={chart.bull}
          bear={chart.bear}
        />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
          <span>
            <strong style={{ color: 'var(--text-secondary)' }}>Above the line</strong> = gamma added{' '}
            <span style={{ color: chart.bull }}>▲</span>
          </span>
          <span>
            <strong style={{ color: 'var(--text-secondary)' }}>Below</strong> = gamma shed{' '}
            <span style={{ color: chart.bear }}>▼</span>
          </span>
          <span>Height is scaled against a typical strike move, so a quiet window looks quiet</span>
        </div>
      </div>

      {/* ── lens + disclosure ──────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <LensToggle lens={lens} onChange={onLensChange} />
        <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {payload.lookback_label}
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {lens === 'net'
          ? 'Total change — every reason gamma moved between the two times, including the existing book re-pricing as spot and implied vol moved.'
          : 'Repositioning — only the part driven by contracts actually opened or closed, stripping out price-driven re-pricing (a first-order estimate).'}
      </p>
      {normNote && (
        <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
          {normNote}
        </p>
      )}
      <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Modeled dealer gamma (calls positive, puts negative open-interest convention);
        actual dealer inventory is not observable from public option-chain data.
      </p>

      <ChartCaption />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// sub-components
// ────────────────────────────────────────────────────────────────────────────

function PanelHead({ left, right }: { left: string; right?: string }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>
        {left}
      </span>
      {right && (
        <span className="font-mono text-[9.5px]" style={{ color: 'var(--text-muted)' }}>
          {right}
        </span>
      )}
    </div>
  );
}

function AxisChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
    >
      {label}
      <span className="font-mono opacity-80">{value}</span>
    </span>
  );
}

function LookbackPicker({
  value,
  onChange,
}: {
  value: Lookback;
  onChange: (l: Lookback) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {LOOKBACK_ORDER.map((key) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            className="rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors"
            style={{
              background: active ? 'var(--color-warning-soft)' : 'transparent',
              border: `1px solid ${active ? 'var(--color-warning)' : 'var(--border-default)'}`,
              color: active ? 'var(--color-warning)' : 'var(--text-muted)',
              fontWeight: active ? 600 : 500,
            }}
          >
            {LOOKBACK_LABEL[key]}
          </button>
        );
      })}
    </div>
  );
}

function LensToggle({ lens, onChange }: { lens: Lens; onChange: (l: Lens) => void }) {
  const opt = (key: Lens, label: string) => {
    const on = lens === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => onChange(key)}
        aria-pressed={on}
        className="rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors"
        style={{
          background: on ? 'var(--color-info)' : 'transparent',
          color: on ? 'var(--color-surface)' : 'var(--text-secondary)',
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div
      className="inline-flex rounded-lg p-0.5"
      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
    >
      {opt('net', 'Total change')}
      {opt('positioning', 'Repositioning')}
    </div>
  );
}
