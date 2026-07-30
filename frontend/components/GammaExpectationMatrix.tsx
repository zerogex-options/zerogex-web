'use client';

/**
 * GammaExpectationMatrix — the "where do we expect the underlying to go" read.
 *
 * A deliberately simple 2×2 decision matrix that turns two inputs a trader can
 * read straight off the Gamma Chart into a plain-language expectation for how
 * price behaves at the nearest wall:
 *
 *   • Gamma Regime  — Positive (spot above the Gamma Flip, dealers long gamma,
 *                     pinning) vs Negative (spot below the flip, dealers short
 *                     gamma, trending).
 *   • Approach      — price rising toward the Call Wall vs falling toward the
 *                     Put Wall.
 *
 * The output is the classic dealer-mechanics heuristic: in positive gamma the
 * approached wall acts as a magnet and the level holds (pin / bounce); in
 * negative gamma dealer hedging adds fuel and the level tends to break
 * (breakout / breakdown). Inputs drive the highlighted cell; clicking a cell
 * sets the inputs. It is decision-support context, not a signal.
 */

import { useState } from 'react';
import { ArrowUp, ArrowDown, Magnet, Zap } from 'lucide-react';

type Regime = 'positive' | 'negative';
type Approach = 'up' | 'down'; // 'up' → toward Call Wall, 'down' → toward Put Wall

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
  { value: 'positive', label: 'Positive γ', sub: 'Above flip · pinning' },
  { value: 'negative', label: 'Negative γ', sub: 'Below flip · trending' },
];

const APPROACHES: Array<{ value: Approach; label: string; icon: React.ReactNode }> = [
  { value: 'up', label: 'Up → Call Wall', icon: <ArrowUp size={13} /> },
  { value: 'down', label: 'Down → Put Wall', icon: <ArrowDown size={13} /> },
];

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
  initialRegime = 'positive',
  initialApproach = 'up',
  className = '',
}: {
  initialRegime?: Regime;
  initialApproach?: Approach;
  className?: string;
}) {
  const [regime, setRegime] = useState<Regime>(initialRegime);
  const [approach, setApproach] = useState<Approach>(initialApproach);

  const active = MATRIX[regime][approach];
  const accent = outcomeAccent(active.outcome);

  return (
    <section className={`zg-feature-shell p-5 sm:p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="zg-eyebrow" style={{ color: 'var(--color-brand-primary)' }}>
          Playbook
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
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: 720, marginBottom: 18 }}>
        Pick the current gamma regime and which wall price is approaching. The matrix returns the classic
        dealer-hedging expectation for that level — whether it should act as a magnet that holds, or as fuel that
        breaks.
      </p>

      {/* Inputs */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 mb-5">
        <div className="flex flex-col gap-1.5">
          <span className="zg-eyebrow" style={{ fontSize: 10 }}>Gamma Regime</span>
          <Segmented options={REGIMES} value={regime} onChange={setRegime} ariaLabel="Gamma regime" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="zg-eyebrow" style={{ fontSize: 10 }}>Approach</span>
          <Segmented options={APPROACHES} value={approach} onChange={setApproach} ariaLabel="Price approach" />
        </div>
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
            onSelect={(reg, app) => {
              setRegime(reg);
              setApproach(app);
            }}
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
        Regime is read from spot vs the Gamma Flip; the approached wall is the Call Wall above / Put Wall below — all
        drawn on the chart. This is a simplified dealer-hedging heuristic and decision-support context, not a
        guarantee of price behavior or investment advice.
      </p>
    </section>
  );
}

function RowFragment({
  regime,
  regimeLabel,
  regimeSub,
  activeRegime,
  activeApproach,
  onSelect,
}: {
  regime: Regime;
  regimeLabel: string;
  regimeSub: string;
  activeRegime: Regime;
  activeApproach: Approach;
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
        return (
          <button
            key={a.value}
            type="button"
            onClick={() => onSelect(regime, a.value)}
            aria-pressed={isActive}
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
            </div>
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{cell.tag}</span>
          </button>
        );
      })}
    </>
  );
}
