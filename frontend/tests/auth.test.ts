import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRequiredTier, requiredTierForRoute, normalizeTier } from '../core/auth.ts';
import { getOAuthStateCookieName } from '../core/oauth.ts';

test('public routes do not require auth tier', () => {
  assert.equal(requiredTierForRoute('/'), null);
  assert.equal(requiredTierForRoute('/about'), null);
  assert.equal(requiredTierForRoute('/login'), null);
});

test('tier requirement mapping resolves expected values', () => {
  assert.equal(requiredTierForRoute('/dashboard'), 'basic');
  assert.equal(requiredTierForRoute('/signal-score'), 'pro');
  assert.equal(requiredTierForRoute('/greeks-gex'), 'admin');
});

test('hasRequiredTier enforces role hierarchy', () => {
  assert.equal(hasRequiredTier('/dashboard', 'basic'), true);
  assert.equal(hasRequiredTier('/dashboard', 'public'), false);
  assert.equal(hasRequiredTier('/signal-score', 'basic'), false);
  assert.equal(hasRequiredTier('/signal-score', 'pro'), true);
  assert.equal(hasRequiredTier('/greeks-gex', 'admin'), true);
});

test('normalizeTier falls back safely', () => {
  assert.equal(normalizeTier(undefined), 'public');
  assert.equal(normalizeTier('not-a-tier'), 'public');
  assert.equal(normalizeTier('pro'), 'pro');
});

test('oauth state cookies are provider scoped', () => {
  assert.equal(getOAuthStateCookieName('google'), 'zgx_oauth_state_google');
  assert.equal(getOAuthStateCookieName('apple'), 'zgx_oauth_state_apple');
});
