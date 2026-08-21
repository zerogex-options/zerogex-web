'use client';

/**
 * RegimeSessionHistory — what every recent session read as, at a glance.
 *
 * One column per trading day, newest on the right. The bar's height is the
 * shift magnitude, its colour and glyph the state, so a month of sessions
 * answers questions a single day's card cannot: is this a persistently
 * capping tape, or did today break a run of quiet? Have we been shortening
 * gamma all week?
 *
 * The z-scores are recomputed server-side against ONE shared window before
 * they get here (see ``/api/gex/regime-history``). Rows written on different
 * days were originally normalized against different window sizes, and
 * rendering those side by side would put bars on screen that are not
 * comparable to each other — the one thing a history strip exists to make
 * possible.
 *
 * Colour is never the only encoding: each bar carries its state glyph, and
 * every bar is keyboard-reachable with a text summary.
 */

import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import {
  STATE_META,
  formatBand,
  formatPercent,
  formatSignedGex,
  formatZ,
  type RegimeHistoryPayload,
  type RegimeHistorySession,
  type RegimeState,
} from '@/core/regimeShift';
import ChartCaption from './ChartCaption';
import TooltipWrapper from './TooltipWrapper';

function toneColor(state: RegimeState): string {
  switch (STATE_META[state].tone) {
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

function dayLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return iso;
  }
}

function weekdayLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return iso;
  }
}

/** The one-line summary shown on hover/focus and read out by screen readers. */
function summarize(s: RegimeHistorySession): string {
  const meta = STATE_META[s.state];
  const band = formatBand(
    s.band_low != null && s.band_high != null
      ? { low: s.band_low, high: s.band_high, share: 1, resolved: s.band_resolved }
      : null,
  );
  const parts = [
    `${weekdayLabel(s.session_date)}: ${meta.label.toLowerCase()}`,
    `${meta.stability}, ${meta.direction}`,
    `${s.magnitude.toFixed(1)}σ`,
  ];
  if (band) parts.push(`concentrated ${band}`);
  if (s.rolloff_share != null) parts.push(`${formatPercent(s.rolloff_share)} expired`);
  return parts.join(' · ');
}

