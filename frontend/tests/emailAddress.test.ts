// Unit tests for core/emailAddress.ts: the "could this ever be an address?"
// check behind the signup form, the free levels-email form, and the
// verify-reminder job's skip. The older cases (whitespace, commas, a dotless
// domain, the length ceiling) stay in tests/levelsEmail.test.ts, which reaches
// the same function through the levels re-export.

import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeEmail } from '../core/emailAddress.ts';
import { normalizeEmail as levelsNormalizeEmail } from '../core/levelsEmail.ts';

test('normalizeEmail rejects a dot at either end of either half, or two in a row', () => {
  for (const bad of [
    // 2026-11-24: a signup with a dot right before the @ got an account, and
    // the verify-reminder job failed on it every 2 hours.
    'first.last.@gmail.com',
    '.name@gmail.com',
    'first..last@gmail.com',
    'name@.gmail.com',
    'name@gmail..com',
    'name@gmail.com.',
    '  Name.@Gmail.com  ',
  ]) {
    assert.equal(normalizeEmail(bad), null, `should reject: ${bad}`);
  }
});

test('normalizeEmail still accepts dots between characters', () => {
  assert.equal(normalizeEmail('First.Last@Gmail.com'), 'first.last@gmail.com');
  assert.equal(normalizeEmail('first.middle.last@mail.example.co.uk'), 'first.middle.last@mail.example.co.uk');
  assert.equal(normalizeEmail('a.b-c_d@sub.example.co.uk'), 'a.b-c_d@sub.example.co.uk');
  assert.equal(normalizeEmail('trader+spx@example.museum'), 'trader+spx@example.museum');
  assert.equal(normalizeEmail('a@b.co'), 'a@b.co');
});

test('the levels-email form applies the same check as the signup form', () => {
  assert.equal(levelsNormalizeEmail, normalizeEmail);
});
