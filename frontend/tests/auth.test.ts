import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRequiredTier, requiredTierForRoute, normalizeTier } from '../core/auth.ts';
import { generateKeyPairSync, verify } from 'node:crypto';
import { getAppleClientSecret, getOAuthNonceCookieName, getOAuthStateCookieName, isAppleOAuthConfigured } from '../core/oauth.ts';
import { createLinkTicket, isLinkTicketAvailable, readLinkTicket } from '../core/oauthLinkTicket.ts';

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

// --- Sign in with Apple ----------------------------------------------------

function withAppleEnv<T>(overrides: Record<string, string | undefined>, run: () => T): T {
  const keys = ['APPLE_CLIENT_ID', 'APPLE_REDIRECT_URI', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY', 'APPLE_CLIENT_SECRET'];
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const key of keys) delete process.env[key];
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) process.env[key] = value;
    }
    return run();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key] as string;
    }
  }
}

function appleTestKey() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    pem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKey,
  };
}

function fromBase64Url(segment: string) {
  const pad = segment.length % 4 === 0 ? '' : '='.repeat(4 - (segment.length % 4));
  return Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

test('apple oauth reports configured only with a full credential set', () => {
  withAppleEnv({}, () => assert.equal(isAppleOAuthConfigured(), false));
  // Client id + redirect URI alone cannot complete the token exchange.
  withAppleEnv({ APPLE_CLIENT_ID: 'com.example.web', APPLE_REDIRECT_URI: 'https://x.test/cb' }, () =>
    assert.equal(isAppleOAuthConfigured(), false)
  );
  withAppleEnv(
    {
      APPLE_CLIENT_ID: 'com.example.web',
      APPLE_REDIRECT_URI: 'https://x.test/cb',
      APPLE_TEAM_ID: 'TEAM123456',
      APPLE_KEY_ID: 'KEY1234567',
      APPLE_PRIVATE_KEY: 'pem',
    },
    () => assert.equal(isAppleOAuthConfigured(), true)
  );
  // A pre-generated secret is still an accepted (if unrotated) configuration.
  withAppleEnv(
    { APPLE_CLIENT_ID: 'com.example.web', APPLE_REDIRECT_URI: 'https://x.test/cb', APPLE_CLIENT_SECRET: 'jwt' },
    () => assert.equal(isAppleOAuthConfigured(), true)
  );
});

test('apple client secret is a verifiable ES256 JWT with the claims Apple requires', () => {
  const { pem, publicKey } = appleTestKey();
  const token = withAppleEnv(
    { APPLE_TEAM_ID: 'TEAM123456', APPLE_KEY_ID: 'KEY1234567', APPLE_PRIVATE_KEY: pem },
    () => getAppleClientSecret('com.example.web')
  );

  const [headerSegment, payloadSegment, signatureSegment] = token.split('.');
  const header = JSON.parse(fromBase64Url(headerSegment).toString('utf8'));
  const payload = JSON.parse(fromBase64Url(payloadSegment).toString('utf8'));

  assert.equal(header.alg, 'ES256');
  assert.equal(header.kid, 'KEY1234567');
  assert.equal(payload.iss, 'TEAM123456');
  assert.equal(payload.aud, 'https://appleid.apple.com');
  assert.equal(payload.sub, 'com.example.web');
  // Apple rejects secrets valid for more than six months.
  assert.ok(payload.exp - payload.iat <= 15777000);
  assert.ok(payload.exp > Math.floor(Date.now() / 1000));

  // ieee-p1363 (raw r||s), not DER — a DER signature earns invalid_client.
  assert.equal(fromBase64Url(signatureSegment).length, 64);
  const valid = verify(
    'sha256',
    Buffer.from(`${headerSegment}.${payloadSegment}`),
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    fromBase64Url(signatureSegment)
  );
  assert.equal(valid, true);
});

test('a literal APPLE_CLIENT_SECRET overrides the signing key', () => {
  const { pem } = appleTestKey();
  const token = withAppleEnv(
    {
      APPLE_TEAM_ID: 'TEAM123456',
      APPLE_KEY_ID: 'KEY1234567',
      APPLE_PRIVATE_KEY: pem,
      APPLE_CLIENT_SECRET: 'pre-generated',
    },
    () => getAppleClientSecret('com.example.web')
  );
  assert.equal(token, 'pre-generated');
});

test('apple private key accepts a PEM collapsed to one line', () => {
  const { pem } = appleTestKey();
  const escaped = pem.trim().replace(/\n/g, '\\n');
  assert.ok(!escaped.includes('\n'), 'test fixture should be single-line');
  const token = withAppleEnv(
    { APPLE_TEAM_ID: 'TEAM123456', APPLE_KEY_ID: 'KEY1234567', APPLE_PRIVATE_KEY: escaped },
    () => getAppleClientSecret('com.example.other')
  );
  assert.equal(token.split('.').length, 3);
});

test('oauth link tickets round-trip and reject tampering', () => {
  const previous = process.env.ZEROGEX_END_USER_TOKEN_SECRET;
  try {
    delete process.env.ZEROGEX_END_USER_TOKEN_SECRET;
    assert.equal(isLinkTicketAvailable(), false);
    assert.equal(createLinkTicket('apple', 'user_1'), null);

    process.env.ZEROGEX_END_USER_TOKEN_SECRET = 'test-secret';
    assert.equal(isLinkTicketAvailable(), true);

    const ticket = createLinkTicket('apple', 'user_1') as string;
    assert.equal(readLinkTicket('apple', ticket), 'user_1');

    // A ticket minted for one provider must not authorize another.
    assert.equal(readLinkTicket('google', ticket), null);
    // Swapping in another user id invalidates the signature.
    const [, expiry, sig] = ticket.split('.');
    assert.equal(readLinkTicket('apple', `user_2.${expiry}.${sig}`), null);
    // Extending the expiry invalidates it too.
    assert.equal(readLinkTicket('apple', `user_1.${Number(expiry) + 600}.${sig}`), null);
    // Already-expired tickets are refused.
    assert.equal(readLinkTicket('apple', `user_1.${Math.floor(Date.now() / 1000) - 1}.${sig}`), null);
    assert.equal(readLinkTicket('apple', undefined), null);
    assert.equal(readLinkTicket('apple', 'garbage'), null);
  } finally {
    if (previous === undefined) delete process.env.ZEROGEX_END_USER_TOKEN_SECRET;
    else process.env.ZEROGEX_END_USER_TOKEN_SECRET = previous;
  }
});
