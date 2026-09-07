import { createPrivateKey, createPublicKey, sign, verify } from 'crypto';
import { randomBytes } from 'crypto';

export type OAuthProvider = 'google' | 'apple';

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  jwksUrl: string;
  scope: string;
};

type AppleOAuthConfig = {
  clientId: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  scope: string;
  responseMode: string;
};

const STATE_COOKIE_PREFIX = 'zgx_oauth_state_';
const NONCE_COOKIE_PREFIX = 'zgx_oauth_nonce_';

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function fromBase64Url(input: string) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function decodeJwt<T = Record<string, unknown>>(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const header = JSON.parse(fromBase64Url(headerSegment).toString('utf8')) as Record<string, unknown>;
  const payload = JSON.parse(fromBase64Url(payloadSegment).toString('utf8')) as T;

  return {
    header,
    payload,
    signature: fromBase64Url(signatureSegment),
    signedContent: Buffer.from(`${headerSegment}.${payloadSegment}`),
  };
}

async function verifyJwtWithJwks<T extends { exp?: number; aud?: string; iss?: string; nonce?: string }>(
  token: string,
  params: {
    jwksUrl: string;
    expectedAudience: string;
    expectedIssuers: string[];
    expectedNonce?: string;
  }
) {
  const decoded = decodeJwt<T>(token);
  const kid = decoded.header.kid;
  const alg = decoded.header.alg;

  if (typeof kid !== 'string' || alg !== 'RS256') {
    throw new Error('Invalid token header');
  }

  const keysResponse = await fetch(params.jwksUrl, { method: 'GET', cache: 'no-store' });
  if (!keysResponse.ok) {
    throw new Error('Unable to fetch JWKS');
  }

  const jwks = (await keysResponse.json()) as { keys?: Array<Record<string, string>> };
  const jwk = jwks.keys?.find((key) => key.kid === kid && key.kty === 'RSA');
  if (!jwk) {
    throw new Error('JWK not found for token');
  }

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const valid = verify('RSA-SHA256', decoded.signedContent, publicKey, decoded.signature);
  if (!valid) {
    throw new Error('Invalid token signature');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!decoded.payload.exp || decoded.payload.exp < nowSeconds) {
    throw new Error('Token expired');
  }

  if (!decoded.payload.aud || decoded.payload.aud !== params.expectedAudience) {
    throw new Error('Invalid token audience');
  }

  if (!decoded.payload.iss || !params.expectedIssuers.includes(decoded.payload.iss)) {
    throw new Error('Invalid token issuer');
  }

  if (params.expectedNonce && decoded.payload.nonce !== params.expectedNonce) {
    throw new Error('Invalid token nonce');
  }

  return decoded.payload;
}

export function createOAuthState() {
  return randomBytes(24).toString('hex');
}

export function createOAuthNonce() {
  return randomBytes(20).toString('hex');
}

export function getOAuthStateCookieName(provider: OAuthProvider) {
  return `${STATE_COOKIE_PREFIX}${provider}`;
}

export function getOAuthNonceCookieName(provider: OAuthProvider) {
  return `${NONCE_COOKIE_PREFIX}${provider}`;
}

export const OAUTH_INTENT_COOKIE_NAME = 'oauth_intent';

// Apple gets its own linking cookie rather than sharing OAUTH_INTENT_COOKIE_NAME:
// the value is a signed ticket (see core/oauthLinkTicket.ts), not the literal
// 'link' Google uses, and a separate name keeps two in-flight flows from
// clobbering each other.
export const APPLE_LINK_TICKET_COOKIE_NAME = 'zgx_oauth_link_apple';

export function getOAuthConfig(provider: 'google'): GoogleOAuthConfig;
export function getOAuthConfig(provider: 'apple'): AppleOAuthConfig;
export function getOAuthConfig(provider: OAuthProvider): GoogleOAuthConfig | AppleOAuthConfig {
  if (provider === 'google') {
    const clientId = requireEnv('GOOGLE_CLIENT_ID');
    const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
    const redirectUri = requireEnv('GOOGLE_REDIRECT_URI');

    return {
      clientId,
      clientSecret,
      redirectUri,
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
      jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
      scope: 'openid email profile',
    };
  }

  // No client secret here on purpose: Apple's is a short-lived signed JWT, not
  // a static string, and /apple/start must work with only the id + redirect URI.
  // The callback mints one via getAppleClientSecret() at token-exchange time.
  const clientId = requireEnv('APPLE_CLIENT_ID');
  const redirectUri = requireEnv('APPLE_REDIRECT_URI');

  return {
    clientId,
    redirectUri,
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    scope: 'name email',
    responseMode: 'form_post',
  };
}

// --- Apple client secret ---------------------------------------------------
//
// Apple is the odd one out among OAuth providers: there is no static client
// secret to paste into an env var. The "secret" is an ES256-signed JWT the
// relying party mints itself from the .p8 signing key downloaded once from the
// Apple Developer portal, and Apple caps its lifetime at 6 months. Storing a
// hand-generated one in APPLE_CLIENT_SECRET therefore turns into a silent
// outage twice a year the moment it expires. We mint it per-process instead
// and cache it until shortly before expiry.

