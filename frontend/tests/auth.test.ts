import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRequiredTier, requiredTierForRoute, normalizeTier } from '../core/auth.ts';
import { getOAuthNonceCookieName, getOAuthStateCookieName } from '../core/oauth.ts';

process.env.NEXT_PUBLIC_AUTH_ENABLED = '1';

test('public routes do not require auth tier', () => {
  assert.equal(requiredTierForRoute('/'), null);
  assert.equal(requiredTierForRoute('/about'), null);
  assert.equal(requiredTierForRoute('/login'), null);
  assert.equal(requiredTierForRoute('/register'), null);
  assert.equal(requiredTierForRoute('/pricing'), null);
  assert.equal(requiredTierForRoute('/founding'), null);
  assert.equal(requiredTierForRoute('/forgot-password'), null);
  assert.equal(requiredTierForRoute('/reset-password'), null);
});

test('tier requirement mapping resolves expected values', () => {
  assert.equal(requiredTierForRoute('/dashboard'), 'basic');
  assert.equal(requiredTierForRoute('/signal-score'), 'pro');
  assert.equal(requiredTierForRoute('/basic-signals'), 'basic');
  assert.equal(requiredTierForRoute('/tape-flow-bias'), 'basic');
  assert.equal(requiredTierForRoute('/greeks-gex'), 'basic');
  assert.equal(requiredTierForRoute('/max-pain'), 'basic');
  assert.equal(requiredTierForRoute('/intraday-tools'), 'basic');
  assert.equal(requiredTierForRoute('/options-calculator'), 'basic');
  assert.equal(requiredTierForRoute('/range-break-imminence'), 'pro');
  assert.equal(requiredTierForRoute('/account'), 'public');
});

test('hasRequiredTier enforces role hierarchy', () => {
  assert.equal(hasRequiredTier('/dashboard', 'basic'), true);
  assert.equal(hasRequiredTier('/dashboard', 'public'), false);
  assert.equal(hasRequiredTier('/basic-signals', 'public'), false);
  assert.equal(hasRequiredTier('/basic-signals', 'basic'), true);
  assert.equal(hasRequiredTier('/basic-signals', 'pro'), true);
  assert.equal(hasRequiredTier('/signal-score', 'basic'), false);
  assert.equal(hasRequiredTier('/signal-score', 'pro'), true);
  assert.equal(hasRequiredTier('/signal-score', 'admin'), true);
  assert.equal(hasRequiredTier('/greeks-gex', 'public'), false);
  assert.equal(hasRequiredTier('/greeks-gex', 'basic'), true);
  assert.equal(hasRequiredTier('/range-break-imminence', 'basic'), false);
  assert.equal(hasRequiredTier('/range-break-imminence', 'pro'), true);
  // /account uses minimumTier='public' so the page exists for unpaid users
  // to manage credentials, but the middleware's session check still bounces
  // fully anonymous visitors to /login.
  assert.equal(hasRequiredTier('/account', 'public'), true);
  assert.equal(hasRequiredTier('/account', 'basic'), true);
});

test('normalizeTier falls back safely and remaps legacy tiers', () => {
  assert.equal(normalizeTier(undefined), 'public');
  assert.equal(normalizeTier('not-a-tier'), 'public');
  assert.equal(normalizeTier('basic'), 'basic');
  assert.equal(normalizeTier('pro'), 'pro');
  assert.equal(normalizeTier('admin'), 'admin');
  assert.equal(normalizeTier('starter'), 'basic');
  assert.equal(normalizeTier('elite'), 'pro');
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
