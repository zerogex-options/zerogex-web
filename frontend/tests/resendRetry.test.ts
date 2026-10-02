// Unit tests for core/resendRetry.ts: pacing and retry for bulk Resend sends.
//
// The failure these lock down happened on 2026-10-02: the daily levels digest
// sent 17 emails back to back, Resend's 10-requests-per-second limit refused
// three, nothing retried, and those three subscribers went without that
// morning's email. The simulated Resend below enforces the same per-second
// window, so the regression test is that exact morning, replayed.
//
// Every test runs on a fake clock: sleeping advances time instantly, so the
// suite takes milliseconds while still asserting real spacing.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_RETRY_DELAYS_MS,
  MAX_RATE_LIMIT_WAIT_MS,
  ResendSendError,
  deliverAll,
  isRateLimited,
  isRetryable,
  parseRetryAfterMs,
  rateLimitWaitMs,
  resendSendError,
} from '../core/resendRetry.ts';

// ── Fakes ───────────────────────────────────────────────────────────────────

function fakeClock() {
  let t = 0;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
}

const RATE_LIMITED = () =>
  resendSendError(
    {
      name: 'rate_limit_exceeded',
      statusCode: 429,
      message:
        'Too many requests. You can only make 10 requests per second. See rate limit response headers for more information. Or contact support to increase rate limit.',
    },
    { 'retry-after': '1', 'ratelimit-limit': '10', 'ratelimit-remaining': '0', 'ratelimit-reset': '1' },
  );
const NO_RESPONSE = () =>
  resendSendError(
    { name: 'application_error', statusCode: null, message: 'Unable to fetch data. The request could not be resolved.' },
    null,
  );
const BAD_ADDRESS = () =>
  resendSendError({ name: 'validation_error', statusCode: 422, message: 'Invalid `to` field.' }, {});

/**
 * Resend as it behaved that morning: at most `perSecond` requests in any
 * one-second window, the rest refused with a 429.
 */
function fakeResend(clock: ReturnType<typeof fakeClock>, perSecond = 10) {
  const accepted: Array<{ to: string; at: number }> = [];
  const refused: Array<{ to: string; at: number }> = [];
  const starts: number[] = [];
  return {
    accepted,
    refused,
    send: async (to: string) => {
      const at = clock.now();
      const inWindow = starts.filter((s) => at - s < 1000).length;
      starts.push(at);
      if (inWindow >= perSecond) {
        refused.push({ to, at });
        throw RATE_LIMITED();
      }
      accepted.push({ to, at });
    },
  };
}

const seventeen = Array.from({ length: 17 }, (_, i) => `subscriber${i + 1}@example.com`);

function run<T>(
  items: T[],
  send: (item: T) => Promise<void>,
  clock: ReturnType<typeof fakeClock>,
  extra: Partial<Parameters<typeof deliverAll<T>>[2]> = {},
) {
  const lines: string[] = [];
  return deliverAll(items, send, {
    throttleMs: 250,
    label: (item) => String(item),
    log: (line) => lines.push(line),
    sleep: clock.sleep,
    now: clock.now,
    ...extra,
  }).then((result) => ({ ...result, lines }));
}

// ── The 2026-10-02 morning, replayed ────────────────────────────────────────

test('regression: back to back with no pacing, a 10/s limit refuses some of 17 — and every refusal is retried', async () => {
  const clock = fakeClock();
  const resend = fakeResend(clock);
  const result = await run(seventeen, resend.send, clock, { throttleMs: 0 });

  assert.ok(resend.refused.length > 0, 'the simulation must actually hit the limit, or it proves nothing');
  assert.equal(result.failed.length, 0);
  assert.deepEqual(result.sent, seventeen);
  // Exactly one accepted copy each: a retry never doubles up a delivery.
  assert.deepEqual(resend.accepted.map((a) => a.to).sort(), [...seventeen].sort());
});

test('at the default 250 ms pace the same list never trips a 10/s limit', async () => {
  const clock = fakeClock();
  const resend = fakeResend(clock);
  const result = await run(seventeen, resend.send, clock);

  assert.equal(resend.refused.length, 0);
  assert.equal(result.failed.length, 0);
  assert.equal(result.sent.length, 17);
});

