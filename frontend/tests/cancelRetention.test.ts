import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canOfferRetentionDiscount,
  discountAuditType,
  type RetentionOfferInput,
} from '../core/cancelRetention.ts';
import { dict as cancelFlowDict } from '../components/CancelRetentionModal.i18n.ts';
import { dict as accountDict } from '../app/account/page.i18n.ts';

// The in-app cancellation flow's two load-bearing decisions:
//   1. WHETHER the 25%-off save can still be offered (one-shot, live-sub only).
//   2. WHICH audit event a save writes — which directly governs whether the
//      growth-rate dashboard nets the save out. Getting (2) wrong silently
//      inflates or deflates the headline net-growth number, so lock the matrix.

function offer(over: Partial<RetentionOfferInput> = {}): RetentionOfferInput {
  return {
    subscriptionId: 'sub_123',
    subscriptionStatus: 'active',
    retentionOfferClaimedAt: null,
    ...over,
  };
}

test('offer eligibility: active and trialing subs with an unclaimed offer qualify', () => {
  assert.equal(canOfferRetentionDiscount(offer({ subscriptionStatus: 'active' })), true);
  assert.equal(canOfferRetentionDiscount(offer({ subscriptionStatus: 'trialing' })), true);
});

test('offer eligibility: an already-claimed one-shot offer is never re-offered', () => {
  assert.equal(
    canOfferRetentionDiscount(offer({ retentionOfferClaimedAt: '2026-01-01T00:00:00.000Z' })),
    false,
  );
});

test('offer eligibility: no subscription on file → no offer', () => {
  assert.equal(canOfferRetentionDiscount(offer({ subscriptionId: null })), false);
});

test('offer eligibility: non-live statuses are not offerable', () => {
  for (const status of ['past_due', 'canceled', 'unpaid', 'incomplete', 'paused', null]) {
    assert.equal(
      canOfferRetentionDiscount(offer({ subscriptionStatus: status })),
      false,
      `status ${status} should not be offerable`,
    );
  }
});

test('discount audit: already-canceling → win-back type that offsets a counted cancellation', () => {
  const d = discountAuditType(true);
  assert.equal(d.type, 'billing_winback_discount_honored');
  assert.equal(d.offsetsCountedCancellation, true);
});

test('discount audit: intercepted pre-cancel → distinct type with NO offset (no phantom net)', () => {
  const d = discountAuditType(false);
  assert.equal(d.type, 'billing_retention_offer_accepted');
  assert.equal(d.offsetsCountedCancellation, false);
});

// ── Pausing a Pro plan costs the member their API key ──────────────────────
// The pause revokes the key, and a revoked key can't come back
// (core/subscriptionPause.ts pauseRevokesApiKeys). A Pro member hears it on the
// pause step before picking a length (picking one is the confirmation), on the
// "paused" confirmation, and on the Account page's paused banner.

const PAUSE_TO_API_KEY_COPY: Array<[string, Record<string, Record<string, string> | undefined>, string, string[]]> = [
  ['cancel flow, pause step', cancelFlowDict, 'pauseBody', ['pauseApiKeyWarning']],
  ['cancel flow, paused confirmation', cancelFlowDict, 'pausedBody', ['pausedApiKeyNote']],
  ['Account page, paused banner', accountDict, 'subscriptionPaused', ['pausedApiKeyBefore', 'pausedApiKeyLink', 'pausedApiKeyAfter']],
];

test('pause copy: every locale that has the pause copy also has the API-key note', () => {
  for (const [where, dict, pauseKey, keyNoteKeys] of PAUSE_TO_API_KEY_COPY) {
    assert.ok(dict.en?.[pauseKey], `${where}: English has ${pauseKey}`);
    for (const [locale, strings] of Object.entries(dict)) {
      if (!strings?.[pauseKey]) continue;
      for (const key of keyNoteKeys) {
        assert.ok(strings[key], `${where} (${locale}): has ${pauseKey} but not ${key}`);
      }
    }
  }
});

test('pause copy (en): the key stops for good, and the new one comes from API Access', () => {
  const banner = [accountDict.en.pausedApiKeyBefore, accountDict.en.pausedApiKeyLink, accountDict.en.pausedApiKeyAfter].join(' ');
  for (const [where, line] of [
    ['pause step', cancelFlowDict.en.pauseApiKeyWarning],
    ['paused confirmation', cancelFlowDict.en.pausedApiKeyNote],
    ['paused banner', banner],
  ]) {
    assert.match(line, /API key/, `${where} names the API key`);
    assert.match(line, /can[’']t be turned back on/, `${where} says the old key won't come back`);
    assert.match(line, /new (one|key) (in|under) API Access/, `${where} says where to make a new one`);
  }
});

test('paused banner: its link lands on the API Access section of the Account page', () => {
  const page = fs.readFileSync(new URL('../app/account/page.tsx', import.meta.url), 'utf8');
  const section = fs.readFileSync(new URL('../components/AccountApiKeys.tsx', import.meta.url), 'utf8');
  assert.match(page, /<a href="#api-access"[^>]*>\s*\{t\('pausedApiKeyLink'\)\}/);
  assert.match(section, /id="api-access"/);
  // The section's heading, which the banner's link text and the cancel flow name.
  assert.match(section, /<\/span>\s*API Access\s*<\/h2>/);
  assert.equal(accountDict.en.pausedApiKeyLink, 'API Access');
});
