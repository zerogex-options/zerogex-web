// Pacing and retry for bulk sends through Resend: how fast to go, which
// failures are worth another attempt, and how long to wait before one.
//
// WHY THIS EXISTS. On 2026-10-02 the free daily levels digest sent its 17
// emails back to back with no spacing, and Resend refused three of them: "Too
// many requests. You can only make 10 requests per second." Nothing retried,
// the run exited non-zero, and those three subscribers simply did not get that
// morning's email.
//
// Resend's limit is per TEAM, not per API key or per script: "All API keys
// associated with your team share the same rate limit pool", enforced as a
// per-second window with no burst allowance. The per-minute TradeWorkz worker,
// the other send timers and the app's own transactional mail all draw on the
// same 10 requests/second. So pacing alone cannot guarantee a clean run, since
// a burst from elsewhere can still earn a 429. And a 429 is no reason to give
// up either: it means "slow down", and its retry-after header says for how long.
//
// NO IDEMPOTENCY KEYS, deliberately. Resend documents what a reused key does
// after a SUCCESSFUL send, but not whether a request it rejected (a 429, a 5xx)
// uses the key up. If it does, every retry of a rate-limited send would replay
// the stored 429 for 24 hours — the exact failure this module exists to fix.
// What a key would buy is protection against one rare case: a response lost
// after Resend had already accepted the email, where a retry sends it twice.
// One duplicate free digest is the cheaper failure.
//
// Pure apart from the injected send, clock and sleep, so every rule here is
// unit-tested without a network (tests/resendRetry.test.ts).
//
// NO `server-only` AND NO '@/' ALIAS: the send scripts import this under
// --experimental-strip-types, outside Next.

/** A failed Resend API call, carrying what the retry rules need to classify it. */
export class ResendSendError extends Error {
  /** HTTP status, or null when no response came back at all. */
  readonly statusCode: number | null;
  /** Resend's error name, e.g. 'rate_limit_exceeded'. */
  readonly code: string;
  /** How long Resend asked us to wait before the next request, or null if it did not say. */
  readonly retryAfterMs: number | null;

  constructor(input: { message: string; statusCode: number | null; code: string; retryAfterMs?: number | null }) {
    // Same text the mailer has always thrown, so log lines read as before.
    super(`Resend error: ${input.message}`);
    this.name = 'ResendSendError';
    this.statusCode = input.statusCode;
    this.code = input.code;
    this.retryAfterMs = input.retryAfterMs ?? null;
  }
}

/**
 * Seconds-to-wait from Resend's response headers, as milliseconds.
 *
 * retry-after first, then ratelimit-reset. Both are documented as "how many
 * seconds", not epoch stamps. The SDK lowercases header names; the lookup does
 * too, so a hand-built map with any casing still works.
 */
export function parseRetryAfterMs(headers: Record<string, string> | null | undefined): number | null {
  if (!headers) return null;
  const lower: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) lower[key.toLowerCase()] = value;
  for (const name of ['retry-after', 'ratelimit-reset']) {
    const raw = lower[name];
    if (raw == null || String(raw).trim() === '') continue;
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  }
  return null;
}

const RATE_LIMIT_CODES_THAT_ARE_QUOTAS = new Set(['daily_quota_exceeded', 'monthly_quota_exceeded']);

/**
 * Build the error from what the SDK returns on failure: `{ error, headers }`,
 * where headers is null when the request never got a response.
 */
export function resendSendError(
  error: { message?: string | null; statusCode?: number | null; name?: string | null },
  headers?: Record<string, string> | null,
): ResendSendError {
  const code = error.name ?? 'unknown_error';
  let statusCode = typeof error.statusCode === 'number' ? error.statusCode : null;
  // The API puts statusCode in its error body, but the 429s are unambiguous by
  // name, so do not let a body without it turn a rate limit into "no response".
  if (statusCode === null && (code === 'rate_limit_exceeded' || RATE_LIMIT_CODES_THAT_ARE_QUOTAS.has(code))) {
    statusCode = 429;
  }
  return new ResendSendError({
    message: error.message ?? 'unknown error',
    statusCode,
    code,
    retryAfterMs: parseRetryAfterMs(headers),
  });
}

/**
 * Over the per-second limit: clears in about a second, so wait and go again.
 *
 * NOT the daily and monthly quota errors, which share the 429 status. Those
 * clear at midnight UTC or at the next billing cycle, and retrying one only
 * delays the alert.
 */
export function isRateLimited(err: unknown): boolean {
  return (
    err instanceof ResendSendError &&
    err.statusCode === 429 &&
    !RATE_LIMIT_CODES_THAT_ARE_QUOTAS.has(err.code)
  );
}

/**
 * Worth another attempt later in the run.
 *
 *   - rate limited (above);
 *   - no response at all: DNS, a reset connection, a timeout. The SDK reports
 *     every one of those as statusCode null;
 *   - a 5xx: Resend's own guidance for application_error and
 *     service_unavailable is "try the request again later";
 *   - concurrent_idempotent_requests (409), the one error the docs explicitly
 *     call safe to retry. Unreachable while no key is sent, and harmless.
 *
 * Everything else describes the request itself: a malformed address, a bad
 * key, an exhausted quota. It fails the same way every time. Anything that is
 * not a ResendSendError at all (a rendering bug, say) is not retried either.
 */
export function isRetryable(err: unknown): boolean {
  if (!(err instanceof ResendSendError)) return false;
  if (isRateLimited(err)) return true;
  if (err.statusCode === null) return true;
  if (err.statusCode >= 500) return true;
  return err.code === 'concurrent_idempotent_requests';
}

/** Floor and ceiling on a rate-limit wait. The window is one second; a minute is plenty. */
export const MIN_RATE_LIMIT_WAIT_MS = 1_000;
export const MAX_RATE_LIMIT_WAIT_MS = 60_000;