test('the pace still holds when another sender is using half the budget', async () => {
  // Resend's limit is per team: the TradeWorkz worker and the app's own mail
  // draw on the same 10/s. A 5/s ceiling for us is what is left.
  const clock = fakeClock();
  const resend = fakeResend(clock, 5);
  const result = await run(seventeen, resend.send, clock);

  assert.equal(resend.refused.length, 0);
  assert.equal(result.sent.length, 17);
});

// ── Pacing ──────────────────────────────────────────────────────────────────

test('request starts are spaced by throttleMs, and the first one is not delayed', async () => {
  const clock = fakeClock();
  const starts: number[] = [];
  await run(['a', 'b', 'c', 'd'], async () => {
    starts.push(clock.now());
  }, clock);
  assert.deepEqual(starts, [0, 250, 500, 750]);
});

test('a slow request counts toward the gap instead of adding to it', async () => {
  // Spacing request STARTS is what caps the rate. Sleeping a fixed 250 ms
  // after each call would make every run slower than it needs to be.
  const clock = fakeClock();
  const starts: number[] = [];
  await run(['a', 'b', 'c'], async () => {
    starts.push(clock.now());
    await clock.sleep(400);
  }, clock);
  assert.deepEqual(starts, [0, 400, 800]);
});

// ── 429s ────────────────────────────────────────────────────────────────────

test('a 429 waits as long as retry-after asks, then tries the same recipient again', async () => {
  const clock = fakeClock();
  const calls: Array<{ to: string; at: number }> = [];
  let refusedOnce = false;
  const result = await run(['a', 'b'], async (to) => {
    calls.push({ to, at: clock.now() });
    if (to === 'a' && !refusedOnce) {
      refusedOnce = true;
      throw resendSendError({ name: 'rate_limit_exceeded', statusCode: 429, message: 'Too many requests' }, { 'retry-after': '2' });
    }
  }, clock);

  assert.deepEqual(result.sent, ['a', 'b']);
  assert.deepEqual(calls, [
    { to: 'a', at: 0 },
    { to: 'a', at: 2000 },
    // The wait held back the WHOLE run: b did not go out during a's pause.
    { to: 'b', at: 2250 },
  ]);
  assert.ok(result.lines.some((l) => l.includes('WAIT a: rate limited')));
});

test('a 429 that keeps coming moves the recipient to a retry round instead of looping', async () => {
  const clock = fakeClock();
  let calls = 0;
  const result = await run(['a'], async () => {
    calls += 1;
    if (calls <= 3) throw RATE_LIMITED();
  }, clock);

  assert.deepEqual(result.sent, ['a']);
  assert.equal(calls, 4, 'three on-the-spot attempts, then one in retry round 1');
  assert.ok(clock.sleeps.includes(DEFAULT_RETRY_DELAYS_MS[0]));
  assert.ok(result.lines.some((l) => l.includes('SENT a on retry 1')));
});

test('a daily or monthly quota 429 is not retried — it will not clear this morning', async () => {
  for (const name of ['daily_quota_exceeded', 'monthly_quota_exceeded']) {
    const clock = fakeClock();
    let calls = 0;
    const result = await run(['a'], async () => {
      calls += 1;
      throw resendSendError({ name, statusCode: 429, message: 'quota' }, {});
    }, clock);
    assert.equal(calls, 1, name);
    assert.equal(result.failed.length, 1, name);
    assert.deepEqual(clock.sleeps, [], `${name}: nothing to wait for`);
  }
});

// ── Retry rounds ────────────────────────────────────────────────────────────

test('no response at all is retried in a later round, after the rest of the list', async () => {
  const clock = fakeClock();
  const order: string[] = [];
  let failedOnce = false;
  const result = await run(['a', 'b', 'c'], async (to) => {
    order.push(to);
    if (to === 'a' && !failedOnce) {
      failedOnce = true;
      throw NO_RESPONSE();
    }
  }, clock);

  assert.deepEqual(order, ['a', 'b', 'c', 'a']);
  assert.deepEqual([...result.sent].sort(), ['a', 'b', 'c']);
  assert.equal(result.failed.length, 0);
  assert.ok(result.lines.some((l) => l.startsWith('  RETRY a: Resend error: Unable to fetch data')));
});

