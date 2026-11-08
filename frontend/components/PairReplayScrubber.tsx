"use client";

/**
 * PairReplayScrubber — the transport bar under the two gamma ladders. In LIVE
 * mode it's a slim status strip with a "Replay session" entry point; in REPLAY
 * mode it's a full player (session menu, play/pause, step, playhead, speed).
 * Replay opens on the newest session and the menu picks an earlier one; both
 * columns always replay the same day. It is presentational: the page owns the
 * session, cursor / isPlaying / speed / mode and the auto-advance loop, so a
 * single playhead drives BOTH columns in lockstep.
 */

import { ChevronDown, History, Pause, Play, Repeat, SkipBack, SkipForward } from "lucide-react";
import { STRIKE_RETENTION_DAYS } from "@/core/pairReplaySessions";

const SPEEDS = [1, 2, 4, 8, 16] as const;

function fmtTime(iso: string | null): string {
  if (!iso) return "--:--";
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/New_York",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "--:--";
  }
}

function fmtDate(date: string | null): string {
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00Z`));
  } catch {
    return date;
  }
}

interface Props {
  mode: "live" | "replay";
  onEnterReplay: () => void;
  onExitReplay: () => void;
  frameCount: number;
  cursor: number;
  onScrub: (i: number) => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onStep: (delta: number) => void;
  loop: boolean;
  onLoopToggle: () => void;
  speed: number;
  onSpeedChange: (s: number) => void;
  cursorTime: string | null;
  startTime: string | null;
  endTime: string | null;
  /** The day both columns replay (YYYY-MM-DD), once one is known. */
  sessionDate: string | null;
  /** Days the session menu offers, newest first (core/pairReplaySessions). */
  sessionDates: readonly string[];
  onSessionChange: (date: string) => void;
  /** Today's ET date key, to mark an in-progress session in the menu. */
  todayKey: string;
  isToday: boolean;
  /** Symbols whose ladder has no strike rows on this day (pruned or never
   *  written), named in a note so an empty ladder isn't read as a quiet book. */
  missingStrikes: readonly string[];
  loading: boolean;
  error: string | null;
}

export default function PairReplayScrubber({
  mode,
  onEnterReplay,
  onExitReplay,
  frameCount,
  cursor,
  onScrub,
  isPlaying,
  onPlayToggle,
  onStep,
  loop,
  onLoopToggle,
  speed,
  onSpeedChange,
  cursorTime,
  startTime,
  endTime,
  sessionDate,
  sessionDates,
  onSessionChange,
  todayKey,
  isToday,
  missingStrikes,
  loading,
  error,
}: Props) {
  const band = "flex flex-wrap items-center gap-x-4 gap-y-3 p-3 sm:p-4";
  const bandStyle = { borderTop: "1px solid var(--border-default)", background: "var(--bg-subtle)" } as const;

  if (mode === "live") {
    return (
      <div className={band} style={bandStyle}>
        <div className="flex items-center gap-2">
          <span
            className="zg-gc-dot"
            aria-hidden
            style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-bull)", flex: "0 0 auto" }}
          />
          <span className="zg-eyebrow" style={{ color: "var(--color-bull)" }}>
            Live
          </span>
          <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
            tracking the latest spot
          </span>
        </div>
        <button
          type="button"
          onClick={onEnterReplay}
          className="zg-btn zg-btn--secondary ml-auto"
          style={{ padding: "7px 14px", fontSize: 12 }}
        >
          <History size={14} /> Replay session
        </button>
      </div>
    );
  }

  const max = Math.max(0, frameCount - 1);
  const atStart = frameCount === 0;

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4" style={bandStyle}>
      {/* Row 1: session + playhead time (left) · speed + exit (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="zg-chip" style={{ ["--chip-color" as string]: "var(--color-accent-hot)" }}>
            <History size={12} /> Replay
          </span>
          {sessionDate && sessionDates.length > 1 ? (
            // The session menu. A native <select> keeps it keyboard- and
            // screen-reader-friendly, styled like the ladders' SymbolSelect.
            <div className="relative inline-flex items-center">
              <select
                value={sessionDate}
                onChange={(e) => onSessionChange(e.target.value)}
                aria-label="Session to replay"
                title={`Pick the session to replay: any day both symbols have from about the last ${STRIKE_RETENTION_DAYS} days. Both ladders replay the same day.`}
                className="appearance-none font-mono"
                style={{
                  fontSize: 12,
                  color: "var(--text-primary)",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-control)",
                  padding: "3px 22px 3px 8px",
                  cursor: "pointer",
                }}
              >
                {sessionDates.map((d) => (
                  <option key={d} value={d}>
                    {`${fmtDate(d)}${d === todayKey ? " · today" : ""}`}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                aria-hidden
                style={{ position: "absolute", right: 6, pointerEvents: "none", color: "var(--text-secondary)" }}
              />
            </div>
          ) : sessionDate ? (
            <span className="font-mono" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {fmtDate(sessionDate)}
              {isToday ? " · today" : ""}
            </span>
          ) : null}
          <span
            className="font-mono"
            style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}
          >
            {fmtTime(cursorTime)} ET
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="zg-gc-seg" role="group" aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className="zg-gc-seg-btn"
                data-active={s === speed}
                onClick={() => onSpeedChange(s)}
                aria-pressed={s === speed}
              >
                {s}×
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onExitReplay}
            className="zg-btn zg-btn--secondary"
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            Exit replay
          </button>
        </div>
      </div>

      {/* Row 2: transport + playhead */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onStep(-1)} disabled={atStart} className="zg-gc-pill" style={{ padding: 6 }} aria-label="Step back one minute">
            <SkipBack size={14} />
          </button>
          <button
            type="button"
            onClick={onPlayToggle}
            disabled={atStart}
            className="zg-gc-pill"
            data-active={isPlaying}
            style={{ ["--pill-color" as string]: "var(--color-accent-hot)", padding: 6 }}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button type="button" onClick={() => onStep(1)} disabled={atStart} className="zg-gc-pill" style={{ padding: 6 }} aria-label="Step forward one minute">
            <SkipForward size={14} />
          </button>
          <button
            type="button"
            onClick={onLoopToggle}
            className="zg-gc-pill"
            data-active={loop}
            style={{ ["--pill-color" as string]: "var(--color-bull)", padding: 6 }}
            aria-label="Loop playback"
            aria-pressed={loop}
            title={loop ? "Looping\u00a0- restarts at the session open" : "Play once\u00a0- stops at the last frame"}
          >
            <Repeat size={14} />
          </button>
        </div>

        <span className="font-mono hidden sm:inline" style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 38 }}>
          {fmtTime(startTime)}
        </span>
        <input
          type="range"
          min={0}
          max={max}
          value={Math.min(cursor, max)}
          onChange={(e) => onScrub(Number(e.target.value))}
          disabled={atStart}
          aria-label="Scrub replay timeline"
          aria-valuetext={`${fmtTime(cursorTime)} ET`}
          className="flex-1 min-w-0"
          style={{ accentColor: "var(--color-accent-hot)" }}
        />
        <span className="font-mono hidden sm:inline" style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 38, textAlign: "right" }}>
          {fmtTime(endTime)}
        </span>
      </div>

      {loading && (
        <div className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Loading session…
        </div>
      )}
      {atStart && !loading && !error && (
        <div className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
          No replay session available for this pair yet.
        </div>
      )}
      {missingStrikes.length > 0 && sessionDate && !loading && !error && (
        <div className="font-mono" style={{ fontSize: 11, color: "var(--color-warning)" }}>
          No per-strike data is stored for {missingStrikes.join(" or ")} on {fmtDate(sessionDate)}, so{" "}
          {missingStrikes.length > 1 ? "the ladders are" : "its ladder is"} empty. Per-strike history goes back about{" "}
          {STRIKE_RETENTION_DAYS} days; pick another session.
        </div>
      )}
      {error && (
        <div className="font-mono" style={{ fontSize: 11, color: "var(--color-bear)" }}>
          Couldn&apos;t load the replay session. {error}
        </div>
      )}
    </div>
  );
}
