import test from 'node:test';
import assert from 'node:assert/strict';
import { isApiKeyEligibleTier, normalizeTier } from '../core/auth.ts';
import type { TierId } from '../core/auth.ts';
import { emailLocalPart } from '../core/apiKeyNaming.ts';

// ── Eligibility ──────────────────────────────────────────────────────────────
// Self-service API keys are a Pro benefit: Pro and admin qualify; public and
// basic do not. This gate drives both the account UI and — critically — the
// auto-revoke-on-tier-drop decision, so lock it down.

test('isApiKeyEligibleTier: only pro and admin are eligible', () => {
  assert.equal(isApiKeyEligibleTier('public'), false);
  assert.equal(isApiKeyEligibleTier('basic'), false);
  assert.equal(isApiKeyEligibleTier('pro'), true);
  assert.equal(isApiKeyEligibleTier('admin'), true);
});

test('isApiKeyEligibleTier: legacy tier ids fold correctly', () => {
  // normalizeTier maps legacy ids; elite→pro (eligible), starter→basic (not).
  assert.equal(isApiKeyEligibleTier(normalizeTier('elite')), true);
  assert.equal(isApiKeyEligibleTier(normalizeTier('starter')), false);
});

// The transition that must trigger auto-revocation: previously eligible, now
// not. Mirrors revokeApiKeysIfTierDropped's guard.
test('tier-drop detection: eligible → ineligible is the only revoke trigger', () => {
  const dropped = (prev: TierId, next: TierId) =>
    isApiKeyEligibleTier(prev) && !isApiKeyEligibleTier(next);

  // Drops out of Pro → revoke.
  assert.equal(dropped('pro', 'basic'), true);
  assert.equal(dropped('pro', 'public'), true);
  assert.equal(dropped('admin', 'public'), true);

  // Not drops → no revoke.
  assert.equal(dropped('pro', 'pro'), false);
  assert.equal(dropped('pro', 'admin'), false); // still eligible
  assert.equal(dropped('basic', 'public'), false); // wasn't eligible
  assert.equal(dropped('public', 'pro'), false); // an upgrade
});

// ── Name derivation ──────────────────────────────────────────────────────────
// The key's base label is the email local-part (before '@'); the incrementing
// suffix on collision is handled server-side by the backend.

test('emailLocalPart: takes everything before the first @', () => {
  assert.equal(emailLocalPart('alice@example.com'), 'alice');
  assert.equal(emailLocalPart('john.doe@sub.example.co.uk'), 'john.doe');
  assert.equal(emailLocalPart('a+tag@example.com'), 'a+tag');
});

test('emailLocalPart: normalizes case and whitespace', () => {
  assert.equal(emailLocalPart('  Alice@Example.com '), 'alice');
  assert.equal(emailLocalPart('MixedCase@x.io'), 'mixedcase');
});

test('emailLocalPart: falls back to "key" for a missing local-part', () => {
  assert.equal(emailLocalPart('@example.com'), 'key');
  assert.equal(emailLocalPart(''), 'key');
});
