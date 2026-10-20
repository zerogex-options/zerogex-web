'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  LIGHT_ROWS,
  axisFraction,
  formatDuration,
  hasLightData,
  hourTicks,
  lightTimeline,
  type LightBar,
  type LightKey,
  type LightRun,
} from '@/core/lightHistory';
import { safeTimeLabel } from '@/core/flowSeriesCharts';

/**
 * The Light history, under the four-light strip. Barrie's ask: four rows on
 * one session clock, a segment wherever a light was on, so a reader can see
 * when each light came on, how long it held, and whether it has been
 * switching, which can mean something is building in one direction.
 *
 * Collapsed by default. The strip is the glance; this is the second look, and
 * an always-open history would put four more rows between the reading and the
 * chips it summarizes.
 *
 * Lit uses the strip's own --color-scan-lit, not the site's directional green,
 * for the strip's reason: a bullish green on a row called Fragile would say
 * something these lights must never say. OFF is the bare track.
 */

const ISO = (ms: number) => new Date(ms).toISOString();

/** Which segment is under the cursor, by its start: the run itself is rebuilt
 *  as the clock moves, and an open light's duration should keep counting. */
interface Hovered {
  key: LightKey;
  start: number;
}

/** "Today" for today's session, else its date, in ET either way. */
function sessionName(from: number, now: number): string {
  const day = (ms: number) =>
    new Date(ms).toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
    });
  return day(from) === day(now) ? 'Today' : day(from);
}

function describe(label: string, run: LightRun): string {
  const start = safeTimeLabel(ISO(run.start));
  if (run.active) {
    return `${label} · on since ${start} · ${formatDuration(run.end - run.start)} so far`;
  }
  const end = safeTimeLabel(ISO(run.end));
  return `${label} · ${start}–${end} · ${formatDuration(run.end - run.start)}`;
}

export interface LightHistoryProps {
  bars: LightBar[] | null | undefined;
  loading?: boolean;
  open: boolean;
  onToggle: () => void;
  /** False on a dated page, which is always a finished session. */
  allowLive?: boolean;
}

export default function LightHistory({
  bars,
  loading = false,
  open,
  onToggle,
  allowLive = true,
}: LightHistoryProps) {
  // The clock moves between polls, so an open light's "so far" and the Now
  // edge keep up rather than freezing at the last fetch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    // Reopening after a while starts from the real time, not the last tick.
    const kick = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, [open]);

  const timeline = useMemo(
    () => (bars && hasLightData(bars) ? lightTimeline(bars, now, allowLive) : null),
    [bars, now, allowLive],
  );
  const [hovered, setHovered] = useState<Hovered | null>(null);

  // An hour label too close to the right edge would sit on top of "Now".
  const ticks = timeline
    ? hourTicks(timeline.from, timeline.to).filter(
        (t) => axisFraction(t, timeline.from, timeline.to) < 0.9,
      )
    : [];
  const label = (key: LightKey) => LIGHT_ROWS.find((r) => r.key === key)?.label ?? key;
  const hoveredRun = hovered
    ? (timeline?.runs[hovered.key].find((r) => r.start === hovered.start) ?? null)
    : null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] font-medium max-sm:min-h-8"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <span aria-hidden className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>
          ▸
        </span>
        Light history — {timeline ? sessionName(timeline.from, now) : 'Today'}
      </button>

      {open && (
        <div
          className="mt-1.5 rounded-lg border px-3 py-2.5"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface-subtle)',
          }}
        >
          {!timeline ? (
            <p className="py-2 text-xs italic" style={{ color: 'var(--color-text-secondary)' }}>
              {loading ? 'Loading this session…' : 'No light history for this session yet.'}
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {LIGHT_ROWS.map(({ key, label: rowLabel }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span
                      className="w-[4.75rem] shrink-0 whitespace-nowrap text-[11px] sm:w-20"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {rowLabel}
                    </span>
                    <div className="relative h-3 flex-1" role="group" aria-label={`${rowLabel} history`}>
                      {/* OFF is the bare track: present, so the row reads as a
                          measured "no" rather than a missing one. */}
                      <div
                        aria-hidden
                        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
                        style={{ backgroundColor: 'var(--color-border)' }}
                      />
                      {timeline.runs[key].map((run) => {
                        const left = axisFraction(run.start, timeline.from, timeline.to) * 100;
                        const right = axisFraction(run.end, timeline.from, timeline.to) * 100;
                        const text = describe(rowLabel, run);
                        const isHovered = hovered?.key === key && hovered.start === run.start;
                        return (
                          <button
                            key={run.start}
                            type="button"
                            aria-label={text}
                            onMouseEnter={() => setHovered({ key, start: run.start })}
                            onMouseLeave={() => setHovered(null)}
                            onFocus={() => setHovered({ key, start: run.start })}
                            onBlur={() => setHovered(null)}
                            // A tap has no hover, so it toggles the readout.
                            onClick={() => setHovered(isHovered ? null : { key, start: run.start })}
                            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                            style={{
                              left: `${left}%`,
                              width: `max(3px, ${right - left}%)`,
                              backgroundColor: 'var(--color-scan-lit)',
                              outline: isHovered ? '2px solid var(--color-scan-lit-soft)' : undefined,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* The clock, aligned to the tracks above it: same label gutter. */}
              <div className="mt-1.5 flex items-center gap-3">
                <span aria-hidden className="w-[4.75rem] shrink-0 sm:w-20" />
                <div className="relative h-4 flex-1 text-[10px] tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                  {ticks.map((t) => (
                    <span
                      key={t}
                      className="absolute -translate-x-1/2"
                      style={{ left: `${axisFraction(t, timeline.from, timeline.to) * 100}%` }}
                    >
                      {safeTimeLabel(ISO(t))}
                    </span>
                  ))}
                  <span className="absolute right-0">
                    {timeline.live ? 'Now' : safeTimeLabel(ISO(timeline.to))}
                  </span>
                </div>
              </div>

              <p
                className="mt-1.5 min-h-4 text-[11px]"
                style={{ color: hoveredRun ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                aria-live="polite"
              >
                {hovered && hoveredRun
                  ? describe(label(hovered.key), hoveredRun)
                  : 'Hover a segment for when it came on, when it went off, and how long it held.'}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
