import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAcceptedTermsVersionCurrent,
  TERMS_VERSION,
  TERMS_EFFECTIVE_DATE_LABEL,
} from '../core/legalTerms.ts';

// The signup terms-acceptance gate. Both the register route and registerUser
// call this, and an account can only be created when it returns true, so a
// hole here is a signup with no usable record of what the member agreed to —
// which is the thing the acceptance column exists to prevent.

test('isAcceptedTermsVersionCurrent: the current version is accepted', () => {
  assert.equal(isAcceptedTermsVersionCurrent(TERMS_VERSION), true);
});

test('isAcceptedTermsVersionCurrent: a superseded version is rejected', () => {
  // A tab left open across a terms revision posts the version it rendered.
  // That member never saw the current text, so this must not pass.
  assert.equal(isAcceptedTermsVersionCurrent('2020-01-01'), false);
  assert.equal(isAcceptedTermsVersionCurrent('v1'), false);
});

test('isAcceptedTermsVersionCurrent: absent acceptance is rejected', () => {
  assert.equal(isAcceptedTermsVersionCurrent(undefined), false);
  assert.equal(isAcceptedTermsVersionCurrent(null), false);
  assert.equal(isAcceptedTermsVersionCurrent(''), false);
});

test('isAcceptedTermsVersionCurrent: non-string bodies are rejected, not coerced', () => {
  // The value comes off a JSON request body, so its TypeScript annotation is a
  // claim rather than a guarantee. Anything truthy-but-wrong must still fail.
  assert.equal(isAcceptedTermsVersionCurrent(true), false);
  assert.equal(isAcceptedTermsVersionCurrent(1), false);
  assert.equal(isAcceptedTermsVersionCurrent({ version: TERMS_VERSION }), false);
  assert.equal(isAcceptedTermsVersionCurrent([TERMS_VERSION]), false);
});

// The stored version identifies WHICH text was agreed to, so it has to be a
// real date that sorts and reads unambiguously — an opaque counter would make
// a years-old acceptance impossible to tie back to the wording it covered.
test('TERMS_VERSION is an ISO date', () => {
  assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(Number.isNaN(Date.parse(TERMS_VERSION)), false);
});

// /terms and /privacy render the label while acceptances record the ISO form.
// If the two drift, the site shows one effective date and the database claims
// members accepted another.
test('TERMS_VERSION and the rendered effective-date label agree', () => {
  const rendered = new Date(`${TERMS_VERSION}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  assert.equal(rendered, TERMS_EFFECTIVE_DATE_LABEL);
});