export default function RegimeSessionHistory({
  payload,
  loading,
  error,
  symbol,
}: {
  payload: RegimeHistoryPayload | null;
  loading: boolean;
  error: string | null;
  symbol: string;
}) {
  const [active, setActive] = useState<string | null>(null);

  // The API returns newest-first (natural for a list); a strip reads
  // left-to-right through time, so reverse for display only.
  const sessions = useMemo(
    () => [...(payload?.sessions ?? [])].reverse(),
    [payload],
  );
  const maxMagnitude = useMemo(
    () => Math.max(1, ...sessions.map((s) => s.magnitude)),
    [sessions],
  );

  const heading = (
    <div className="flex flex-wrap items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
      <h3 className="zg-h3" style={{ color: 'var(--text-primary)' }}>
        Session History
      </h3>
      <TooltipWrapper text="What each recent session read as. Bar height is the size of that day's shift; colour and glyph are the state it landed in. Every bar is normalized against the same window, so they are comparable to each other — a day that reads 2σ here was genuinely twice the move of a day that reads 1σ.">
        <Info size={14} />
      </TooltipWrapper>
      <span
        className="rounded px-1.5 py-0.5 font-mono text-xs font-semibold"
        style={{ color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}
      >
        {symbol}
      </span>
      {payload && payload.sessions.length > 0 && (
        <span className="ml-auto font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {payload.sessions.length} sessions
        </span>
      )}
    </div>
  );

  if (error) {
    return (
      <div className="zg-panel p-5">
        {heading}
        <div className="flex h-[160px] items-center justify-center px-6 text-center text-sm" style={{ color: 'var(--color-bear)' }}>
          {`Couldn’t load the session history: ${error}`}
        </div>
      </div>
    );
  }

  if (loading && !payload) {
    return (
      <div className="zg-panel p-5">
        {heading}
        <div className="flex h-[160px] items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading session history…
        </div>
      </div>
    );
  }

  if (!payload || sessions.length === 0) {
    return (
      <div className="zg-panel p-5">
        {heading}
        <div className="flex h-[160px] flex-col items-center justify-center gap-2 px-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          <p className="max-w-md">
            No stored sessions for {symbol} yet. Reads are written once per session, so
            this strip fills in as they accumulate.
          </p>
        </div>
      </div>
    );
  }

  const shown = active
    ? sessions.find((s) => s.session_date === active) ?? sessions[sessions.length - 1]
    : sessions[sessions.length - 1];

  return (
    <div className="zg-panel p-5">
      {heading}

      <div className="mt-4 overflow-x-auto">
        <div className="flex min-w-fit items-end gap-[3px]" style={{ height: 132 }}>
          {sessions.map((s) => {
            const color = toneColor(s.state);
            const height = Math.max(6, (s.magnitude / maxMagnitude) * 96);
            const isActive = shown.session_date === s.session_date;
            return (
              <button
                key={s.session_date}
                type="button"
                onMouseEnter={() => setActive(s.session_date)}
                onFocus={() => setActive(s.session_date)}
                onClick={() => setActive(s.session_date)}
                aria-label={summarize(s)}
                title={summarize(s)}
                className="flex w-[22px] shrink-0 flex-col items-center justify-end gap-1 rounded transition-opacity"
                style={{ height: 128, opacity: isActive ? 1 : 0.82 }}
              >
                <span className="font-mono text-[9px] leading-none" style={{ color }}>
                  {STATE_META[s.state].glyph}
                </span>
                <span
                  className="w-full rounded-t-[2px]"
                  style={{
                    height,
                    background: color,
                    opacity: s.state === 'QUIET' ? 0.4 : 0.92,
                    outline: isActive ? `1px solid ${color}` : 'none',
                    outlineOffset: 2,
                  }}
                />
                <span
                  className="font-mono text-[8.5px] leading-none"
                  style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  {dayLabel(s.session_date)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* detail for the focused session */}
      <div
        className="mt-3 rounded-xl px-4 py-3"
        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {weekdayLabel(shown.session_date)}
          </span>
          <span className="text-sm font-bold" style={{ color: toneColor(shown.state) }}>
            {STATE_META[shown.state].glyph} {STATE_META[shown.state].label}
          </span>
          <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {shown.magnitude.toFixed(1)}σ · {shown.adverb}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span>
            stability <strong style={{ color: 'var(--text-secondary)' }}>{formatZ(shown.stability_z)}</strong>
          </span>
          <span>
            lean <strong style={{ color: 'var(--text-secondary)' }}>{formatZ(shown.lean_z)}</strong>
          </span>
          {shown.net_shift != null && (
            <span>
              net shift <strong style={{ color: 'var(--text-secondary)' }}>{formatSignedGex(shown.net_shift)}</strong>
            </span>
          )}
          {shown.band_resolved && shown.band_low != null && shown.band_high != null && (
            <span>
              landed{' '}
              <strong style={{ color: 'var(--text-secondary)' }}>
                {formatBand({ low: shown.band_low, high: shown.band_high, share: 1, resolved: true })}
              </strong>
            </span>
          )}
          {shown.rolloff_share != null && (
            <span>
              expired that day{' '}
              <strong style={{ color: 'var(--text-secondary)' }}>{formatPercent(shown.rolloff_share)}</strong>
            </span>
          )}
        </div>
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {(Object.keys(STATE_META) as RegimeState[]).map((state) => (
          <span key={state} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: toneColor(state) }} />
            <span className="font-mono" style={{ color: toneColor(state) }}>
              {STATE_META[state].glyph}
            </span>
            {STATE_META[state].label}
          </span>
        ))}
      </div>

      {payload.normalization !== 'trailing' && (
        <p className="mt-2.5 text-[11px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
          Fewer than 10 stored sessions, so these bars carry each day’s own
          normalization rather than a shared one — treat their heights as
          provisional until the window fills.
        </p>
      )}

      <ChartCaption />
    </div>
  );
}
