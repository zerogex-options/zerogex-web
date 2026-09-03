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
 * Layout notes, from the first cut's mistakes:
 *
 * * The levels were a VERTICAL LIST in a half-width column, which used about
 *   half the width it was given and left ~100px dead beneath it. They are now
 *   a row of tiles across the full panel — which is also what lets each value
 *   be 20px instead of 13px.
 * * The plane sat alone in a 264px column with a paragraph under it. It now
 *   anchors the hero row beside the headline it illustrates.
 * * Zones are separated by hairline rules, not nested bordered boxes — the
 *   house rule is "one border deep" (components/layout/Panel.tsx), and the
 *   nesting was also spending ~26px of horizontal padding per box.
 *
 * Encoding rules this card holds to:
 *
 * * **Direction is positional, not just chromatic.** Gamma built BELOW spot
 *   is a floor; the identical build ABOVE spot is a ceiling. The old ladder
 *   colored both green. Here the lean axis carries it, and the ribbon puts
 *   spot on the axis so the side is visible.
 * * **The arrow and the color come from different fields.** A gamma flip
 *   dropping is a falling number and a bullish event. `LevelRow.direction`
 *   drives the glyph, `LevelRow.sense` drives the color — see core/regimeShift.
 *
 * Color is never load-bearing alone: bull/bear separate at ΔE ~34 for normal
 * vision but collapse to ~5 under deuteranopia, so every colored mark here
 * also carries a glyph, a sign, or a position.
 */

import { useMemo } from 'react';
import { useChartTheme } from '@/hooks/useChartTheme';
import MobileScrollableChart from './MobileScrollableChart';
import {
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
  type RegimeShiftPayload,
  type ShiftStrike,
} from '@/core/regimeShift';
import {
  Chip,
  HeroStat,
  LevelTile,
  Note,
  PanelHeader,
  PanelMessage,
  Zone,
  toneColor,
} from './RegimeShiftUI';

// ────────────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────────────

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

