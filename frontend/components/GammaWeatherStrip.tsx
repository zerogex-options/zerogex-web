'use client';

import { useState } from 'react';

import WeatherFieldDrawer from '@/components/WeatherFieldDrawer';
import type { WeatherFieldKey } from '@/core/weatherFields';
import type { GammaWeatherPayload } from '@/hooks/useGammaWeather';
import { useGammaWeatherSeries } from '@/hooks/useGammaWeatherSeries';
import type { HedgingFlowPayload } from '@/hooks/useHedgingFlow';
import type { GammaRegimeSeriesPayload } from '@/hooks/useGammaRegimeSeries';

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

function Chip({
  label,
  value,
  alert,
  field,
  open,
  onToggle,
}: {
  label: string;
  value: string;
  alert?: boolean;
  field?: WeatherFieldKey;
  open?: boolean;
  onToggle?: (field: WeatherFieldKey) => void;
}) {
  const body = (
    <>
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
    </>
  );

  if (!field || !onToggle) {
    return <div className="flex flex-col gap-0.5">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      aria-expanded={open}
      title={`${open ? 'Hide' : 'Show'} this session's ${label.toLowerCase()} chart`}
      className="flex flex-col gap-0.5 rounded-md px-1.5 py-1 text-left transition-colors"
      style={{
        marginLeft: '-0.375rem',
        backgroundColor: open ? 'var(--color-surface-subtle)' : 'transparent',
        boxShadow: open ? 'inset 0 -2px 0 0 var(--color-king)' : undefined,
      }}
    >
      {body}
    </button>
  );
}

export interface GammaWeatherStripProps {
  payload: GammaWeatherPayload;
  /**
   * The two payloads already loaded for the charts below the header. The
   * drawer charts one field from these rather than fetching the same numbers
   * again, so it cannot disagree with the chart further down the page.
   */
  flow?: HedgingFlowPayload | null;
  regime?: GammaRegimeSeriesPayload | null;
  symbol?: string;
}

export default function GammaWeatherStrip({
  payload,
  flow = null,
  regime = null,
  symbol,
}: GammaWeatherStripProps) {
  // One field at a time, per the spec: opening another swaps the drawer,
  // clicking the open one closes it. Five charts at once is the wall of
  // numbers this is meant to replace.
  const [openField, setOpenField] = useState<WeatherFieldKey | null>(null);
  const toggleField = (field: WeatherFieldKey) =>
    setOpenField((current) => (current === field ? null : field));

  // Only while a drawer is open. Most visits never open one, and the header
  // does not need a session of sentences to say what the read is now.
  const { data: series, loading: seriesLoading } = useGammaWeatherSeries(
    symbol ?? payload.symbol,
    openField != null,
  );

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
        {/* The candidate, shown while it waits. Confirmation exists to stop
            the header chasing one-bar noise; showing what is forming anyway
            is what keeps the early read from being thrown away with it. */}
        {payload.pending_label && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: 'var(--color-surface-subtle)',
              color: 'var(--color-text-secondary)',
              border: '1px dashed var(--color-border)',
            }}
            title={`${payload.pending_label} is forming. The header changes once a new state holds ${payload.confirm_bars} completed bars, so it does not chase a single noisy bar.`}
          >
            {payload.pending_label} forming · {payload.pending_bars}/{payload.confirm_bars}
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
          field="pressure"
          open={openField === 'pressure'}
          onToggle={toggleField}
          label="Pressure now"
          value={
            payload.pressure === 'MIXED'
              ? PRESSURE_LABEL.MIXED
              : `${PRESSURE_LABEL[payload.pressure] ?? payload.pressure} · ${
                  payload.persistence_label ?? payload.persistence
                }`
          }
        />
        <Chip
          field="lean"
          open={openField === 'lean'}
          onToggle={toggleField}
          label="Lean"
          value={payload.lean_side ? LEAN_LABEL[payload.lean_side] : '—'}
        />
        <Chip
          field="stability"
          open={openField === 'stability'}
          onToggle={toggleField}
          label="Stability"
          value={STRUCTURE_LABEL[payload.structure] ?? payload.structure}
        />
        <Chip
          field="gamma_trend"
          open={openField === 'gamma_trend'}
          onToggle={toggleField}
          label="Gamma trend"
          value={TREND_LABEL[payload.gamma_trend] ?? payload.gamma_trend}
        />
        <Chip
          field="cushion"
          open={openField === 'cushion'}
          onToggle={toggleField}
          label="Flip cushion"
          value={cushionValue}
          alert={transitionRisk}
        />
      </div>

      {payload.cushion_summary && (
        <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          {payload.cushion_summary}
        </p>
      )}

      {/* Under the header, not a jump to another page. The header above stays
          the live read; this is the audit trail and never changes a state. */}
      {openField && (
        <WeatherFieldDrawer
          field={openField}
          flow={flow}
          regime={regime}
          series={series}
          loading={seriesLoading}
          onClose={() => setOpenField(null)}
        />
      )}
    </section>
  );
}
