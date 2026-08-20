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
 * The output is the classic dealer-mechanics heuristic: in positive gamma the
 * approached wall acts as a magnet and the level holds (pin / bounce); in
 * negative gamma dealer hedging adds fuel and the level tends to break
 * (breakout / breakdown). It is decision-support context, not a signal.
 *
 * The highlighted cell is NOT a default — it is resolved live from the same
 * levels the Gamma Chart is drawing for the symbol and expirations the user has
 * selected (useGammaPlaybook → core/gammaPlaybook), so switching SPY → NDX, or
 * filtering the chain down to 0DTE, moves the read with it. Clicking a cell
 * still pins a manual "what if" read; changing symbol or expirations re-arms
 * the live one, and "Follow the chart" restores it on demand.
 */

import { useState } from 'react';
import { ArrowUp, ArrowDown, Crosshair, Magnet, RotateCcw, Zap } from 'lucide-react';
import ChartCaption from "./ChartCaption";
import { useGammaPlaybook } from "@/hooks/useGammaPlaybook";
import { formatLevel } from "@/core/gammaPlaybook";
import type { ChartSnapshot } from "./GammaTerminalChart";

type Regime = 'positive' | 'negative';
type Approach = 'up' | 'down'; // 'up' → Call Wall, 'down' → Put Wall

interface CellSpec {
  headline: string;
  tag: string;
  outcome: 'hold' | 'break';
  read: string;
  edge: string;
  caution: string;
}

const MATRIX: Record<Regime, Record<Approach, CellSpec>> = {
  positive: {
    up: {
      headline: 'Pin & reject',
      tag: 'Magnet · resistance holds',
      outcome: 'hold',
      read: 'Above the Gamma Flip dealers are long gamma and sell into strength. As price grinds up toward the Call Wall they lean against it, bleeding momentum. The wall behaves like a magnet and a ceiling — price tends to stall and pin just under it, then fade.',
      edge: 'Fade strength into the wall; expect mean-reversion over follow-through.',
      caution: 'A decisive close through the Call Wall flips the read — the pin becomes a breakout.',
    },
    down: {
      headline: 'Bounce & hold',
      tag: 'Magnet · support holds',
      outcome: 'hold',
      read: 'Above the Gamma Flip dealers are long gamma and buy into weakness. As price slips toward the Put Wall they cushion the move. The wall behaves like support — dips get bought and price tends to bounce or pin above it.',
      edge: 'Buy weakness into the wall; expect the level to hold.',
      caution: 'Losing the Put Wall and the Flip tips the tape into the short-gamma, trending regime below.',
    },
  },
  negative: {
    up: {
      headline: 'Breakout & squeeze',
      tag: 'Fuel · level breaks',
      outcome: 'break',
      read: 'Below the Gamma Flip dealers are short gamma and buy as price rises, amplifying the move. The Call Wall is far more likely to give way — a push through it can trigger a gamma squeeze that accelerates higher.',
      edge: 'Trade with momentum; a break of the wall tends to run.',
      caution: 'Reclaiming the Flip restores long-gamma damping and the squeeze fuel fades.',
    },
    down: {
      headline: 'Breakdown & flush',
      tag: 'Fuel · level breaks',
      outcome: 'break',
      read: 'Below the Gamma Flip dealers are short gamma and sell as price falls, amplifying the move. The Put Wall is more likely to break than hold — losing it can accelerate the selloff into a downside gamma flush.',
      edge: 'Respect momentum; a break of the wall tends to extend.',
      caution: 'Reclaiming the Put Wall / Flip re-engages dealer support and can snap price back.',
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

// Fill/accent per outcome: "hold" reads as contained (info), "break" as
// explosive (hot). Direction is carried separately by the arrow glyph so the
// two dimensions stay legible at a glance.
function outcomeAccent(outcome: 'hold' | 'break'): string {
  return outcome === 'hold' ? 'var(--color-info)' : 'var(--color-accent-hot)';
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
  const accent = outcomeAccent(active.outcome);

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
        The matrix returns the classic dealer-hedging expectation for the wall that price is trading against —
        whether it should act as a magnet that holds, or as fuel that breaks. The highlighted cell is read live from the chart
        above for <strong style={{ color: 'var(--text-primary)' }}>{read.symbol}</strong> and the expirations you have
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
                Price is on the far side of that wall — treat the level as the one being retested.
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

      {/* 2×2 matrix */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'auto 1fr 1fr' }}>
        {/* header row */}
        <div />
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
            {active.outcome === 'hold' ? <Magnet size={16} /> : <Zap size={16} />}
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
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-bull)' }}>
              Where the edge is
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>{active.edge}</div>
          </div>
          <div className="rounded-lg p-2.5" style={{ background: 'var(--color-surface-subtle)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-warning)' }}>
              What invalidates it
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>{active.caution}</div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-muted)', marginTop: 14 }}>
        Regime is the modeled sign of dealer gamma at spot (the chart&apos;s LONG/SHORT badge, falling back to spot vs
        the Gamma Flip); the wall in play is whichever of the Call Wall / Put Wall sits nearest spot — all drawn on the
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
      <div className="flex flex-col justify-center pr-2 py-2" style={{ minWidth: 96 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          {regimeLabel}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{regimeSub}</span>
      </div>
      {APPROACHES.map((a) => {
        const cell = MATRIX[regime][a.value];
        const accent = outcomeAccent(cell.outcome);
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
                {cell.outcome === 'hold' ? <Magnet size={13} /> : <Zap size={13} />}
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
