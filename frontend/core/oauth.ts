import { createPublicKey, verify } from 'crypto';
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
  clientSecret: string;
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

  const clientId = requireEnv('APPLE_CLIENT_ID');
  const redirectUri = requireEnv('APPLE_REDIRECT_URI');
  const clientSecret = requireEnv('APPLE_CLIENT_SECRET');

  return {
    clientId,
    redirectUri,
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    scope: 'name email',
    responseMode: 'form_post',
    clientSecret,
  };
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
