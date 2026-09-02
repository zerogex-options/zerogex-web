/**
 * Bar clock — how far a candle is through its own window.
 *
 * A live chart's newest candle is still forming: it opened at some point in the
 * past and closes at a fixed future instant. Traders read that gap constantly —
 * "does this rejection have four minutes left to fail, or four seconds?" — so
 * the Gamma Chart surfaces it as a countdown beside the last price and as an
 * elapsed/remaining line in the crosshair readout.
 *
 * Two bucket shapes, and they are NOT the same arithmetic:
 *
 *   • Intraday (1min…1hr) — the timestamp is a real wall-clock instant at the
 *     bucket's start, so the window is simply [ts, ts + interval). Counting
 *     down to the bucket's end is right even when the session opens partway
 *     into it (a 1-hour bucket stamped 09:00 still closes at 10:00).
 *
 *   • Daily — the timestamp is a DATE MARKER floored to UTC midnight, not an
 *     instant (see etTradingDateLabel in core/utils). Adding 24h to it lands on
 *     20:00 ET, which is neither the open nor the close. A daily candle's real
 *     window is the regular cash session on that trading date: 09:30 → 16:00
 *     ET. That has to be resolved through the ET calendar so it survives DST.
 *
 * Pure and side-effect free — `nowMs` is always injected — so the whole thing
 * unit-tests against fixed instants with no clock mocking.
 */

export type BarClockTimeframe = '1min' | '5min' | '15min' | '1hr' | '1day';

const INTERVAL_MINUTES: Record<BarClockTimeframe, number> = {
  '1min': 1,
  '5min': 5,
  '15min': 15,
  '1hr': 60,
  '1day': 1440,
};

// Regular US cash session in ET wall-clock minutes. The daily candle spans
// exactly this, which is why its window is 6h30m of clock time and not 24h.
const RTH_OPEN_MINUTES = 9 * 60 + 30;
const RTH_CLOSE_MINUTES = 16 * 60;

export type BarClock = {
  /** Length of the candle's window in ms (interval, or the cash session for 1day). */
  totalMs: number;
  /** Time since the window opened, clamped to [0, totalMs]. */
  elapsedMs: number;
  /** Time until the window closes, clamped to [0, totalMs]. */
  remainingMs: number;
  /** elapsedMs / totalMs, clamped to [0, 1]. */
  progress: number;
  /** True once the window has fully elapsed — the candle is closed. */
  complete: boolean;
};

const ET_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * How far ahead of ET the given instant's UTC clock reads, in ms (+4h during
 * EDT, +5h during EST). Derived from the ET calendar rather than a hardcoded
 * offset so DST — and any future change to US DST rules — is handled by the
 * platform's tz database instead of by us.
 */
function etOffsetMs(ms: number): number {
  const parts = ET_PARTS.formatToParts(new Date(ms));
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  // `hour12: false` renders midnight as 24 on some engines; fold it back to 0.
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return ms - asIfUtc;
}

/**
 * The UTC instant of an ET wall-clock time on a given calendar date. Applies
 * the offset twice: the first pass is computed at the wrong instant whenever
 * the naive guess falls on the far side of a DST boundary, and the second pass
 * re-reads it at the corrected one. (09:30 and 16:00 are never near a 02:00
 * transition, so the second pass is belt-and-braces rather than load-bearing.)
 */
function etWallClockMs(year: number, month: number, day: number, minutesOfDay: number): number {
  const hour = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const once = naive + etOffsetMs(naive);
  return naive + etOffsetMs(once);
}

/**
 * The regular-session window for the daily candle stamped `ms`. The marker is
 * floored to UTC midnight and a US cash session sits wholly inside one UTC
 * calendar day, so that day's UTC date IS the ET trading date — read the date
 * parts in UTC, never in ET (which would roll back to the prior evening).
 */
function dailyWindow(ms: number): { openMs: number; closeMs: number } {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return {
    openMs: etWallClockMs(year, month, day, RTH_OPEN_MINUTES),
    closeMs: etWallClockMs(year, month, day, RTH_CLOSE_MINUTES),
  };
}

/**
 * Where `nowMs` sits inside the candle stamped `timestamp`. Returns null when
 * the timestamp can't be parsed, so callers render nothing rather than a
 * nonsense timer.
 */
export function barClock(
  timestamp: string | null | undefined,
  timeframe: BarClockTimeframe,
  nowMs: number,
): BarClock | null {
  if (!timestamp) return null;
  const startedAt = new Date(timestamp).getTime();
  if (!Number.isFinite(startedAt)) return null;

  let openMs: number;
  let closeMs: number;
  if (timeframe === '1day') {
    ({ openMs, closeMs } = dailyWindow(startedAt));
  } else {
    openMs = startedAt;
    closeMs = startedAt + INTERVAL_MINUTES[timeframe] * 60_000;
  }

  const totalMs = closeMs - openMs;
  if (!(totalMs > 0)) return null;

  // Clamped both ways: before the daily open `now - openMs` is negative, and a
  // candle the feed hasn't rolled yet can outlive its own window.
  const elapsedMs = Math.min(totalMs, Math.max(0, nowMs - openMs));
  return {
    totalMs,
    elapsedMs,
    remainingMs: totalMs - elapsedMs,
    progress: elapsedMs / totalMs,
    complete: nowMs >= closeMs,
  };
}

/**
 * Duration as `M:SS`, or `H:MM:SS` once it reaches an hour.
 *
 * `round` matters at the edges and the two readouts want opposite behaviour: a
 * countdown ceils, so it reads 0:01 for the whole final second and only hits
 * 0:00 when the candle has actually closed; elapsed floors, so a fresh candle
 * reads 0:00 rather than jumping straight to 0:01.
 */
export function formatBarDuration(ms: number, round: 'floor' | 'ceil' = 'floor'): string {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalSeconds = round === 'ceil' ? Math.ceil(safe / 1000) : Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}
