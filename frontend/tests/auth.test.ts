import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRequiredTier, requiredTierForRoute, normalizeTier } from '../core/auth.ts';
import { getOAuthNonceCookieName, getOAuthStateCookieName } from '../core/oauth.ts';

process.env.NEXT_PUBLIC_AUTH_ENABLED = '1';

test('public routes do not require auth tier', () => {
  assert.equal(requiredTierForRoute('/'), null);
  assert.equal(requiredTierForRoute('/about'), null);
  assert.equal(requiredTierForRoute('/login'), null);
});

test('tier requirement mapping resolves expected values', () => {
  assert.equal(requiredTierForRoute('/dashboard'), null);
  assert.equal(requiredTierForRoute('/signal-score'), 'elite');
  assert.equal(requiredTierForRoute('/basic-signals'), 'pro');
  assert.equal(requiredTierForRoute('/tape-flow-bias'), 'pro');
  assert.equal(requiredTierForRoute('/greeks-gex'), null);
});

test('hasRequiredTier enforces role hierarchy', () => {
  assert.equal(hasRequiredTier('/dashboard', 'starter'), true);
  assert.equal(hasRequiredTier('/dashboard', 'public'), true);
  assert.equal(hasRequiredTier('/basic-signals', 'starter'), false);
  assert.equal(hasRequiredTier('/basic-signals', 'pro'), true);
  assert.equal(hasRequiredTier('/signal-score', 'pro'), false);
  assert.equal(hasRequiredTier('/signal-score', 'elite'), true);
  assert.equal(hasRequiredTier('/signal-score', 'admin'), true);
  assert.equal(hasRequiredTier('/greeks-gex', 'public'), true);
});

test('normalizeTier falls back safely and remaps legacy basic', () => {
  assert.equal(normalizeTier(undefined), 'public');
  assert.equal(normalizeTier('not-a-tier'), 'public');
  assert.equal(normalizeTier('pro'), 'pro');
  assert.equal(normalizeTier('elite'), 'elite');
  assert.equal(normalizeTier('starter'), 'starter');
  assert.equal(normalizeTier('basic'), 'starter');
});

test('oauth state cookies are provider scoped', () => {
  assert.equal(getOAuthStateCookieName('google'), 'zgx_oauth_state_google');
  assert.equal(getOAuthStateCookieName('apple'), 'zgx_oauth_state_apple');
  assert.equal(getOAuthNonceCookieName('google'), 'zgx_oauth_nonce_google');
  assert.equal(getOAuthNonceCookieName('apple'), 'zgx_oauth_nonce_apple');
});

test('tier gates bypass when NEXT_PUBLIC_AUTH_ENABLED is not 1', () => {
  const previous = process.env.NEXT_PUBLIC_AUTH_ENABLED;
  try {
    process.env.NEXT_PUBLIC_AUTH_ENABLED = '0';
    assert.equal(hasRequiredTier('/dashboard', 'public'), true);
    assert.equal(hasRequiredTier('/greeks-gex', 'public'), true);
    assert.equal(hasRequiredTier('/signal-score', undefined), true);
  } finally {
    process.env.NEXT_PUBLIC_AUTH_ENABLED = previous;
  }
});
