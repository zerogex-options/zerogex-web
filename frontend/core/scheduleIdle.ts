// Schedule a one-shot callback for when the browser is idle, with a
// hard timeout ceiling so the work never gets starved indefinitely.
// Falls back to setTimeout on browsers without requestIdleCallback
// (notably older Safari).
//
// Returns a cleanup that cancels the scheduled callback. Safe to call
// from a useEffect on the server (no-ops when window is unavailable).

const FALLBACK_DELAY_MS = 1_500;
const DEFAULT_IDLE_TIMEOUT_MS = 4_000;

export function scheduleIdle(run: () => void, idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS): () => void {
  if (typeof window === 'undefined') return () => {};
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: idleTimeoutMs });
    return () => {
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(id);
      }
    };
  }
  const id = window.setTimeout(run, FALLBACK_DELAY_MS);
  return () => window.clearTimeout(id);
}
