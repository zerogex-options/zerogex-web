'use client';

/**
 * GammaExpectationMatrix — the "where do we expect the underlying to go" read.
 *
 * A deliberately simple 2×2 decision matrix that turns two inputs a trader can
 * read straight off the Gamma Chart into a plain-language expectation for how
 * price behaves at the nearest wall:
 *
 *   • Gamma Regime  — Positive (dealers long gamma at spot, pinning) vs
 *                     Negative (dealers short gamma, trending).
 *   • Approach      — the wall in play: the Call Wall above, or the Put Wall
 *                     below.
 *
 * Each cell describes the classic dealer-hedging MECHANISM, not a hold/break
 * forecast: in positive gamma, hedging leans against a move into the wall (a
 * magnet); in negative gamma it adds to the move, so a wall that gives way can
 * run (fuel). ZeroGEX's own study of 737 wall tests found the regime did not
 * predict which walls broke (content/articles/how-often-do-gamma-walls-break.md),
 * so no cell may say a wall is more likely to hold or to break. The measured
 * base rate for the symbol's index (`wallBaseRate` in core/gammaPlaybook)
 * carries the odds instead. It is decision-support context, not a signal.
 *
 * The highlighted cell is NOT a default — it is resolved live from the same
 * levels the Gamma Chart is drawing for the symbol and expirations the user has
 * selected (useGammaPlaybook → core/gammaPlaybook), so switching SPY → NDX, or
 * filtering the chain down to 0DTE, moves the read with it. Clicking a cell
 * still pins a manual "what if" read; changing symbol or expirations re-arms
 * the live one, and "Follow the chart" restores it on demand.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUp, ArrowDown, Crosshair, Magnet, RotateCcw, Zap } from 'lucide-react';
import ChartCaption from "./ChartCaption";
import { useGammaPlaybook } from "@/hooks/useGammaPlaybook";
import { formatLevel, wallBaseRate } from "@/core/gammaPlaybook";
import type { ChartSnapshot } from "./GammaTerminalChart";

type Regime = 'positive' | 'negative';
type Approach = 'up' | 'down'; // 'up' → Call Wall, 'down' → Put Wall

interface CellSpec {
  headline: string;
  tag: string;
  /** What modeled dealer hedging does to a move into the wall. */
  hedging: 'dampens' | 'fuels';
  read: string;
  watch: string;
  caution: string;
}

// Mechanism only. The study behind `wallBaseRate` found S&P walls held about 2
// in 3 tests within an hour whichever side of the flip price was on, so a cell
// that promised a hold in one row or a break in the other would be wrong about
// most of the tests in that row.
const MATRIX: Record<Regime, Record<Approach, CellSpec>> = {
  positive: {
    up: {
      headline: 'Damped rally',
      tag: 'Magnet · hedging dampens rallies',
      hedging: 'dampens',
      read: 'The book is modeled long gamma at spot, so dealer hedging sells into strength. As price rises toward the Call Wall, that selling leans against the move and can slow the rally or pin price near the strike. If the wall does give way, long-gamma hedging keeps leaning against the move rather than adding to it.',
      watch: 'Whether the rally slows as it nears the strike. Stalling or pinning there is the hedging showing up; a close above the wall that stays there means the move outran it.',
      caution: 'The book turning short gamma (the chart badge flipping to SHORT) reverses the hedging: it starts adding to moves instead of leaning against them.',
    },
    down: {
      headline: 'Cushioned dip',
      tag: 'Magnet · hedging dampens selloffs',
      hedging: 'dampens',
      read: 'The book is modeled long gamma at spot, so aggregate dealer hedging buys into weakness. As price slips toward the Put Wall, that buying leans against the decline and can slow it or pin price near the strike. If the wall does give way, long-gamma hedging keeps leaning against the move rather than adding to it.',
      watch: 'Whether the decline slows as it nears the strike. Stalling or pinning there is the hedging showing up; a close below the wall that stays there means the move outran it.',
      caution: 'A drop through the Gamma Flip, which often sits above the Put Wall, turns the book short gamma\u00a0- from there, hedging adds to the decline instead of cushioning it.',
    },
  },
  negative: {
    up: {
      headline: 'Squeeze risk',
      tag: 'Fuel · hedging adds to rallies',
      hedging: 'fuels',
      read: 'The book is modeled short gamma at spot, so dealer hedging buys as price rises and adds to the move. If the Call Wall gives way, that buying can feed a gamma squeeze that carries price higher, faster.',
      watch: 'Whether a break sticks. A first print above the wall proves little: failed breakouts often stay beyond a wall for ten or fifteen minutes before unwinding.',
      caution: 'A move back above the Gamma Flip turns the book long gamma again, and hedging goes back to leaning against the rally instead of feeding it.',
    },
    down: {
      headline: 'Flush risk',
      tag: 'Fuel · hedging adds to selloffs',
      hedging: 'fuels',
      read: 'The book is modeled short gamma at spot, so dealer hedging sells as price falls and adds to the move. If the Put Wall gives way, that selling can accelerate the decline into a downside gamma flush.',
      watch: 'Whether a break sticks. A first print below the wall proves little: failed breakdowns often stay beyond a wall for ten or fifteen minutes before unwinding.',
      caution: 'A move back above the Gamma Flip turns the book long gamma again, and hedging goes back to leaning against the decline instead of adding to it.',
    },
  },
};

