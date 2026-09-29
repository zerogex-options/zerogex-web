// Decides whether a poll tick should send a request, given when the previous
// request from the same poll loop went out and whether it has come back.
//
// A timer-driven poll that ignores its own in-flight request misbehaves on a
// slow connection in one of two ways. It either stacks a new request on every
// tick (each one queues behind the last, so a slow patch feeds itself), or it
// cancels the late request and asks again (so once a round trip takes longer
// than the interval, no answer ever lands). Members far from the servers hit
// both: a 2026-09-29 report from Romania showed rows of canceled price requests
// and others taking up to 18 s, while the API itself answered in milliseconds.
//
// So a tick while a request is out does nothing: the answer in flight lands and
// the next tick after it asks again. Only a request out for longer than the
// stale threshold is treated as stuck and replaced.

export type PollDecision = 'start' | 'skip' | 'replace';

// No poll here asks more often than once a second, so a request still out
// after 10 s has missed ten ticks and is not coming back in useful time.
export const STALE_POLL_FLOOR_MS = 10_000;

export function staleAfterMs(intervalMs: number): number {
  return Math.max(STALE_POLL_FLOOR_MS, intervalMs * 3);
}

export function pollDecision(
  inflightStartedAt: number | null,
  now: number,
  staleAfter: number,
): PollDecision {
  if (inflightStartedAt === null) return 'start';
  return now - inflightStartedAt < staleAfter ? 'skip' : 'replace';
}
