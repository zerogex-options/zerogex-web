// Unit tests for core/rateLimit.ts — the bounded fixed-window limiter behind
// both the public levels-email signup endpoint and the four auth limiters
// (login, signup, password reset, email-verification resend).
//
// Every case runs on an injected clock, so the suite is deterministic and
// never sleeps.
//
// The bounded-store cases are the reason this module exists. The auth
// limiters it replaced held their state in Maps that were never pruned — one
// entry per distinct key for the life of the process, on endpoints that are
// public and unauthenticated and therefore meet traffic from large address
// pools. Nothing reclaimed it short of a restart.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createFixedWindowLimiter } from '../core/rateLimit.ts';

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

test('clear() forgets one key without disturbing the others', () => {
  // This is what a successful login does. Without it, someone who mistypes
  // their password four times and then gets it right stays one attempt from
  // a lockout for the rest of the window.
  const rl = createFixedWindowLimiter({ windowMs: 60_000, max: 2 });
  rl.check('victim', T0);
  rl.check('victim', T0);
  rl.check('bystander', T0);
  assert.equal(rl.check('victim', T0).allowed, false);

  rl.clear('victim');
  assert.equal(rl.check('victim', T0).allowed, true, 'cleared key starts a fresh window');
  // The bystander's count is untouched: it had one of two, so one remains.
  assert.equal(rl.check('bystander', T0).allowed, true);
  assert.equal(rl.check('bystander', T0).allowed, false);
});

test('clear() on an unknown key is a no-op, not a throw', () => {
  const rl = createFixedWindowLimiter({ windowMs: 60_000, max: 1 });
  rl.clear('never-seen');
  assert.equal(rl.size(), 0);
});