/**
 * How long to pause after a 429 before the next request. Resend's retry-after
 * when it sent one, otherwise 1s, 2s, 4s… by attempt.
 */
export function rateLimitWaitMs(err: ResendSendError, attempt: number): number {
  const asked = err.retryAfterMs ?? MIN_RATE_LIMIT_WAIT_MS * 2 ** Math.max(0, attempt - 1);
  return Math.min(Math.max(asked, MIN_RATE_LIMIT_WAIT_MS), MAX_RATE_LIMIT_WAIT_MS);
}

/** Requests per item while it keeps getting 429s, before it waits for the next round instead. */
export const DEFAULT_RATE_LIMIT_ATTEMPTS = 3;

/**
 * The pause before each retry round. Its length is the number of rounds.
 *
 * About 7.5 minutes in all, so a run that has to use every round still ends
 * well inside the daily levels unit's 15-minute TimeoutStartSec, with a
 * summary and an exit status, instead of being killed partway through.
 */
export const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [30_000, 60_000, 120_000, 240_000];

export type DeliveryOptions<T> = {
  /** Minimum gap between the START of one request and the start of the next. */
  throttleMs: number;
  /** How the log names an item (an email address, for a subscriber). */
  label: (item: T) => string;
  log?: (line: string) => void;
  /** See DEFAULT_RATE_LIMIT_ATTEMPTS. */
  rateLimitAttempts?: number;
  /** See DEFAULT_RETRY_DELAYS_MS. */
  retryDelaysMs?: readonly number[];
  /**
   * Asked before each retry round with the instant the round would begin.
   * False ends retrying, and whatever is still pending is a failure. This is
   * how a pre-open email stops retrying once the send window has closed.
   */
  mayRetryAt?: (ms: number) => boolean;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export type DeliveryResult<T> = {
  sent: T[];
  failed: Array<{ item: T; error: unknown }>;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Send to every item: paced, retrying what is worth retrying.
 *
 * `send` must throw ONLY when the email was not handed to Resend. Anything
 * that runs after a successful send (stamping a row, say) has to catch its own
 * errors, or a delivered email reads as a failure and is sent again.
 *
 * Two layers of retry, because the failures happen on two timescales:
 *
 *   1. A 429 is retried on the spot, after the wait Resend asked for, and that
 *      wait holds back EVERY request, not just the item that got the 429. The
 *      account is over its limit, so pressing on with the next item would only
 *      earn another.
 *   2. Anything else retryable (no response, a 5xx, a 429 that persisted) waits
 *      for a retry round: the rest of the list goes first, then the stragglers
 *      get another pass after each delay in retryDelaysMs.
 *
 * Every item ends up in exactly one of `sent` or `failed`.
 */
export async function deliverAll<T>(
  items: readonly T[],
  send: (item: T) => Promise<void>,
  opts: DeliveryOptions<T>,
): Promise<DeliveryResult<T>> {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? defaultSleep;
  const log = opts.log ?? (() => {});
  const rateLimitAttempts = Math.max(1, opts.rateLimitAttempts ?? DEFAULT_RATE_LIMIT_ATTEMPTS);
  const retryDelays = opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;

  // One clock for every request in the run: the next may not start before
  // nextRequestAt. Spacing STARTS rather than sleeping between sends is what
  // actually caps the rate, however long each call takes.
  let nextRequestAt = 0;

  async function attempt(item: T): Promise<void> {
    for (let n = 1; ; n += 1) {
      const wait = nextRequestAt - now();
      if (wait > 0) await sleep(wait);
      nextRequestAt = now() + opts.throttleMs;
      try {
        await send(item);
        return;
      } catch (err) {
        if (!isRateLimited(err) || n >= rateLimitAttempts) throw err;
        const waitMs = rateLimitWaitMs(err as ResendSendError, n);
        nextRequestAt = Math.max(nextRequestAt, now() + waitMs);
        log(`  WAIT ${opts.label(item)}: rate limited, trying again in ${(waitMs / 1000).toFixed(1)}s`);
      }
    }
  }

  const sent: T[] = [];
  const failed: Array<{ item: T; error: unknown }> = [];
  let pending: Array<{ item: T; error: unknown }> = items.map((item) => ({ item, error: null }));

  for (let round = 0; pending.length > 0; round += 1) {
    if (round > 0) {
      const delay = retryDelays[round - 1];
      if (opts.mayRetryAt && !opts.mayRetryAt(now() + delay)) {
        log(`\nNot retrying ${pending.length} recipient(s): the next attempt would land outside the send window.`);
        for (const entry of pending) {
          failed.push(entry);
          log(`  FAIL ${opts.label(entry.item)}: ${messageOf(entry.error)}`);
        }
        break;
      }
      log(`\nRetry ${round} of ${retryDelays.length} in ${Math.round(delay / 1000)}s: ${pending.length} recipient(s)`);
      await sleep(delay);
    }

    const lastRound = round >= retryDelays.length;
    const stillPending: Array<{ item: T; error: unknown }> = [];
    for (const { item } of pending) {
      try {
        await attempt(item);
        sent.push(item);
        if (round > 0) log(`  SENT ${opts.label(item)} on retry ${round}`);
      } catch (error) {
        if (isRetryable(error) && !lastRound) {
          stillPending.push({ item, error });
          log(`  RETRY ${opts.label(item)}: ${messageOf(error)}`);
        } else {
          failed.push({ item, error });
          log(`  FAIL ${opts.label(item)}: ${messageOf(error)}${isRetryable(error) ? ' (no retries left)' : ''}`);
        }
      }
    }
    pending = stillPending;
  }

  return { sent, failed };
}
