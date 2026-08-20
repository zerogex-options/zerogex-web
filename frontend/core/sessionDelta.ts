/**
 * Session-delta primitives for the gamma ladder's "Δ since open" indicator —
 * the optional green/red triangle next to each strike's live Net GEX showing
 * whether dealer gamma there has BUILT or ERODED since the session opened.
 *
 * The baseline is one `/api/replay/frame` snapshot taken at the session's
 * 09:30 ET open. Its strike rows are per (strike, expiration) — the raw
 * `gex_by_strike` grain — so ONE cached fetch per symbol per session serves
 * every expiration selection: re-filtering is a client-side re-sum, never a
 * refetch. The live side is the ladder's own cells (the strike-profile
 * timeseries tip), which use the same summed dollar-GEX basis, so
 * `current − baseline` compares like with like for whatever expiries are
 * selected.
 *
 * Pure (no React, no imports) so the contract runs under the Node test runner
 * like core/strikeFilter.ts and core/expirationPersistence.ts.
 */

// The ET calendar date (YYYY-MM-DD) an instant belongs to — a local copy of
// core/utils.etDateKeyFor kept here (rather than imported) so this module
// stays import-free for the Node test runner, which resolves runtime imports
// by exact path and would trip on the app's extensionless import style.
const ET_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function etDateKeyFor(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : ET_DATE_FORMATTER.format(d);
}

/** One `/api/replay/frame` strike row (per strike AND expiration). */
export interface FrameStrikeRow {
  strike?: number | string | null;
  expiration?: string | null;
  net_gex?: number | string | null;
}

const num = (v: number | string | null | undefined): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * The 09:30 ET session open, as a UTC ISO string, for the session the given
 * instant belongs to (its ET calendar date). Used as the `/api/replay/frame`
 * `ts` — the frame endpoint resolves at-or-before, so during pre-market the
 * baseline is simply the latest pre-open row (Δ reads ~0 until the open, which
 * is honest: there is no session yet).
 *
 * ET is either UTC-4 (EDT) or UTC-5 (EST). Guess 13:30Z (EDT), then check what
 * ET wall-clock that instant renders as; if it reads 08:30 the date is on EST,
 * so shift an hour. Two probes, exact for every date, no tz library.
 */
export function sessionOpenIsoFor(ts: string | null | undefined): string | null {
  const dateKey = etDateKeyFor(ts);
  if (!dateKey) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return null;
  const guess = new Date(Date.UTC(y, m - 1, d, 13, 30));
  const etHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    }).format(guess),
  );
  const open = etHour === 9 ? guess : new Date(Date.UTC(y, m - 1, d, 14, 30));
  return open.toISOString();
}

/**
 * Collapse a frame's per-(strike, expiration) rows to per-strike Net GEX
 * summed across the selected expirations. `selected` uses the site-wide
 * convention: an EMPTY array means "All expirations".
 */
export function baselineNetByStrike(
  rows: readonly FrameStrikeRow[] | null | undefined,
  selected: readonly string[],
): Map<number, number> {
  const out = new Map<number, number>();
  if (!Array.isArray(rows)) return out;
  const filter = selected.length > 0 ? new Set(selected) : null;
  for (const row of rows) {
    const strike = num(row?.strike);
    const net = num(row?.net_gex);
    if (!Number.isFinite(strike) || !Number.isFinite(net)) continue;
    if (filter && !(row?.expiration && filter.has(row.expiration))) continue;
    out.set(strike, (out.get(strike) ?? 0) + net);
  }
  return out;
}

export interface SessionDeltaMark {
  /** Dealer gamma at this strike rose ('up' → building) or fell ('down' → eroding). */
  dir: 'up' | 'down';
  /** Signed dollar change since the baseline (current-cell basis). */
  delta: number;
  /** |Δ| / |baseline|, or null when the baseline was ~0 (a new position). */
  pct: number | null;
}

/**
 * Classify one strike's change since open, or null when the move is too small
 * to mark — the indicator must stay a signal, not per-row noise.
 *
 * `noiseFloor` is an absolute dollar floor the caller derives from the
 * column's own scale (e.g. a small fraction of its tint-normalisation clip) so
 * "too small" adapts to SPY and SPX alike. On top of it, moves under 5% of the
 * strike's own baseline are suppressed as drift.
 */
export function sessionDeltaMark(
  current: number,
  baseline: number | undefined,
  noiseFloor: number,
): SessionDeltaMark | null {
  if (!Number.isFinite(current)) return null;
  const base = Number.isFinite(baseline as number) ? (baseline as number) : 0;
  const delta = current - base;
  if (delta === 0) return null;
  if (Math.abs(delta) <= Math.max(0, noiseFloor)) return null;
  if (base !== 0 && Math.abs(delta) < 0.05 * Math.abs(base)) return null;
  return {
    dir: delta > 0 ? 'up' : 'down',
    delta,
    pct: base !== 0 ? Math.abs(delta) / Math.abs(base) : null,
  };
}

/** Human tooltip line for a mark: "Δ since 09:30 ET: building +34%". */
export function sessionDeltaTitle(mark: SessionDeltaMark): string {
  const verb = mark.dir === 'up' ? 'building' : 'eroding';
  const amount =
    mark.pct == null
      ? 'new since open'
      : `${mark.dir === 'up' ? '+' : '−'}${Math.round(mark.pct * 100)}% vs open`;
  return `Dealer gamma ${verb} here this session (${amount})`;
}

// ── Persisted display preference ────────────────────────────────────────────
// The indicator is opt-in ("Δ Session" toggle). One persisted global, like the
// strike filter, so the pair page and the dashboard ladder tile move together.

export type SessionDeltaMode = 'on' | 'off';

export const SESSION_DELTA_STORAGE_KEY = 'zgx_session_delta';

const DEFAULT_SESSION_DELTA: SessionDeltaMode = 'off';

/** Only the explicit "on" opt-in enables the overlay; anything else (missing
 *  key, legacy value, corruption) lands on the quiet default. */
export function parseSessionDelta(raw: string | null | undefined): SessionDeltaMode {
  return raw === 'on' ? 'on' : DEFAULT_SESSION_DELTA;
}

/** SSR-safe read of the persisted preference. */
export function readStoredSessionDelta(): SessionDeltaMode {
  if (typeof window === 'undefined') return DEFAULT_SESSION_DELTA;
  try {
    return parseSessionDelta(window.localStorage.getItem(SESSION_DELTA_STORAGE_KEY));
  } catch {
    return DEFAULT_SESSION_DELTA;
  }
}

/** SSR-safe write; silently no-ops when storage is unavailable (private mode). */
export function writeStoredSessionDelta(mode: SessionDeltaMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SESSION_DELTA_STORAGE_KEY, mode);
  } catch {
    // Private-mode / disabled storage — in-memory preference only.
  }
}
