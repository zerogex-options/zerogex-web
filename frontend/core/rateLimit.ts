// A bounded fixed-window rate limiter.
//
// Generic on purpose: it backs both the public levels-email signup endpoint
// and the four auth limiters (login, signup, password reset, email
// verification resend), which previously each carried their own copy of the
// same fifteen lines.
//
// WHY BOUNDED. The auth limiters this replaces held their state in
// module-level Maps that were never pruned — only loginAttempts was ever
// deleted from, on a successful login. One entry per distinct key
// accumulated for the life of the PM2 process, on endpoints that are public
// and unauthenticated and therefore meet traffic from large address pools.
// Nothing reclaimed it short of a restart.
//
// WHY FIXED RATHER THAN SLIDING. `resetAt` is never extended by a rejected
// attempt. A sliding window would let a steady trickle of retries hold the
// window open indefinitely, so a blocked caller would have no time at which
// they recover. This is the behaviour the original auth limiters had and it
// is preserved deliberately.
//
// Pure apart from the store it closes over, and every decision takes an
// injected clock, so the policy is unit-testable without waiting on real
// time. Locked down in tests/rateLimit.test.ts.

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
  /**
   * Forget one key's window entirely.
   *
   * The login limiter needs this: a successful sign-in clears the failure
   * count, so someone who mistypes their password four times and then gets
   * it right is not left one attempt away from a lockout.
   */
  clear(key: string): void;
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
    clear: (key: string) => {
      store.delete(key);
    },
    size: () => store.size,
    reset: () => store.clear(),
  };
}

