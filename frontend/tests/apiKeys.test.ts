import test from 'node:test';
import assert from 'node:assert/strict';
import { isApiKeyEligibleTier, normalizeTier } from '../core/auth.ts';
import type { TierId } from '../core/auth.ts';
import {
  MAX_KEY_LABEL_LENGTH,
  emailLocalPart,
  formatLastUsed,
  resolveKeyLabel,
  sanitizeKeyLabel,
} from '../core/apiKeyNaming.ts';
import { MAX_ACTIVE_API_KEYS } from '../core/apiKeyLimits.ts';

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
// The key's base label is the user's device label, falling back to the email
// local-part (before '@'); the incrementing suffix on collision is handled
// server-side by the backend.

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

// ── Device labels ────────────────────────────────────────────────────────────
// A key's label is user-typed now ("desktop", "NinjaTrader"), which is what
// makes several concurrent keys usable — you can tell which machine is which.
// It is free text landing in a column and echoed back into the UI, so it gets
// sanitised on the way in (the backend sanitises again; this is the pair that
// keeps the UI honest about what will be stored).

test('sanitizeKeyLabel: keeps an ordinary label untouched, case and all', () => {
  assert.equal(sanitizeKeyLabel('desktop'), 'desktop');
  assert.equal(sanitizeKeyLabel('NinjaTrader'), 'NinjaTrader');
  assert.equal(sanitizeKeyLabel('Mac mini (office)'), 'Mac mini (office)');
});

test('sanitizeKeyLabel: trims, collapses whitespace, drops control characters', () => {
  assert.equal(sanitizeKeyLabel('  home   desk  '), 'home desk');
  assert.equal(sanitizeKeyLabel('desk	top'), 'desk top');
  assert.equal(sanitizeKeyLabel('a\u0000b'), 'a b');
});

test('sanitizeKeyLabel: returns empty for an unusable label so the caller can fall back', () => {
  assert.equal(sanitizeKeyLabel(''), '');
  assert.equal(sanitizeKeyLabel('   '), '');
  assert.equal(sanitizeKeyLabel('\u0000\u0007'), '');
});

test('sanitizeKeyLabel: caps length', () => {
  assert.equal(sanitizeKeyLabel('x'.repeat(500)).length, MAX_KEY_LABEL_LENGTH);
});

test('resolveKeyLabel: falls back to the email local-part when no label is given', () => {
  // Preserves the pre-label naming for anyone who doesn't name their machines.
  assert.equal(resolveKeyLabel('Alice@Example.com', ''), 'alice');
  assert.equal(resolveKeyLabel('alice@example.com', null), 'alice');
  assert.equal(resolveKeyLabel('alice@example.com', '   '), 'alice');
  // A real label wins, exactly as typed.
  assert.equal(resolveKeyLabel('alice@example.com', ' NinjaTrader '), 'NinjaTrader');
});

// ── "Last used" ──────────────────────────────────────────────────────────────
// The signal that would have saved the support thread this feature came from:
// a user who can't remember whether a key is live reads it here instead of
// regenerating to find out (which, under the old one-key rule, killed it).

const NOW = Date.parse('2026-08-25T12:00:00Z');

test('formatLastUsed: a key that never authenticated says so plainly', () => {
  assert.equal(formatLastUsed(null, NOW), 'never used');
  assert.equal(formatLastUsed(undefined, NOW), 'never used');
  // An unparseable timestamp is reported as unused rather than as "NaN ago".
  assert.equal(formatLastUsed('not-a-date', NOW), 'never used');
});

test('formatLastUsed: picks the largest whole unit and pluralises it', () => {
  assert.equal(formatLastUsed('2026-08-25T11:59:30Z', NOW), 'last used just now');
  assert.equal(formatLastUsed('2026-08-25T11:59:00Z', NOW), 'last used 1 minute ago');
  assert.equal(formatLastUsed('2026-08-25T11:58:00Z', NOW), 'last used 2 minutes ago');
  assert.equal(formatLastUsed('2026-08-25T11:00:00Z', NOW), 'last used 1 hour ago');
  assert.equal(formatLastUsed('2026-08-25T10:00:00Z', NOW), 'last used 2 hours ago');
  assert.equal(formatLastUsed('2026-08-24T12:00:00Z', NOW), 'last used 1 day ago');
  assert.equal(formatLastUsed('2026-08-18T12:00:00Z', NOW), 'last used 7 days ago');
  assert.equal(formatLastUsed('2026-07-01T12:00:00Z', NOW), 'last used 1 month ago');
  assert.equal(formatLastUsed('2025-01-01T12:00:00Z', NOW), 'last used 1 year ago');
});

test('formatLastUsed: clock skew never reads as a future use', () => {
  // The API host's clock running ahead of the browser's must not render
  // "last used in 30 seconds" on a key that was just used.
  assert.equal(formatLastUsed('2026-08-25T12:00:30Z', NOW), 'last used just now');
});

// ── The active-key cap ───────────────────────────────────────────────────────

test('MAX_ACTIVE_API_KEYS: enough for the machines this exists to serve', () => {
  // Desktop + laptop + NinjaTrader. The BFF enforces this before calling the
  // key service, and the key service enforces it again — the UI is never the
  // only thing standing between a user and an unbounded key count.
  assert.equal(MAX_ACTIVE_API_KEYS, 3);
});
