// Fixed-window rate limiting for the public levels-email signup endpoint.
//
// WHY A NEW ONE RATHER THAN enforceSignupRateLimit. Two reasons. Sharing that
// bucket would make a levels subscribe consume one of the visitor's five
// account-signup attempts, so somebody who asked for the email twice could no
// longer register. And the limiters in core/serverAuth.ts hold their state in
// module-level Maps that are never pruned — only loginAttempts is ever deleted
// from, on a successful login. One entry per distinct IP accumulates for the
// life of the PM2 process, which is a slow leak anything scanning from many
// addresses can grow. This endpoint is deliberately public and unauthenticated,
// so it will meet exactly that traffic, and must not add to the problem.
//
// Pure apart from the store it closes over, and every decision takes an
// injected clock, so the whole policy is unit-testable without waiting on real
// time. Locked down in tests/levelsRateLimit.test.ts.

export type RateLimitVerdict =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export type FixedWindowOptions = {
  /** Length of the window in milliseconds. */
  windowMs: number;
  /** Requests permitted per key per window. */
  max: number;
  /**
   * Hard ceiling on tracked keys. Reaching it triggers a prune of expired
   * entries; if that frees nothing the oldest-expiring entry is evicted, so
   * the store cannot grow without bound no matter how many addresses appear.
   */
  maxKeys?: number;
};

export type FixedWindowLimiter = {
  check(key: string, nowMs?: number): RateLimitVerdict;
  /** Tracked keys. Exposed for tests and diagnostics. */
  size(): number;
  reset(): void;
};

const DEFAULT_MAX_KEYS = 10_000;

export function createFixedWindowLimiter(opts: FixedWindowOptions): FixedWindowLimiter {
  const store = new Map<string, { count: number; resetAt: number }>();
  const maxKeys = opts.maxKeys ?? DEFAULT_MAX_KEYS;

  function prune(nowMs: number): void {
    for (const [key, entry] of store) {
      if (nowMs > entry.resetAt) store.delete(key);
    }
  }

  function evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestReset = Infinity;
    for (const [key, entry] of store) {
      if (entry.resetAt < oldestReset) {
        oldestReset = entry.resetAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) store.delete(oldestKey);
  }

  return {
    check(key: string, nowMs: number = Date.now()): RateLimitVerdict {
      const entry = store.get(key);

      // Fresh window: either never seen, or the previous one has elapsed.
      if (!entry || nowMs > entry.resetAt) {
        if (store.size >= maxKeys) {
          prune(nowMs);
          if (store.size >= maxKeys) evictOldest();
        }
        store.set(key, { count: 1, resetAt: nowMs + opts.windowMs });
        return { allowed: true, remaining: Math.max(0, opts.max - 1) };
      }

      if (entry.count >= opts.max) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - nowMs) / 1000)),
        };
      }

      entry.count += 1;
      // NOTE: resetAt is deliberately NOT extended. A sliding window would let
      // a steady trickle hold the window open forever; a fixed window always
      // drains, so a blocked caller has a real time at which they recover.
      return { allowed: true, remaining: Math.max(0, opts.max - entry.count) };
    },
    size: () => store.size,
    reset: () => store.clear(),
  };
}

/**
 * Policy for POST /api/levels-email.
 *
 * Five per hour per IP mirrors SIGNUP_MAX_ATTEMPTS / SIGNUP_WINDOW_MS in
 * core/serverAuth.ts, which is the closest existing public write endpoint.
 * Generous for a person who mistypes their address twice and retries; tight
 * enough that a scripted spray stops after the fifth row.
 *
 * It is NOT the primary abuse defence and does not need to be. Double opt-in
 * means a submission mails at most one confirmation to an address that has not
 * confirmed, and the per-address cooldown in core/levelsEmail.ts bounds that
 * independently of how many IPs the submissions come from. This limit exists to
 * stop one host filling the table with rows, not to stop mail going out.
 */
export const LEVELS_SIGNUP_WINDOW_MS = 60 * 60 * 1000;
export const LEVELS_SIGNUP_MAX_ATTEMPTS = 5;

export const levelsSignupLimiter = createFixedWindowLimiter({
  windowMs: LEVELS_SIGNUP_WINDOW_MS,
  max: LEVELS_SIGNUP_MAX_ATTEMPTS,
});
