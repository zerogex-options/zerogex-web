// Pure (non-React) helpers for the Trade Bias horizon — the "which tenor is
// this read for?" choice behind /trade-bias's Horizon dropdown.
//
// Deliberately kept out of the page component so the resolution + persistence
// contract can be exercised directly under the Node test runner with a stubbed
// window.localStorage, exactly like core/symbolPersistence.ts, which this
// mirrors closely: one enum value, a guard, a read, a write, a resolve.
//
// Why persist it at all: the page held the horizon in plain component state
// seeded to 'swing', so every visit reset to the multi-day read. For a same-day
// trader that is not a small annoyance — the two tenors are genuinely different
// calls (swing is led by the gamma and volatility regime, intraday by flow,
// tape and momentum, and they are allowed to disagree), so a 0DTE trader who
// forgot to re-pick was reading the wrong one, with nothing on screen saying so.
// A horizon is a standing preference, not a per-visit decision.
//
// It is also SHARED with the Trade Bias dashboard widget, so setting the
// horizon in either place sets it in both: a board and a page showing the same
// symbol must not be able to show two different directional calls.

export type BiasTenor = 'swing' | 'intraday';

export const BIAS_TENOR_STORAGE_KEY = 'zgx_trade_bias_tenor';

// Swing stays the default for a first-time visitor: it is the more
// conservative, structural read, and the wrong default to hand someone who has
// not yet said what they trade.
export const DEFAULT_BIAS_TENOR: BiasTenor = 'swing';

/** The dropdown's options, in display order. */
export const BIAS_TENOR_OPTIONS: readonly { value: BiasTenor; label: string }[] = [
  { value: 'swing', label: 'Swing · Multi-day' },
  { value: 'intraday', label: 'Intraday · 0DTE' },
] as const;

export function isBiasTenor(value: unknown): value is BiasTenor {
  return value === 'swing' || value === 'intraday';
}

// Best-effort write. localStorage can throw (Safari private mode, storage
// disabled, quota) — persistence must never break switching the horizon, so a
// failure is swallowed and the in-memory state carries the value for the life
// of the page.
export function persistBiasTenor(tenor: BiasTenor): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BIAS_TENOR_STORAGE_KEY, tenor);
  } catch {
    /* storage unavailable — see comment above */
  }
}

/**
 * The stored horizon, or null when there is nothing usable there. The guard is
 * on the VALUE, not just its type: an unrecognised string would be forwarded to
 * the bias API as a tenor it has no reading for, and the page would sit on an
 * empty "no data" state that looks like an outage rather than a bad preference.
 */
export function readStoredBiasTenor(): BiasTenor | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(BIAS_TENOR_STORAGE_KEY);
    return isBiasTenor(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** The stored horizon, falling back to the default. */
export function resolveBiasTenor(): BiasTenor {
  return readStoredBiasTenor() ?? DEFAULT_BIAS_TENOR;
}