test('a 5xx is retried', async () => {
  const clock = fakeClock();
  let calls = 0;
  const result = await run(['a'], async () => {
    calls += 1;
    if (calls === 1) throw resendSendError({ name: 'internal_server_error', statusCode: 500, message: 'boom' }, {});
  }, clock);
  assert.deepEqual(result.sent, ['a']);
  assert.equal(calls, 2);
});

test('a bad address fails once and is never retried', async () => {
  const clock = fakeClock();
  let calls = 0;
  const result = await run(['bad', 'good'], async (to) => {
    calls += 1;
    if (to === 'bad') throw BAD_ADDRESS();
  }, clock);

  assert.equal(calls, 2);
  assert.deepEqual(result.sent, ['good']);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].item, 'bad');
  assert.ok(result.lines.includes('  FAIL bad: Resend error: Invalid `to` field.'));
  assert.ok(!clock.sleeps.includes(DEFAULT_RETRY_DELAYS_MS[0]), 'no retry round for a permanent failure');
});

test('an error that is not from Resend (a rendering bug) is not retried', async () => {
  const clock = fakeClock();
  let calls = 0;
  const result = await run(['a'], async () => {
    calls += 1;
    throw new TypeError('cannot read properties of undefined');
  }, clock);
  assert.equal(calls, 1);
  assert.equal(result.failed.length, 1);
});

test('a recipient that never gets through fails after the last round, with its last error', async () => {
  const clock = fakeClock();
  let calls = 0;
  const result = await run(['a'], async () => {
    calls += 1;
    throw NO_RESPONSE();
  }, clock);

  assert.equal(calls, 1 + DEFAULT_RETRY_DELAYS_MS.length);
  assert.equal(result.failed.length, 1);
  assert.ok(result.failed[0].error instanceof ResendSendError);
  assert.ok(result.lines.at(-1)!.endsWith('(no retries left)'));
  // The rounds stay well inside the unit's 15-minute TimeoutStartSec.
  const waited = DEFAULT_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
  assert.ok(waited <= 10 * 60_000);
});

test('rounds stop when the next one would land outside the send window', async () => {
  const clock = fakeClock();
  let calls = 0;
  const asked: number[] = [];
  const result = await run(['a', 'b'], async (to) => {
    calls += 1;
    if (to === 'a') throw NO_RESPONSE();
  }, clock, {
    mayRetryAt: (ms) => {
      asked.push(ms);
      return false;
    },
  });

  assert.equal(calls, 2, 'no second attempt for a');
  assert.deepEqual(result.sent, ['b']);
  assert.equal(result.failed.length, 1);
  assert.ok(!clock.sleeps.includes(DEFAULT_RETRY_DELAYS_MS[0]), 'did not sit out a delay it was never going to use');
  assert.equal(asked.length, 1);
  assert.ok(asked[0] >= DEFAULT_RETRY_DELAYS_MS[0], 'asked about the instant the round would START');
  assert.ok(result.lines.some((l) => l.includes('outside the send window')));
});

test('with no retry rounds configured, a retryable failure fails at once', async () => {
  const clock = fakeClock();
  const result = await run(['a'], async () => {
    throw NO_RESPONSE();
  }, clock, { retryDelaysMs: [] });
  assert.equal(result.failed.length, 1);
  assert.deepEqual(clock.sleeps, []);
});

test('every recipient ends up in exactly one of sent or failed', async () => {
  const clock = fakeClock();
  const items = ['ok1', 'bad', 'flaky', 'ok2', 'dead'];
  const tries = new Map<string, number>();
  const result = await run(items, async (to) => {
    tries.set(to, (tries.get(to) ?? 0) + 1);
    if (to === 'bad') throw BAD_ADDRESS();
    if (to === 'dead') throw NO_RESPONSE();
    if (to === 'flaky' && tries.get(to)! < 3) throw NO_RESPONSE();
  }, clock);

  const sent = [...result.sent].sort();
  const failed = result.failed.map((f) => f.item).sort();
  assert.deepEqual(sent, ['flaky', 'ok1', 'ok2']);
  assert.deepEqual(failed, ['bad', 'dead']);
  assert.equal(new Set([...sent, ...failed]).size, items.length);
  // A delivered recipient is never sent again in a later round.
  assert.equal(tries.get('ok1'), 1);
  assert.equal(tries.get('ok2'), 1);
  assert.equal(tries.get('flaky'), 3);
});