const REGIMES: Array<{ value: Regime; label: string; sub: string }> = [
  { value: 'positive', label: 'Positive γ', sub: 'Dealers long γ · pinning' },
  { value: 'negative', label: 'Negative γ', sub: 'Dealers short γ · trending' },
];

const APPROACHES: Array<{ value: Approach; label: string; icon: React.ReactNode }> = [
  { value: 'up', label: 'Up → Call Wall', icon: <ArrowUp size={13} /> },
  { value: 'down', label: 'Down → Put Wall', icon: <ArrowDown size={13} /> },
];

// Fallback cell for a book too degraded to read (no flip, no walls). Shown
// un-highlighted behind the "awaiting data" badge, so the matrix still explains
// itself instead of rendering blank.
const FALLBACK_REGIME: Regime = 'positive';
const FALLBACK_APPROACH: Approach = 'up';

// Fill/accent per hedging effect: hedging that dampens a move reads as
// contained (info), hedging that fuels one as explosive (hot). Direction is
// carried separately by the arrow glyph so the two dimensions stay legible at
// a glance.
function hedgingAccent(hedging: CellSpec['hedging']): string {
  return hedging === 'dampens' ? 'var(--color-info)' : 'var(--color-accent-hot)';
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string; sub?: string; icon?: React.ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-stretch rounded-full p-0.5 border"
      style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--color-surface-subtle)' }}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors"
            style={
              active
                ? { backgroundColor: 'var(--color-info)', color: 'var(--color-surface)' }
                : { background: 'transparent', color: 'var(--text-muted)' }
            }
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function GammaExpectationMatrix({
  className = '',
  snapshot = null,
  delayed = false,
}: {
  className?: string;
  /** Delayed public snapshot, passed straight through to the read (no client fetching). */
  snapshot?: ChartSnapshot | null;
  /** Force delayed mode even without a snapshot, mirroring GammaTerminalChart. */
  delayed?: boolean;
}) {
  const read = useGammaPlaybook({ snapshot, delayed });
  const { scenario } = read;

  // A manual pin ("what if the tape were short gamma?") overrides the live read
  // until the user drops it — but only for THIS symbol + expiration selection.
  // Changing either means the trader is asking about a different book, so the
  // live read re-arms. Adjusting state during render on a key change is the same
  // React-sanctioned pattern the chart and data hooks use, so it needs no effect.
  const [pinned, setPinned] = useState<{ regime: Regime; approach: Approach } | null>(null);
  const selectionKey = `${read.symbol}:${read.expirations.join(',')}`;
  const [trackedKey, setTrackedKey] = useState(selectionKey);
  if (trackedKey !== selectionKey) {
    setTrackedKey(selectionKey);
    setPinned(null);
  }

  const regime: Regime = pinned?.regime ?? scenario.regime ?? FALLBACK_REGIME;
  const approach: Approach = pinned?.approach ?? scenario.approach ?? FALLBACK_APPROACH;
  // A pin that lands on the live cell is indistinguishable from following it, so
  // it doesn't earn the "Manual read" badge — the market simply caught up.
  const following =
    pinned === null || (regime === scenario.regime && approach === scenario.approach);
  // True only when the highlighted cell IS the live read — the badge and the
  // matrix must never claim a live read the data didn't support.
  const liveRead = following && scenario.resolved;

  const select = (nextRegime: Regime, nextApproach: Approach) => {
    // Re-selecting exactly what the live read already says drops the pin rather
    // than freezing an identical manual copy of it.
    if (scenario.resolved && nextRegime === scenario.regime && nextApproach === scenario.approach) {
      setPinned(null);
      return;
    }
    setPinned({ regime: nextRegime, approach: nextApproach });
  };

  const active = MATRIX[regime][approach];
  const accent = hedgingAccent(active.hedging);

  const statusColor = liveRead
    ? read.delayed
      ? 'var(--color-warning)'
      : 'var(--color-brand-primary)'
    : following
      ? 'var(--text-muted)'
      : 'var(--color-warning)';
  const statusLabel = liveRead
    ? read.delayed
      ? 'Delayed read · ~15 min'
      : 'Live read'
    : following
      ? read.loading
        ? 'Reading the chain…'
        : 'Awaiting gamma data'
      : 'Manual read';

  return (
    <section className={`zg-feature-shell p-5 sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <span className="zg-eyebrow" style={{ color: 'var(--color-brand-primary)' }}>
          Playbook
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            color: statusColor,
            border: `1px solid ${statusColor}`,
            background: `color-mix(in srgb, ${statusColor} 10%, transparent)`,
          }}
        >
          <Crosshair size={11} />
          {statusLabel}
        </span>
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 6,
        }}
      >
        Where do we expect the underlying to go?
      </h2>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: 720, marginBottom: 14 }}>
        The matrix describes what modeled dealer hedging does as price trades into the nearest wall&nbsp;- lean against
        the move (a magnet) or add to it (fuel). That is the mechanism, not the odds: how often walls actually give way is
        in the read below. The highlighted cell is read live from the chart above
        for <strong style={{ color: 'var(--text-primary)' }}>{read.symbol}</strong> and the expirations you have
        selected; pick another cell any time to explore the other three.
      </p>

      {/* What the read is standing on — the same levels drawn on the chart. */}
      <LevelStrip read={read} />

      <div style={{ maxWidth: 760, marginTop: 10, marginBottom: 16 }}>
        {/* While a manual cell is pinned the sentence still reports the LIVE
            read, so it has to say so — otherwise it looks like an explanation
            of the cell the user picked. */}
        {!following && (
          <div className="zg-eyebrow" style={{ fontSize: 10, marginBottom: 3 }}>
            Live read (you are viewing a manual cell)
          </div>
        )}
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          {read.rationale}
          {scenario.resolved && scenario.beyondWall && (
            <>
              {' '}
              <span style={{ color: 'var(--color-warning)' }}>
                Price is on the far side of that wall&nbsp;- treat the level as the one being retested.
              </span>
            </>
          )}
        </p>
      </div>

      {/* Inputs */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 mb-5">
        <div className="flex flex-col gap-1.5">
          <span className="zg-eyebrow" style={{ fontSize: 10 }}>Gamma Regime</span>
          <Segmented
            options={REGIMES}
            value={regime}
            onChange={(v) => select(v, approach)}
            ariaLabel="Gamma regime"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="zg-eyebrow" style={{ fontSize: 10 }}>Approach</span>
          <Segmented
            options={APPROACHES}
            value={approach}
            onChange={(v) => select(regime, v)}
            ariaLabel="Price approach"
          />
        </div>
        {!following && (
          <button
            type="button"
            onClick={() => setPinned(null)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              border: '1px solid var(--color-brand-primary)',
              color: 'var(--color-brand-primary)',
              background: 'transparent',
            }}
          >
            <RotateCcw size={13} />
            Follow the chart
          </button>
        )}
      </div>

      {/* 2×2 matrix. On a phone each regime's label takes a row of its own
          above its two cells: beside them it left each cell ~90px at 360px,
          narrower than "Breakdown", and the right column ran off the card. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_1fr_1fr]">
        {/* header row */}
        <div className="hidden sm:block" />
        {APPROACHES.map((a) => (
          <div
            key={a.value}
            className="flex items-center justify-center gap-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-secondary)' }}
          >
            {a.icon}
            {a.label}
          </div>
        ))}

        {/* body rows */}
        {REGIMES.map((r) => (
          <RowFragment
            key={r.value}
            regime={r.value}
            regimeLabel={r.label}
            regimeSub={r.sub}
            activeRegime={regime}
            activeApproach={approach}
            liveRegime={scenario.regime}
            liveApproach={scenario.approach}
            onSelect={select}
          />
        ))}
      </div>

      {/* Detailed read for the selected cell */}
      <div
        className="mt-5 rounded-xl p-4 sm:p-5"
        style={{
          border: `1px solid ${accent}`,
          background: `color-mix(in srgb, ${accent} 7%, transparent)`,
        }}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <span
            className="inline-flex items-center justify-center"
            style={{ width: 30, height: 30, borderRadius: 8, color: accent, background: `color-mix(in srgb, ${accent} 16%, transparent)` }}
          >
            {active.hedging === 'dampens' ? <Magnet size={16} /> : <Zap size={16} />}
          </span>
          <div className="flex flex-col">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {active.headline}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
              {regime === 'positive' ? 'Positive γ' : 'Negative γ'} · {active.tag}
            </span>
          </div>
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{active.read}</p>
        <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
          <div className="rounded-lg p-2.5" style={{ background: 'var(--color-surface-subtle)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-info)' }}>
              What to watch
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>{active.watch}</div>
          </div>
          <div className="rounded-lg p-2.5" style={{ background: 'var(--color-surface-subtle)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-warning)' }}>
              What invalidates it
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>{active.caution}</div>
          </div>
          {/* The odds, stated once and the same for every cell: the study found
              the regime (the row) did not change how often walls broke. */}
          <div className="rounded-lg p-2.5 sm:col-span-2" style={{ background: 'var(--color-surface-subtle)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-info)' }}>
              How often walls break
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>
              {wallBaseRate(read.symbol)}{' '}
              <Link
                href="/education/how-often-do-gamma-walls-break"
                style={{ color: 'var(--color-brand-primary)', fontWeight: 600, textDecoration: 'underline' }}
              >
                See the study
              </Link>
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-muted)', marginTop: 14 }}>
        Regime is the modeled sign of dealer gamma at spot (the chart&apos;s LONG/SHORT badge, falling back to spot vs
        the Gamma Flip); the wall in play is whichever of the Call Wall / Put Wall sits nearest spot&nbsp;- all drawn on the
        chart, and all following your symbol and expiration picks. This is a simplified dealer-hedging heuristic and
        decision-support context, not a guarantee of price behavior or investment advice.
      </p>
      <ChartCaption live delayed={read.delayed} />
    </section>
  );
}

/** The levels the highlighted cell is standing on, in the chart's own terms. */
function LevelStrip({ read }: { read: ReturnType<typeof useGammaPlaybook> }) {
  const wall = read.scenario.wall;
  const items: Array<{ label: string; value: string; accent?: string }> = [];
  items.push({ label: 'Scope', value: read.expirationLabel });
  if (read.spot != null) items.push({ label: 'Spot', value: formatLevel(read.spot) });
  if (read.flip != null) items.push({ label: 'Flip', value: formatLevel(read.flip) });
  if (read.callWall != null) {
    items.push({
      label: 'Call Wall',
      value: formatLevel(read.callWall),
      accent: wall?.side === 'call' ? 'var(--color-bull)' : undefined,
    });
  }
  if (read.putWall != null) {
    items.push({
      label: 'Put Wall',
      value: formatLevel(read.putWall),
      accent: wall?.side === 'put' ? 'var(--color-bear)' : undefined,
    });
  }
  if (wall) {
    items.push({
      label: read.scenario.beyondWall ? 'Through by' : 'Distance',
      value: `${wall.distancePct.toFixed(2)}%`,
    });
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl px-3.5 py-2.5"
      style={{ background: 'var(--color-surface-subtle)', border: '1px solid var(--border-subtle)' }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: 'var(--text-primary)',
        }}
      >
        {read.symbol}
      </span>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-baseline gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {item.label}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              fontWeight: 600,
              color: item.accent ?? 'var(--text-primary)',
            }}
          >
            {item.value}
          </span>
        </span>
      ))}
    </div>
  );
}

function RowFragment({
  regime,
  regimeLabel,
  regimeSub,
  activeRegime,
  activeApproach,
  liveRegime,
  liveApproach,
  onSelect,
}: {
  regime: Regime;
  regimeLabel: string;
  regimeSub: string;
  activeRegime: Regime;
  activeApproach: Approach;
  /** The cell the live read resolves to, so a pinned view still shows where the tape actually is. */
  liveRegime: Regime | null;
  liveApproach: Approach | null;
  onSelect: (regime: Regime, approach: Approach) => void;
}) {
  return (
    <>
      <div className="col-span-2 flex items-baseline gap-2 pt-1.5 sm:col-span-1 sm:min-w-24 sm:flex-col sm:items-stretch sm:justify-center sm:gap-0 sm:py-2 sm:pr-2">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          {regimeLabel}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{regimeSub}</span>
      </div>
      {APPROACHES.map((a) => {
        const cell = MATRIX[regime][a.value];
        const accent = hedgingAccent(cell.hedging);
        const isActive = activeRegime === regime && activeApproach === a.value;
        const isLive = liveRegime === regime && liveApproach === a.value;
        return (
          <button
            key={a.value}
            type="button"
            onClick={() => onSelect(regime, a.value)}
            aria-pressed={isActive}
            title={isLive ? 'The current read for this symbol and expiration selection' : undefined}
            className="text-left rounded-xl p-3 transition-all"
            style={{
              border: `1px solid ${isActive ? accent : 'var(--color-border)'}`,
              background: isActive
                ? `color-mix(in srgb, ${accent} 12%, transparent)`
                : 'var(--color-surface-subtle)',
              boxShadow: isActive ? `0 0 0 1px ${accent} inset` : 'none',
              opacity: isActive ? 1 : 0.82,
            }}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span style={{ color: accent, display: 'inline-flex' }}>
                {cell.hedging === 'dampens' ? <Magnet size={13} /> : <Zap size={13} />}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {cell.headline}
              </span>
              {/* Where the tape actually is — kept visible even while a manual
                  cell is pinned, so the pin never hides the live read. */}
              {isLive && !isActive && (
                <span
                  className="text-[9px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-0.5"
                  style={{ color: 'var(--color-brand-primary)', border: '1px solid var(--color-brand-primary)' }}
                >
                  Live
                </span>
              )}
            </div>
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{cell.tag}</span>
          </button>
        );
      })}
    </>
  );
}
