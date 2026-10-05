'use client';

import { useState } from 'react';

import WeatherFieldDrawer from '@/components/WeatherFieldDrawer';
import WeatherFieldStack from '@/components/WeatherFieldStack';
import { cushionPoints, type WeatherFieldKey } from '@/core/weatherFields';
import { weatherStateColor } from '@/core/weatherStateColors';
import type { GammaWeatherPayload } from '@/hooks/useGammaWeather';
import { useGammaWeatherSeries } from '@/hooks/useGammaWeatherSeries';
import { usePersistedFlag } from '@/hooks/usePersistedFlag';
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
 * Color carries CONDITION, not direction: one color per Weather state (see
 * core/weatherStateColors), never buying-green against selling-red. The spec
 * is explicit that this classifies market health rather than calling
 * direction, so no color here stands for a side of the tape.
 */


// The banner used to group the five states into three tones, which meant
// Stable bid and Supported dip shared a color and so did Fragile rally and
// Unstable. Once the drawers color a line by state, three here against five
// there would have the two halves of the page disagreeing about what a color
// means, which is worse than no color at all. One palette now, in
// core/weatherStateColors.

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
  stacked = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
  field?: WeatherFieldKey;
  open?: boolean;
  onToggle?: (field: WeatherFieldKey) => void;
  /** Stacked: every chart is already drawn, so the chip jumps rather than opens. */
  stacked?: boolean;
}) {
  const body = (
    <span className="flex min-w-0 flex-col gap-0.5">
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
    </span>
  );

  // A non-expandable field keeps the same box metrics behind a transparent
  // border, so one plain field in the row cannot knock the others out of line.
  if (!field || !onToggle) {
    return (
      <div className="flex items-center rounded-lg border border-transparent px-2.5 py-1.5">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      // aria-expanded only where the chip actually expands something. Stacked,
      // all five charts are already on screen and the chip scrolls to one, so
      // announcing it as collapsed would be a lie to a screen reader.
      {...(stacked ? {} : { 'aria-expanded': open })}
      title={
        stacked
          ? `Jump to this session's ${label.toLowerCase()} chart`
          : `${open ? 'Hide' : 'Show'} this session's ${label.toLowerCase()} chart`
      }
      // Classes, not an inline style: an inline borderColor outranks the
      // stylesheet, so setting the resting border that way silently disables
      // the hover state it is supposed to sit under.
      //
      // No focus ring here. globals.css already puts one on every button in
      // the app, and a local outline-none would have turned it off for the
      // keyboard readers it exists for.
      className={[
        'group flex cursor-pointer items-center justify-between gap-2 rounded-lg border',
        'px-2.5 py-1.5 text-left transition-colors',
        open
          ? 'border-[var(--color-king)] bg-[var(--color-king-soft)]'
          : [
              'border-[var(--color-border)] bg-transparent',
              'hover:border-[var(--color-king)] hover:bg-[var(--color-king-soft)]',
            ].join(' '),
      ].join(' ')}
    >
      {body}
      <Chevron open={open} />
    </button>
  );
}

/**
 * The affordance. A bordered box says "control" and the caret says "this one
 * opens", which between them are the only two things a reader who has not been
 * told about the drawer has to go on: the row used to be plain text with an
 * accent appearing only on the field already open, so nothing on a closed
 * field said it could be clicked at all.
 *
 * Rotates rather than swapping glyphs, so the open state is the same mark
 * turned over and reads as one control in two positions.
 */
function Chevron({ open }: { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 10 6"
      width="10"
      height="6"
      aria-hidden
      focusable="false"
      className={[
        'shrink-0 transition-transform duration-150',
        open
          ? 'rotate-180 text-[var(--color-king)]'
          : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-king)]',
      ].join(' ')}
    >
      <path
        d="M1 1l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
  /** Set on a dated page so the drawer narrates that session, not today. */
  date?: string | null;
}

