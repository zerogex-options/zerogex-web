'use client';

/**
 * RegimeSessionHistory — what every recent session read as, at a glance.
 *
 * One column per trading day, oldest on the left. The bar's height is the
 * shift magnitude, its color and glyph the state, so a month of sessions
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
 * Layout: the strip and the focused session's detail sit side by side so the
 * panel fills its width, rather than the first cut's stack of a short strip
 * over a wide detail bar with empty space either side of both.
 *
 * Color is never the only encoding: each bar carries its state glyph, and
 * every bar is keyboard-reachable with a text summary.
 */

import { useMemo, useState } from 'react';
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
import { Note, PanelHeader, PanelMessage, Zone, toneColor } from './RegimeShiftUI';

const HEADER_TOOLTIP =
  "What each recent session read as. Bar height is the size of that day's shift; color and glyph are the state it landed in. Every bar is normalized against the same window, so they are comparable to each other — a day that reads 2σ here was genuinely twice the move of a day that reads 1σ.";

function stateColor(state: RegimeState): string {
  return toneColor(STATE_META[state].tone);
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

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 border-b py-2 last:border-b-0"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span
        className="font-mono text-[14px] font-semibold tabular-nums"
        style={{ color: color ?? 'var(--text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
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
  const sessions = useMemo(() => [...(payload?.sessions ?? [])].reverse(), [payload]);
  const maxMagnitude = useMemo(
    () => Math.max(1, ...sessions.map((s) => s.magnitude)),
    [sessions],
  );

  const header = (
    <PanelHeader
      title="Session History"
      tooltip={HEADER_TOOLTIP}
      right={
        payload && payload.sessions.length > 0 ? (
          <span className="font-mono text-[12px]" style={{ color: 'var(--text-muted)' }}>
            {payload.sessions.length} sessions
          </span>
        ) : undefined
      }
    />
  );

  if (error) {
    return (
      <div className="zg-panel">
        {header}
        <PanelMessage tone="bear" height={160}>
          {`Couldn’t load the session history: ${error}`}
        </PanelMessage>
      </div>
    );
  }

  if (loading && !payload) {
    return (
      <div className="zg-panel">
        {header}
        <PanelMessage height={160}>Loading session history…</PanelMessage>
      </div>
    );
  }

  if (!payload || sessions.length === 0) {
    return (
      <div className="zg-panel">
        {header}
        <PanelMessage height={160}>
          No stored sessions for {symbol} yet. Reads are written once per session, so this
          strip fills in as they accumulate.
        </PanelMessage>
      </div>
    );
  }

  const shown = active
    ? sessions.find((s) => s.session_date === active) ?? sessions[sessions.length - 1]
    : sessions[sessions.length - 1];
  const shownMeta = STATE_META[shown.state];
  const shownColor = stateColor(shown.state);
  const shownBand =
    shown.band_resolved && shown.band_low != null && shown.band_high != null
      ? formatBand({ low: shown.band_low, high: shown.band_high, share: 1, resolved: true })
      : null;

  return (
    <div className="zg-panel">
      {header}

      <Zone flush>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(260px,320px)]">
          {/* ── the strip ───────────────────────────────────────────────── */}
          <div className="min-w-0">
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-fit items-end gap-1" style={{ height: 168 }}>
                {sessions.map((s) => {
                  const color = stateColor(s.state);
                  const height = Math.max(8, (s.magnitude / maxMagnitude) * 118);
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
                      className="flex w-[28px] shrink-0 flex-col items-center justify-end gap-1.5 rounded transition-opacity"
                      style={{ height: 164, opacity: isActive ? 1 : 0.8 }}
                    >
                      <span className="font-mono text-[12px] leading-none" style={{ color }}>
                        {STATE_META[s.state].glyph}
                      </span>
                      <span
                        className="w-full rounded-t-[3px]"
                        style={{
                          height,
                          background: color,
                          opacity: s.state === 'QUIET' ? 0.42 : 0.92,
                          outline: isActive ? `2px solid ${color}` : 'none',
                          outlineOffset: 2,
                        }}
                      />
                      <span
                        className="font-mono text-[11px] leading-none"
                        style={{
                          color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                          fontWeight: isActive ? 700 : 400,
                        }}
                      >
                        {dayLabel(s.session_date)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12px]"
              style={{ color: 'var(--text-muted)' }}
            >
              {(Object.keys(STATE_META) as RegimeState[]).map((state) => (
                <span key={state} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ background: stateColor(state) }}
                  />
                  <span className="font-mono" style={{ color: stateColor(state) }}>
                    {STATE_META[state].glyph}
                  </span>
                  {STATE_META[state].label}
                </span>
              ))}
            </div>

            {payload.normalization !== 'trailing' && (
              <div className="mt-2.5">
                <Note tone="warning">
                  Fewer than 10 stored sessions, so these bars carry each day’s own
                  normalization rather than a shared one — treat their heights as
                  provisional until the window fills.
                </Note>
              </div>
            )}
          </div>

          {/* ── the focused session ─────────────────────────────────────── */}
          <div
            className="rounded-lg px-4 py-3"
            style={{ background: 'var(--bg-subtle)' }}
          >
            <div className="zg-label mb-1">{weekdayLabel(shown.session_date)}</div>
            <div className="mb-3 text-[22px] font-bold leading-tight" style={{ color: shownColor }}>
              {shownMeta.glyph} {shownMeta.label}
            </div>
            <DetailRow
              label="Magnitude"
              value={`${shown.magnitude.toFixed(1)}σ · ${shown.adverb}`}
              color={shownColor}
            />
            <DetailRow label="Stability" value={formatZ(shown.stability_z)} />
            <DetailRow label="Lean" value={formatZ(shown.lean_z)} />
            {shown.net_shift != null && (
              <DetailRow label="Net shift" value={formatSignedGex(shown.net_shift)} />
            )}
            {shownBand && <DetailRow label="Landed" value={shownBand} />}
            {shown.rolloff_share != null && (
              <DetailRow label="Expired that day" value={formatPercent(shown.rolloff_share)} />
            )}
          </div>
        </div>
      </Zone>
    </div>
  );
}
