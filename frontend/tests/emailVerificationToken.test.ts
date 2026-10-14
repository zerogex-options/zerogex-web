import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyVerificationToken } from '../core/emailVerificationToken.ts';

const NOW = Date.parse('2026-10-14T12:00:00.000Z');
const LATER = '2026-10-15T12:00:00.000Z';
const EARLIER = '2026-10-13T12:00:00.000Z';
const VERIFIED = '2026-10-14T11:59:59.800Z';

test('an unknown token is invalid', () => {
  assert.equal(classifyVerificationToken(undefined, NOW), 'invalid');
  assert.equal(classifyVerificationToken(null, NOW), 'invalid');
});

test('an unused, in-date token verifies', () => {
  assert.equal(
    classifyVerificationToken({ expires_at: LATER, consumed_at: null, email_verified_at: null }, NOW),
    'verify',
  );
});

test('a link a scanner or a double click already used shows verified, not an error', () => {
  // 2026-09-27: Outlook Safe Links used the token 0.2s before the member's click.
  assert.equal(
    classifyVerificationToken({ expires_at: LATER, consumed_at: VERIFIED, email_verified_at: VERIFIED }, NOW),
    'already_verified_used',
  );
  // Still verified when the used link is opened again after it would have expired.
  assert.equal(
    classifyVerificationToken({ expires_at: EARLIER, consumed_at: EARLIER, email_verified_at: EARLIER }, NOW),
    'already_verified_used',
  );
});

test('an older email opened after a newer one verified the account shows verified', () => {
  // Its token was marked used when the newer link verified the account.
  assert.equal(
    classifyVerificationToken({ expires_at: LATER, consumed_at: VERIFIED, email_verified_at: VERIFIED }, NOW),
    'already_verified_used',
  );
  // An unused token past its expiry, on an account verified some other way.
  assert.equal(
    classifyVerificationToken({ expires_at: EARLIER, consumed_at: null, email_verified_at: VERIFIED }, NOW),
    'already_verified_expired',
  );
});

test('an unverified account still gets the expired and invalid messages', () => {
  assert.equal(
    classifyVerificationToken({ expires_at: EARLIER, consumed_at: null, email_verified_at: null }, NOW),
    'expired',
  );
  assert.equal(
    classifyVerificationToken({ expires_at: LATER, consumed_at: EARLIER, email_verified_at: null }, NOW),
    'invalid',
  );
});

test('a token expiring exactly now counts as expired', () => {
  assert.equal(
    classifyVerificationToken(
      { expires_at: new Date(NOW).toISOString(), consumed_at: null, email_verified_at: null },
      NOW,
    ),
    'expired',
  );
});