export default function GammaWeatherStrip({
  payload,
  flow = null,
  regime = null,
  symbol,
  date = null,
}: GammaWeatherStripProps) {
  // Stacked by default. One chart at a time was the right shape while the
  // drawer was being proved and the wrong one for the job it grew into, which
  // is scanning a session rather than interrogating a field. The toggle stays
  // because reading one line closely is still a thing people do.
  //
  // usePersistedFlag rather than useState + localStorage: the server has no
  // storage, so seeding state from it is a hydration mismatch on every load
  // for anyone who has changed the setting.
  const [stacked, toggleStacked] = usePersistedFlag('gammaWeatherStacked', true);

  // In one-at-a-time mode this is the open drawer. In stacked mode every chart
  // is already drawn, so it is which one the reader asked to look at: that
  // chart is scrolled to and the rest dim.
  const [openField, setOpenField] = useState<WeatherFieldKey | null>(null);
  // Set the first time a drawer is opened and never cleared, so the hint below
  // retires itself once the reader has demonstrated they no longer need it.
  const [hasOpened, setHasOpened] = useState(false);
  const toggleField = (field: WeatherFieldKey) => {
    setHasOpened(true);
    setOpenField((current) => (current === field ? null : field));
    if (stacked) {
      // The charts are all on screen already; the chip's job is to take the
      // reader to one. Deferred a frame so a chart that has just been
      // un-dimmed is measured at its final position.
      requestAnimationFrame(() => {
        document
          .getElementById(`weather-chart-${field}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  };

  // Stacked mode always needs the trail, because all five strips are showing.
  // One at a time needs it only once a drawer is open, and most visits never
  // open one.
  const { data: series, loading: seriesLoading } = useGammaWeatherSeries(
    symbol ?? payload.symbol,
    { enabled: stacked || openField != null, date },
  );

  const color = weatherStateColor(payload.state);
  const transitionRisk = payload.cushion === 'TRANSITION_RISK';

  const cushionValue = payload.components.cushion_pts != null
    ? `${cushionPoints(payload.components.cushion_pts)} pts · ${CUSHION_LABEL[payload.cushion] ?? payload.cushion}`
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
            // Elapsed time, and nothing more. The old wording here promised
            // the opposite of what 42 sessions measured: survival of the next
            // 30 minutes falls 29.9% / 23.8% / 20.3% / 11.1% across the four
            // rungs, so the oldest state is the least likely to last.
            title="How long this state has held. Older states have been less likely to last another half hour, not more, so read this as elapsed time rather than confirmation."
          >
            {/* Falls back to the raw code only for a deploy skew: this panel
                can ship before the API that serves the wording, and a blank
                or `undefined` in the header is worse than FRESH. */}
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
            title={`${payload.pending_label} is forming. The header changes once a new state holds ${payload.confirm_bars} bars in a row, counting the one still filling, so it does not chase a single noisy bar.`}
          >
            {payload.pending_label} forming · {payload.pending_bars}/{payload.confirm_bars}
          </span>
        )}
        {/* Only for a genuine reversal: an established side giving way while
            it is still established. A fresh pulse on the other side gets no
            chip, which is what keeps this one worth looking at. */}
        {payload.pressure_reversing_bars > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: 'var(--color-surface-subtle)',
              color: 'var(--color-text-secondary)',
              border: '1px dashed var(--color-border)',
            }}
            title={`The established pressure side is giving way. Confirms once the opposite side holds ${payload.confirm_bars} bars, counting the one still filling.`}
          >
            Pressure reversing · {payload.pressure_reversing_bars}/{payload.confirm_bars}
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

      {/* Tighter than the plain text row it replaces: five bordered boxes six
          rems apart read as five unrelated cards, and they are one control
          set. */}
      <div
        className="mt-3 grid grid-cols-2 gap-x-2 gap-y-2 border-t pt-3 sm:grid-cols-3 lg:grid-cols-5"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {/* "now", because the metric card below reads Session pressure and the
            two legitimately disagree: a session can be cumulatively buying
            while this bar sells. Without the qualifier that looks like a bug. */}
        <Chip
          field="pressure"
          open={openField === 'pressure'}
          onToggle={toggleField}
          stacked={stacked}
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
          stacked={stacked}
          label="Lean"
          value={payload.lean_side ? LEAN_LABEL[payload.lean_side] : '—'}
        />
        <Chip
          field="stability"
          open={openField === 'stability'}
          onToggle={toggleField}
          stacked={stacked}
          label="Stability"
          value={STRUCTURE_LABEL[payload.structure] ?? payload.structure}
        />
        <Chip
          field="gamma_trend"
          open={openField === 'gamma_trend'}
          onToggle={toggleField}
          stacked={stacked}
          label="Gamma trend"
          value={TREND_LABEL[payload.gamma_trend] ?? payload.gamma_trend}
        />
        <Chip
          field="cushion"
          open={openField === 'cushion'}
          onToggle={toggleField}
          stacked={stacked}
          label="Flip cushion"
          value={cushionValue}
          alert={transitionRisk}
        />
      </div>

      <div className="mt-2 flex items-center justify-end">
        <button
          type="button"
          onClick={toggleStacked}
          className="rounded px-2 py-1 text-[11px] underline-offset-2 hover:underline max-sm:min-h-8"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {stacked ? 'Show one at a time' : 'Stack all five'}
        </button>
      </div>

      {/* Says out loud what the boxes imply, then gets out of the way. Someone
          who has opened a field knows the row is clickable and does not need
          telling again, so the line goes for the rest of the visit rather than
          returning every time a drawer is closed. Deliberately not stored: a
          reader who comes back tomorrow gets told once more, which costs one
          line and is cheaper than a returning reader who never finds the
          feature because a flag said they already had. */}
      {!stacked && !hasOpened && (
        <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          Each field above opens a chart of this session.
        </p>
      )}

      {payload.cushion_summary && (
        <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          {payload.cushion_summary}
        </p>
      )}

      {/* Under the header, not a jump to another page. The header above stays
          the live read; this is the audit trail and never changes a state. */}
      {stacked ? (
        <WeatherFieldStack
          flow={flow}
          regime={regime}
          series={series}
          loading={seriesLoading}
          focus={openField}
        />
      ) : (
        openField && (
          <WeatherFieldDrawer
            field={openField}
            flow={flow}
            regime={regime}
            series={series}
            loading={seriesLoading}
            onClose={() => setOpenField(null)}
          />
        )
      )}
    </section>
  );
}
