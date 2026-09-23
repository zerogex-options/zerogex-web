// The levels-email signup policy. The limiter's own mechanics are covered in
// tests/rateLimit.test.ts; this pins the numbers that endpoint ships with.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEVELS_SIGNUP_MAX_ATTEMPTS,
  LEVELS_SIGNUP_WINDOW_MS,
  levelsSignupLimiter,
} from '../core/levelsRateLimit.ts';

test('the shipped policy is five per hour, matching the signup limiter', () => {
  assert.equal(LEVELS_SIGNUP_MAX_ATTEMPTS, 5);
  assert.equal(LEVELS_SIGNUP_WINDOW_MS, 60 * 60 * 1000);
});

test('the shipped limiter enforces that policy', () => {
  const ip = `probe-${Date.now()}`;
  for (let i = 0; i < LEVELS_SIGNUP_MAX_ATTEMPTS; i += 1) {
    assert.equal(levelsSignupLimiter.check(ip).allowed, true, `attempt ${i + 1} should pass`);
  }
  assert.equal(levelsSignupLimiter.check(ip).allowed, false, 'the sixth is refused');
  levelsSignupLimiter.clear(ip);
});
