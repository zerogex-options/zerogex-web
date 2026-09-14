import test from 'node:test';
import assert from 'node:assert/strict';
import { needsTermsAcceptance, TERMS_VERSION } from '../core/legalTerms.ts';
import type { TermsAcceptanceUser } from '../core/legalTerms.ts';

// The gate behind the terms-acceptance modal (components/ClientLayout). It
// decides who gets asked to accept the Terms of Service and Privacy Policy
// after signing in, so a hole here is either a member charged with no record of
// what they agreed to, or the whole paying base interrupted for no reason.

test('needsTermsAcceptance: an account with no recorded acceptance is asked', () => {
  // The condition this exists for. Every account created before the signup
  // checkbox shipped, and every Google/Apple signup, carries NULL here — the
  // callback that mints those accounts has no checkbox to read.
  assert.equal(needsTermsAcceptance({ termsVersionAccepted: null }), true);
  assert.equal(needsTermsAcceptance({ termsVersionAccepted: undefined }), true);
  assert.equal(needsTermsAcceptance({}), true);
});

test('needsTermsAcceptance: an account on the published version is left alone', () => {
  assert.equal(needsTermsAcceptance({ termsVersionAccepted: TERMS_VERSION }), false);
});

test('needsTermsAcceptance: a superseded acceptance is asked again', () => {
  // What makes a terms revision work: bump TERMS_VERSION and everyone
  // re-accepts, rather than the new text landing on members who never saw it.
  assert.equal(needsTermsAcceptance({ termsVersionAccepted: '2020-01-01' }), true);
  assert.equal(needsTermsAcceptance({ termsVersionAccepted: 'v1' }), true);
});

test('needsTermsAcceptance: an empty string is not an acceptance', () => {
  // A blank column is the same absence as NULL; nothing may read it as consent.
  assert.equal(needsTermsAcceptance({ termsVersionAccepted: '' }), true);
});

test('needsTermsAcceptance: a signed-out visitor is never asked', () => {
  assert.equal(needsTermsAcceptance(null), false);
  assert.equal(needsTermsAcceptance(undefined), false);
});

test('needsTermsAcceptance: a non-string value is not coerced into consent', () => {
  // The value reaches the client as JSON from /api/auth/session, so its
  // TypeScript annotation is a claim about the shape rather than a guarantee.
  // Anything truthy-but-wrong must still be treated as no acceptance.
  const wrong = [true, 1, {}, [TERMS_VERSION]];
  for (const value of wrong) {
    assert.equal(
      needsTermsAcceptance({ termsVersionAccepted: value } as unknown as TermsAcceptanceUser),
      true,
    );
  }
});
