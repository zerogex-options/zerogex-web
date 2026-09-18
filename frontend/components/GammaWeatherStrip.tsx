'use client';

import type { GammaWeatherPayload } from '@/hooks/useGammaWeather';

/**
 * Gamma Weather: the combined read, as a compact strip above the charts.
 *
 * The brief was less mental assembly, not another stack of indicators, so
 * this is deliberately a strip and not a panel. One headline, one sentence,
 * and a row of the components that produced them. The charts stay directly
 * below, which is the whole point: the strip is a claim and the charts are
 * the evidence, and a reader can check one against the other without
 * leaving the page.
 *
 * Color carries CONDITION, not direction. Settled states take the pinning
 * teal and fragile ones take caution amber; nothing is green or red. A
 * red "Unstable" would read as a sell instruction, which is exactly what
 * this is not, and the spec is explicit that it classifies market health
 * rather than calling direction.
 */

type Tone = 'settled' | 'fragile' | 'neutral';

const STATE_TONE: Record<string, Tone> = {
  STABLE_BID: 'settled',
  SUPPORTED_DIP: 'settled',
  FRAGILE_RALLY: 'fragile',
  UNSTABLE: 'fragile',
  MIXED: 'neutral',
};

const TONE_COLOR: Record<Tone, string> = {
  settled: 'var(--color-pin)',
  fragile: 'var(--color-warning)',
  neutral: 'var(--color-text-secondary)',
};

const PRESSURE_LABEL: Record<string, string> = {
  BUYING: 'Buying',
  SELLING: 'Selling',
  MIXED: 'Mixed',
};

/** Structure and gamma trend share a classification but not a vocabulary:
 *  the spec says pinning/accelerative for one and building/thinning for the
 *  other, and those words are how a trader distinguishes them. */
const STRUCTURE_LABEL: Record<string, string> = {
  PINNING: 'Pinning',
  ACCELERATIVE: 'Accelerative',
  FLAT: 'Flat',
};

const TREND_LABEL: Record<string, string> = {
  PINNING: 'Building',
  ACCELERATIVE: 'Thinning',
  FLAT: 'Flat',
};

const LEAN_LABEL: Record<string, string> = {
  SUPPORTIVE: 'Supportive',
  CAPPING: 'Capping',
};

const CUSHION_LABEL: Record<string, string> = {
  TRANSITION_RISK: 'Thin and closing',
  NARROWING: 'Narrowing',
  WIDENING: 'Widening',
  STEADY: 'Steady',
  NONE: 'No flip',
};

function Chip({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-[10px] uppercase tracking-wide"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
      <span
        className="text-xs font-semibold"
        style={{ color: alert ? 'var(--color-warning)' : 'var(--color-text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}

export interface GammaWeatherStripProps {
  payload: GammaWeatherPayload;
}

export default function GammaWeatherStrip({ payload }: GammaWeatherStripProps) {
  const tone = STATE_TONE[payload.state] ?? 'neutral';
  const color = TONE_COLOR[tone];
  const transitionRisk = payload.cushion === 'TRANSITION_RISK';

  const cushionValue = payload.components.cushion_pts != null
    ? `${payload.components.cushion_pts.toFixed(0)} pts · ${CUSHION_LABEL[payload.cushion] ?? payload.cushion}`
    : (CUSHION_LABEL[payload.cushion] ?? payload.cushion);

  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        borderColor: transitionRisk ? 'var(--color-warning)' : 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
      aria-label="Gamma Weather"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className="text-[10px] uppercase tracking-widest"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Gamma Weather
        </span>
        <span className="text-lg font-bold" style={{ color }}>
          {payload.label}
        </span>
        {payload.age_label && (
          <span
            className="text-xs font-medium tabular-nums"
            style={{ color: 'var(--color-text-secondary)' }}
            title="How long this state has held. The question is not whether gamma calls direction, but whether a condition that exists is healthy enough to persist."
          >
            {/* Falls back to the raw code only for a deploy skew: this panel
                can ship before the API that serves the wording, and a blank
                or `undefined` in the header is worse than NEW. */}
            {payload.age_label ?? payload.age}
            {payload.age_minutes != null && ` ${Math.round(payload.age_minutes)}m`}
          </span>
        )}
        {transitionRisk && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: 'var(--color-warning-soft)',
              color: 'var(--color-warning)',
            }}
          >
            Transition risk
          </span>
        )}
      </div>

      <p className="mt-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>
        {payload.sentence}
      </p>

      <div
        className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-3 sm:grid-cols-3 lg:grid-cols-5"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {/* "now", because the metric card below reads Session pressure and the
            two legitimately disagree: a session can be cumulatively buying
            while this bar sells. Without the qualifier that looks like a bug. */}
        <Chip
          label="Pressure now"
          value={
            payload.pressure === 'MIXED'
              ? PRESSURE_LABEL.MIXED
              : `${PRESSURE_LABEL[payload.pressure] ?? payload.pressure} · ${
                  payload.persistence_label ?? payload.persistence
                }`
          }
        />
        <Chip label="Lean" value={payload.lean_side ? LEAN_LABEL[payload.lean_side] : '—'} />
        <Chip label="Stability" value={STRUCTURE_LABEL[payload.structure] ?? payload.structure} />
        <Chip label="Gamma trend" value={TREND_LABEL[payload.gamma_trend] ?? payload.gamma_trend} />
        <Chip label="Flip cushion" value={cushionValue} alert={transitionRisk} />
      </div>

      {payload.cushion_summary && (
        <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          {payload.cushion_summary}
        </p>
      )}
    </section>
  );
}