const HEADER_TOOLTIP =
  "How dealer gamma CHANGED between two points in time, reduced to a read. Two independent axes: whether gamma near spot rose (stabilizing) or fell (fragile), and whether the change landed below spot (supportive) or above it (capping). The quadrant names the state; the distance from center, in standard deviations of this symbol's own shift history, sets the wording.";

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
 *
 * The viewBox is sized so one unit ≈ one rendered pixel at the size this
 * actually draws at. The first cut used a 230-unit box with 7-unit labels,
 * which rendered at literally 7px.
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
  const SIZE = 220;
  const C = SIZE / 2;
  const R = 80;
  const MAX = 3;
  const px = (v: number) => C + (Math.max(-MAX, Math.min(MAX, v)) / MAX) * R;
  const py = (v: number) => C - (Math.max(-MAX, Math.min(MAX, v)) / MAX) * R;

  const ex = px(leanZ);
  const ey = py(stabilityZ);
  const len = Math.hypot(ex - C, ey - C);
  const showArrow = normalized && len > 4;

  const quadrants = [
    { x: C, y: 0, fill: 'var(--color-bull-soft)', label: 'FIRMING', lx: SIZE - 9, ly: 18, anchor: 'end' },
    { x: 0, y: 0, fill: 'var(--color-info-soft)', label: 'CAPPING', lx: 9, ly: 18, anchor: 'start' },
    { x: C, y: C, fill: 'var(--color-warning-soft)', label: 'FRAGILE BID', lx: SIZE - 9, ly: SIZE - 10, anchor: 'end' },
    { x: 0, y: C, fill: 'var(--color-bear-soft)', label: 'DETERIORATING', lx: 9, ly: SIZE - 10, anchor: 'start' },
  ] as const;

  let arrow = null;
  if (showArrow) {
    const ux = (ex - C) / len;
    const uy = (ey - C) / len;
    const a = Math.atan2(uy, ux);
    const W = 0.42;
    const H = 11;
    const head = [
      [ex, ey],
      [ex - H * Math.cos(a - W), ey - H * Math.sin(a - W)],
      [ex - H * Math.cos(a + W), ey - H * Math.sin(a + W)],
    ]
      .map((p) => p.join(','))
      .join(' ');
    arrow = (
      <>
        <line
          x1={C}
          y1={C}
          x2={ex - ux * 8}
          y2={ey - uy * 8}
          stroke={tone}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <polygon points={head} fill={tone} />
      </>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      className="max-w-full"
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
            fontSize={10}
            fontWeight={600}
            letterSpacing={0.6}
            fill="var(--text-secondary)"
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
            x={C + 4}
            y={py(r) - 4}
            fontFamily="var(--font-mono)"
            fontSize={10}
            fill="var(--text-muted)"
          >
            {r}σ
          </text>
        </g>
      ))}

      <line x1={C - R - 10} y1={C} x2={C + R + 10} y2={C} stroke="var(--border-default)" strokeWidth={1} />
      <line x1={C} y1={C - R - 10} x2={C} y2={C + R + 10} stroke="var(--border-default)" strokeWidth={1} />
      <text x={C + R + 10} y={C + 14} textAnchor="end" fontFamily="var(--font-mono)" fontSize={10} fill="var(--text-muted)">
        SUPPORT →
      </text>
      <text x={C - R - 10} y={C + 14} textAnchor="start" fontFamily="var(--font-mono)" fontSize={10} fill="var(--text-muted)">
        ← RESISTANCE
      </text>

      {arrow}
      <circle cx={C} cy={C} r={4} fill="var(--bg-card)" stroke="var(--text-muted)" strokeWidth={1.5} />
      {showArrow && <circle cx={ex} cy={ey} r={5.5} fill={tone} stroke="var(--bg-card)" strokeWidth={2} />}
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
 * carried by position as well as color.
 *
 * The viewBox is 1200 wide and 240 tall so it fills a full-width panel at
 * roughly 1:1 unit-to-pixel, instead of a 700x140 box stretched across 1200px
 * (which scaled the type to ~17px and left the bars in a thin band).
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
  const W = 1200;
  const H = 196;
  const PAD = 12;
  const BOT = 158;
  const MID = 92;
  const HMAX = 64;

  const ordered = useMemo(() => [...strikes].sort((a, b) => a.strike - b.strike), [strikes]);
  const reference = useMemo(() => ribbonReference(ordered, lens), [ordered, lens]);

  if (ordered.length === 0) {
    return (
      <PanelMessage height={160}>No per-strike change in this window.</PanelMessage>
    );
  }

  const lo = ordered[0].strike;
  const hi = ordered[ordered.length - 1].strike;
  const span = W - PAD * 2;
  const bw = span / ordered.length;
  const xOf = (k: number) => (hi === lo ? PAD : PAD + ((k - lo) / (hi - lo + 1)) * span);
  const bandResolved = band?.resolved && Number.isFinite(band.low) && Number.isFinite(band.high);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Change in dealer gamma by strike"
    >
      {bandResolved && (
        <rect
          x={xOf(band.low)}
          // Hug the bar field rather than the whole box: the band marks a
          // strike RANGE, and a rect drawn to the full height reads as a
          // large empty area under whichever side happens to be quiet.
          y={MID - HMAX - 6}
          width={Math.max(bw, xOf(band.high) + bw - xOf(band.low))}
          height={HMAX * 2 + 12}
          rx={6}
          // A light wash, not a block: the band marks a strike range, so its
          // rect necessarily spans both halves of a diverging chart and a
          // heavier fill reads as "something is missing" under whichever side
          // is quiet that session.
          fill="var(--color-warning-soft)"
          fillOpacity={0.16}
          stroke="var(--color-warning)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      )}

      <line x1={PAD} y1={MID} x2={W - PAD} y2={MID} stroke="var(--border-default)" strokeWidth={1} />

      {ordered.map((row) => {
        const value = lens === 'net' ? row.d_net : row.positioning;
        const h = Math.max(2, ribbonHeight(value, reference) * HMAX);
        const up = value >= 0;
        return (
          <rect
            key={row.strike}
            x={xOf(row.strike) + 1.5}
            width={Math.max(2, bw - 3)}
            y={up ? MID - h : MID}
            height={h}
            rx={2}
            fill={up ? bull : bear}
            opacity={h < 8 ? 0.55 : 0.92}
          >
            <title>{`${formatStrike(row.strike)}: ${formatSignedGex(value)}`}</title>
          </rect>
        );
      })}

      {spot > 0 && (
        <>
          <line
            x1={xOf(spot)}
            y1={MID - HMAX - 12}
            x2={xOf(spot)}
            y2={BOT + 4}
            stroke="var(--text-primary)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            opacity={0.7}
          />
          <text
            x={xOf(spot)}
            y={14}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={13}
            fontWeight={700}
            fill="var(--text-primary)"
          >
            SPOT {formatStrike(spot)}
          </text>
        </>
      )}

      <text x={PAD} y={BOT + 26} fontFamily="var(--font-mono)" fontSize={12} fill="var(--text-muted)">
        {formatStrike(lo)}
      </text>
      <text
        x={W - PAD}
        y={BOT + 26}
        textAnchor="end"
        fontFamily="var(--font-mono)"
        fontSize={12}
        fill="var(--text-muted)"
      >
        {formatStrike(hi)}
      </text>
      <text
        x={bandResolved ? (xOf(band.low) + xOf(band.high) + bw) / 2 : W / 2}
        y={BOT + 26}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={13}
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
  lens: Lens;
  onLensChange: (l: Lens) => void;
  symbol: string;
}

export default function GammaRegimeShiftCard({
  payload,
  loading,
  error,
  lens,
  onLensChange,
  symbol,
}: GammaRegimeShiftCardProps) {
  const chart = useChartTheme();

  if (error) {
    return (
      <div className="zg-panel">
        <PanelHeader title="Gamma Regime Shift" tooltip={HEADER_TOOLTIP} />
        <PanelMessage tone="bear">
          {error === 'No data available yet'
            ? `No gamma history for ${symbol} yet.`
            : `Couldn’t load the regime shift: ${error}`}
        </PanelMessage>
      </div>
    );
  }

  if (loading && !payload) {
    return (
      <div className="zg-panel">
        <PanelHeader title="Gamma Regime Shift" tooltip={HEADER_TOOLTIP} />
        <PanelMessage>Reading the shift…</PanelMessage>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="zg-panel">
        <PanelHeader title="Gamma Regime Shift" tooltip={HEADER_TOOLTIP} />
        <PanelMessage>
          Not enough history for this window yet. Try a shorter lookback.
        </PanelMessage>
      </div>
    );
  }

  const meta = STATE_META[payload.read.state];
  const tone = toneColor(meta.tone);
  const levels = buildLevelRows(payload);
  const caveat = buildExpiryCaveat(payload.expiry_scope);
  const normNote = buildNormalizationNote(payload.read);
  const normalized = payload.read.normalization !== 'none';

  return (
    <div className="zg-panel">
      <PanelHeader
        title="Gamma Regime Shift"
        tooltip={HEADER_TOOLTIP}
        right={
          <span className="font-mono text-[12px]" style={{ color: 'var(--text-muted)' }}>
            {payload.lookback_label} · {fmtTime(payload.from.timestamp)} →{' '}
            {fmtTime(payload.to.timestamp)} ET
          </span>
        }
      />

      {/* ── the glance: state, sentence, and the plane that proves it ───── */}
      <Zone flush>
        <div className="flex flex-wrap items-start gap-6">
          <HeroStat
            eyebrow="Regime shift"
            value={`${meta.glyph} ${meta.label}`}
            caption={
              normalized
                ? `${payload.read.magnitude.toFixed(1)}σ · ${payload.read.adverb}`
                : 'magnitude not measured'
            }
            tone={meta.tone}
          />

          <div className="min-w-[300px] flex-1">
            <p
              className="text-[clamp(22px,2.2vw,30px)] font-bold leading-[1.2] tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {buildHeadline(payload)}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {buildSubhead(payload)}
            </p>
            {/* The two axes as separate chips: a session can be stabilizing AND
                capping, and one quadrant word cannot carry both. */}
            {payload.read.state !== 'QUIET' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip label={meta.stability} value={formatZ(payload.read.stability_z)} />
                <Chip label={meta.direction} value={formatZ(payload.read.lean_z)} />
                <Chip
                  label="normalized vs"
                  value={normalized ? `${payload.read.sessions_in_window} sessions` : '—'}
                />
              </div>
            )}
            {/* The plane's legend lives here rather than under the plane: it
                fills the column that would otherwise run out of content first,
                and it reads as a caption to the whole row either way. */}
            <p className="mt-4 max-w-[62ch] text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              On the plane, center is no change and the arrow tip is where the book sits
              now — its length is the size of the move, so landing past the 2σ ring is
              exactly the word “{payload.read.adverb}”. The upper half is stabilizing, the
              lower half fragile; right of center is supportive, left is capping.
            </p>
          </div>

          <div className="shrink-0">
            <ShiftPlane
              leanZ={payload.read.lean_z}
              stabilityZ={payload.read.stability_z}
              tone={tone}
              normalized={normalized}
            />
          </div>
        </div>
      </Zone>

      {/* ── the levels, as a row that fills the panel ───────────────────── */}
      <Zone label="Before → after">
        <div className="flex flex-wrap gap-y-4">
          {levels.map((row) => (
            <LevelTile
              key={row.key}
              label={row.label}
              before={row.before || undefined}
              after={row.after}
              glyph={DIRECTION_GLYPH[row.direction]}
              color={SENSE_COLOR[row.sense]}
              note={row.note}
            />
          ))}
        </div>
      </Zone>

      {/* ── where it landed ────────────────────────────────────────────── */}
      <Zone
        label="Where the change landed"
        right={`${payload.strikes.length} strikes${payload.strikes_truncated ? ' · largest movers' : ''}`}
      >
        {/* A 36-strike price axis squeezed into a phone's width scales every
            label to ~4px. On narrow screens the ribbon keeps a readable scale
            and scrolls instead, the same way every other wide chart on the
            site behaves. */}
        <MobileScrollableChart minWidthClass="min-w-[760px]" initialScroll="center">
          <ConcentrationRibbon
            strikes={payload.strikes}
            lens={lens}
            spot={payload.spot}
            band={payload.band}
            bull={chart.bull}
            bear={chart.bear}
          />
        </MobileScrollableChart>
        <div
          className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px]"
          style={{ color: 'var(--text-muted)' }}
        >
          <span>
            <strong style={{ color: 'var(--text-secondary)' }}>Above the line</strong> = gamma
            added <span style={{ color: chart.bull }}>▲</span>
          </span>
          <span>
            <strong style={{ color: 'var(--text-secondary)' }}>Below</strong> = gamma shed{' '}
            <span style={{ color: chart.bear }}>▼</span>
          </span>
          <span>Height is scaled against a typical strike move, so a quiet window looks quiet</span>
        </div>
      </Zone>

      {/* ── lens + disclosure ──────────────────────────────────────────── */}
      <Zone>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[280px] flex-1">
            <LensToggle lens={lens} onChange={onLensChange} />
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {lens === 'net'
                ? 'Total change — every reason gamma moved between the two times, including the existing book re-pricing as spot and implied vol moved.'
                : 'Repositioning — only the part driven by contracts actually opened or closed, stripping out price-driven re-pricing (a first-order estimate).'}
            </p>
          </div>
          <div className="min-w-[280px] flex-1 space-y-1.5">
            {caveat && <Note>{caveat}</Note>}
            {normNote && <Note tone="warning">{normNote}</Note>}
            <Note>
              Modeled dealer gamma (calls positive, puts negative open-interest
              convention); actual dealer inventory is not observable from public
              option-chain data.
            </Note>
          </div>
        </div>
      </Zone>
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
        className="rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors"
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