// ── Classification ──────────────────────────────────────────────────────────

test('the SDK error becomes a typed error with the same message the mailer always threw', () => {
  const err = RATE_LIMITED();
  assert.ok(err instanceof ResendSendError);
  assert.ok(err instanceof Error);
  assert.equal(err.statusCode, 429);
  assert.equal(err.code, 'rate_limit_exceeded');
  assert.equal(err.retryAfterMs, 1000);
  assert.ok(err.message.startsWith('Resend error: Too many requests. You can only make 10 requests per second.'));
});

test('a rate-limit body without a statusCode is still a 429, not "no response"', () => {
  const err = resendSendError({ name: 'rate_limit_exceeded', message: 'Too many requests' }, {});
  assert.equal(err.statusCode, 429);
  assert.ok(isRateLimited(err));
});

test('which failures are retryable', () => {
  const mk = (name: string, statusCode: number | null) => resendSendError({ name, statusCode, message: name }, {});
  const yes: Array<[string, number | null]> = [
    ['rate_limit_exceeded', 429],
    ['application_error', null],
    ['application_error', 500],
    ['internal_server_error', 500],
    ['service_unavailable', 503],
    ['application_error', 502],
    ['concurrent_idempotent_requests', 409],
  ];
  const no: Array<[string, number | null]> = [
    ['daily_quota_exceeded', 429],
    ['monthly_quota_exceeded', 429],
    ['validation_error', 422],
    ['validation_error', 403],
    ['invalid_from_address', 422],
    ['invalid_api_key', 403],
    ['missing_api_key', 401],
    ['invalid_idempotent_request', 409],
    ['not_found', 404],
  ];
  for (const [name, status] of yes) assert.equal(isRetryable(mk(name, status)), true, `${name} ${status}`);
  for (const [name, status] of no) assert.equal(isRetryable(mk(name, status)), false, `${name} ${status}`);
  assert.equal(isRetryable(new Error('Resend error: Too many requests')), false, 'only typed errors are classified');
  assert.equal(isRetryable(null), false);
});

test('retry-after and ratelimit-reset are seconds; either casing works; junk is ignored', () => {
  assert.equal(parseRetryAfterMs({ 'retry-after': '1' }), 1000);
  assert.equal(parseRetryAfterMs({ 'retry-after': '0.5' }), 500);
  assert.equal(parseRetryAfterMs({ 'Retry-After': '3' }), 3000);
  assert.equal(parseRetryAfterMs({ 'ratelimit-reset': '2' }), 2000);
  assert.equal(parseRetryAfterMs({ 'retry-after': '4', 'ratelimit-reset': '1' }), 4000, 'retry-after wins');
  assert.equal(parseRetryAfterMs({ 'retry-after': 'soon', 'ratelimit-reset': '2' }), 2000);
  assert.equal(parseRetryAfterMs({ 'retry-after': '-1' }), null);
  assert.equal(parseRetryAfterMs({}), null);
  assert.equal(parseRetryAfterMs(null), null);
});

test('the wait after a 429: what Resend asked for, at least a second, at most a minute', () => {
  const asked = (seconds: string) =>
    resendSendError({ name: 'rate_limit_exceeded', statusCode: 429, message: 'x' }, { 'retry-after': seconds });
  assert.equal(rateLimitWaitMs(asked('2'), 1), 2000);
  assert.equal(rateLimitWaitMs(asked('0'), 1), 1000);
  assert.equal(rateLimitWaitMs(asked('3600'), 1), MAX_RATE_LIMIT_WAIT_MS);

  const silent = resendSendError({ name: 'rate_limit_exceeded', statusCode: 429, message: 'x' }, {});
  assert.deepEqual([1, 2, 3].map((n) => rateLimitWaitMs(silent, n)), [1000, 2000, 4000]);
});
