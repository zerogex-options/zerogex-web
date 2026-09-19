// Unit tests for core/levelsRateLimit.ts.
//
// Every case runs on an injected clock, so the suite is deterministic and does
// not sleep. The bounded-store cases are the ones worth having: the limiters
// this one deliberately does not reuse (core/serverAuth.ts) never prune, and
// this endpoint is public and unauthenticated, so it is precisely the surface
// that meets traffic from a large number of distinct addresses.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEVELS_SIGNUP_MAX_ATTEMPTS,
  LEVELS_SIGNUP_WINDOW_MS,
  createFixedWindowLimiter,
} from '../core/levelsRateLimit.ts';

const T0 = 1_760_000_000_000;

test('requests are allowed up to the limit and refused after it', () => {
  const rl = createFixedWindowLimiter({ windowMs: 1000, max: 3 });
  assert.deepEqual(rl.check('ip', T0), { allowed: true, remaining: 2 });
  assert.deepEqual(rl.check('ip', T0), { allowed: true, remaining: 1 });
  assert.deepEqual(rl.check('ip', T0), { allowed: true, remaining: 0 });
  const blocked = rl.check('ip', T0);
  assert.equal(blocked.allowed, false);
  assert.equal(!blocked.allowed && blocked.retryAfterSeconds, 1);
});

test('the window drains and the caller recovers', () => {
  const rl = createFixedWindowLimiter({ windowMs: 1000, max: 1 });
  rl.check('ip', T0);
  assert.equal(rl.check('ip', T0 + 500).allowed, false);
  assert.equal(rl.check('ip', T0 + 1001).allowed, true);
});

test('a blocked caller cannot hold the window open by retrying', () => {
  // The bug a sliding window would introduce: each rejected attempt pushing
  // resetAt out, so a steady trickle is locked out forever with no recovery
  // time it could wait for.
  const rl = createFixedWindowLimiter({ windowMs: 1000, max: 1 });
  rl.check('ip', T0);
  for (let t = T0 + 100; t < T0 + 1000; t += 100) rl.check('ip', t);
  assert.equal(rl.check('ip', T0 + 1001).allowed, true);
});

test('keys are independent — one noisy address does not block everyone', () => {
  const rl = createFixedWindowLimiter({ windowMs: 1000, max: 1 });
  rl.check('1.1.1.1', T0);
  assert.equal(rl.check('1.1.1.1', T0).allowed, false);
  assert.equal(rl.check('2.2.2.2', T0).allowed, true);
});

test('retryAfterSeconds is always at least one second, never zero', () => {
  // A 0 would render as "Retry-After: 0", which a client reads as "retry
  // immediately" and turns a rate limit into a hot loop.
  const rl = createFixedWindowLimiter({ windowMs: 1000, max: 1 });
  rl.check('ip', T0);
  const v = rl.check('ip', T0 + 999);
  assert.equal(v.allowed, false);
  assert.ok(!v.allowed && v.retryAfterSeconds >= 1);
});

test('expired entries are pruned so the store cannot grow without bound', () => {
  const rl = createFixedWindowLimiter({ windowMs: 1000, max: 5, maxKeys: 10 });
  for (let i = 0; i < 10; i += 1) rl.check(`ip-${i}`, T0);
  assert.equal(rl.size(), 10);
  // A later arrival finds the store at its ceiling; every existing window has
  // elapsed, so the prune reclaims all of them.
  rl.check('ip-new', T0 + 5000);
  assert.ok(rl.size() <= 10, `store grew to ${rl.size()}`);
  assert.equal(rl.check('ip-new', T0 + 5000).allowed, true);
});

test('a flood of simultaneous distinct keys is capped by eviction', () => {
  // Nothing has expired here, so pruning frees nothing and eviction is the
  // only thing standing between this and unbounded growth.
  const rl = createFixedWindowLimiter({ windowMs: 60_000, max: 5, maxKeys: 50 });
  for (let i = 0; i < 500; i += 1) rl.check(`ip-${i}`, T0);
  assert.ok(rl.size() <= 50, `store grew to ${rl.size()}`);
});

test('eviction never lets a key escape its own live limit while it is tracked', () => {
  const rl = createFixedWindowLimiter({ windowMs: 60_000, max: 2, maxKeys: 100 });
  rl.check('victim', T0);
  rl.check('victim', T0);
  assert.equal(rl.check('victim', T0).allowed, false);
});

test('reset clears the store', () => {
  const rl = createFixedWindowLimiter({ windowMs: 1000, max: 1 });
  rl.check('ip', T0);
  rl.reset();
  assert.equal(rl.size(), 0);
  assert.equal(rl.check('ip', T0).allowed, true);
});

test('the shipped policy is five per hour, matching the signup limiter', () => {
  assert.equal(LEVELS_SIGNUP_MAX_ATTEMPTS, 5);
  assert.equal(LEVELS_SIGNUP_WINDOW_MS, 60 * 60 * 1000);
});
