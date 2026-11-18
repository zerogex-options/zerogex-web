import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_TIERS, isApiKeyEligibleTier, normalizeTier } from '../core/auth.ts';
import type { TierId } from '../core/auth.ts';
import { emailLocalPart } from '../core/apiKeyNaming.ts';
import { pauseRevokesApiKeys } from '../core/subscriptionPause.ts';

// core/apiKeyAdmin.ts reads the backend's base URL at module load, so the env
// goes first. Every call it makes in these tests is answered by a stubbed fetch.
process.env.ZEROGEX_API_BASE_URL = 'http://keys.zerogex.test';
process.env.ZEROGEX_API_TOKEN = 'test-bearer';
process.env.ZEROGEX_ADMIN_TOKEN = 'test-admin';
const keyAdmin = await import('../core/apiKeyAdmin.ts');

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

// ── A pause revokes; it can't suspend ────────────────────────────────────────
// A paused subscription grants nothing, so the webhook moves the member to
// public and revokeApiKeysIfTierDropped runs on that drop. The key service can
// revoke every key but has no way to suspend or restore one, so a Pro member's
// key is gone for good, and the pause flow says so to exactly the members
// pauseRevokesApiKeys picks. Hold that warning to the revocation itself.

test('a pause revokes keys for exactly the plans pauseRevokesApiKeys warns', async (t) => {
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    calls.push(`${init?.method ?? 'GET'} ${url.host}${url.pathname} ${String(init?.body ?? '')}`);
    return new Response(JSON.stringify({ revoked: 1 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
  t.after(() => {
    globalThis.fetch = realFetch;
  });

  for (const { id: tier } of AUTH_TIERS) {
    calls.length = 0;
    // What the webhook runs when a member on `tier` pauses: the pause grants
    // nothing, so the next tier is public.
    const result = await keyAdmin.revokeApiKeysIfTierDropped('member@example.com', tier, 'public');
    const revoked = result.status === 'revoked';
    assert.equal(pauseRevokesApiKeys(tier), revoked, `${tier}: the warning and the revocation disagree`);
    assert.deepEqual(
      calls,
      revoked ? ['POST keys.zerogex.test/api/admin/api-keys/revoke-all {"user_id":"member@example.com"}'] : [],
      `${tier}: ${revoked ? 'one revoke-all' : 'no key-service call'}`,
    );
  }
});

test('the key client can revoke keys but has no way to suspend or restore one', () => {
  // The pause copy tells members their key "can't be turned back on". If a way
  // to suspend and restore keys is added here, suspend on pause and restore on
  // resume instead (a paused member must still get no API access), then
  // rewrite that copy and this test.
  const exports = Object.keys(keyAdmin);
  assert.ok(exports.includes('revokeAllApiKeys'));
  assert.deepEqual(
    exports.filter((name) => /suspend|restore|reactivat|unrevoke|resume/i.test(name)),
    [],
  );
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