const APPLE_SECRET_TTL_SECONDS = 150 * 24 * 60 * 60; // under Apple's 6-month cap
const APPLE_SECRET_REFRESH_MARGIN_SECONDS = 24 * 60 * 60;

let appleSecretCache: { token: string; expiresAt: number; fingerprint: string } | null = null;

function toBase64Url(input: Buffer | string) {
  return (typeof input === 'string' ? Buffer.from(input, 'utf8') : input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * The .p8 contents as pasted into the environment. Both shapes are accepted:
 * a real multi-line PEM (fine in a .env file read by dotenv, or a k8s secret)
 * and a single line with literal `\n` escapes (what most CI secret stores and
 * `pm2 ecosystem` configs give you back).
 */
function readApplePrivateKey() {
  const raw = requireEnv('APPLE_PRIVATE_KEY').trim();
  const pem = raw.includes('-----BEGIN')
    ? raw.replace(/\\n/g, '\n')
    : `-----BEGIN PRIVATE KEY-----\n${raw.replace(/\s+/g, '')}\n-----END PRIVATE KEY-----`;
  return createPrivateKey({ key: pem, format: 'pem' });
}

/**
 * True when Sign in with Apple has everything it needs to complete a round
 * trip. Used by the callback to fail with a clear error instead of a generic
 * token-exchange failure, and mirrors what NEXT_PUBLIC_APPLE_AUTH_ENABLED
 * advertises to the browser.
 */
export function isAppleOAuthConfigured() {
  const hasSigningKey =
    !!process.env.APPLE_TEAM_ID && !!process.env.APPLE_KEY_ID && !!process.env.APPLE_PRIVATE_KEY;
  return (
    !!process.env.APPLE_CLIENT_ID &&
    !!process.env.APPLE_REDIRECT_URI &&
    (hasSigningKey || !!process.env.APPLE_CLIENT_SECRET)
  );
}

/**
 * Mint (or reuse) the client_secret JWT for the /auth/token exchange.
 *
 * A literal APPLE_CLIENT_SECRET still wins if one is set, so an operator can
 * drop in a secret generated elsewhere without a code change — but the signing
 * key is the supported path, since only it survives past six months.
 */
export function getAppleClientSecret(clientId: string) {
  const literal = process.env.APPLE_CLIENT_SECRET;
  if (literal) return literal;

  const teamId = requireEnv('APPLE_TEAM_ID');
  const keyId = requireEnv('APPLE_KEY_ID');
  const nowSeconds = Math.floor(Date.now() / 1000);
  const fingerprint = `${teamId}:${keyId}:${clientId}`;

  if (
    appleSecretCache &&
    appleSecretCache.fingerprint === fingerprint &&
    appleSecretCache.expiresAt - APPLE_SECRET_REFRESH_MARGIN_SECONDS > nowSeconds
  ) {
    return appleSecretCache.token;
  }

  const expiresAt = nowSeconds + APPLE_SECRET_TTL_SECONDS;
  const header = toBase64Url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      iss: teamId,
      iat: nowSeconds,
      exp: expiresAt,
      aud: 'https://appleid.apple.com',
      sub: clientId,
    })
  );

  // ieee-p1363 is the raw r||s encoding JOSE requires; Node defaults to DER,
  // which Apple rejects with invalid_client.
  const signature = sign(
    'sha256',
    Buffer.from(`${header}.${payload}`),
    { key: readApplePrivateKey(), dsaEncoding: 'ieee-p1363' }
  );

  const token = `${header}.${payload}.${toBase64Url(signature)}`;
  appleSecretCache = { token, expiresAt, fingerprint };
  return token;
}

type AppleClaims = {
  iss?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  nonce?: string;
};

export async function verifyAppleIdToken(idToken: string, expectedAudience: string, expectedNonce?: string) {
  const payload = await verifyJwtWithJwks<AppleClaims>(idToken, {
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    expectedAudience,
    expectedIssuers: ['https://appleid.apple.com'],
    expectedNonce,
  });

  if (!payload.sub || !payload.email) {
    throw new Error('Apple token missing subject/email');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
  };
}

type GoogleClaims = {
  iss?: string;
  aud?: string;
  exp?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  nonce?: string;
};

export async function verifyGoogleIdToken(idToken: string, expectedAudience: string, expectedNonce?: string) {
  const payload = await verifyJwtWithJwks<GoogleClaims>(idToken, {
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    expectedAudience,
    expectedIssuers: ['https://accounts.google.com', 'accounts.google.com'],
    expectedNonce,
  });

  if (!payload.sub || !payload.email) {
    throw new Error('Google token missing subject/email');
  }

  if (payload.email_verified !== true) {
    throw new Error('Google email is not verified');
  }

  return {
    sub: payload.sub,
    email: payload.email,
  };
}
