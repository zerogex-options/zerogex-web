import { createPublicKey, verify } from 'crypto';
import { randomBytes } from 'crypto';

export type OAuthProvider = 'google' | 'apple';

const STATE_COOKIE_PREFIX = 'zgx_oauth_state_';

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

export function createOAuthState() {
  return randomBytes(24).toString('hex');
}

export function getOAuthStateCookieName(provider: OAuthProvider) {
  return `${STATE_COOKIE_PREFIX}${provider}`;
}

export function getOAuthConfig(provider: OAuthProvider) {
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
};

export async function verifyAppleIdToken(idToken: string, expectedAudience: string) {
  const decoded = decodeJwt<AppleClaims>(idToken);
  const kid = decoded.header.kid;
  const alg = decoded.header.alg;

  if (typeof kid !== 'string' || alg !== 'RS256') {
    throw new Error('Invalid Apple token header');
  }

  const keysResponse = await fetch('https://appleid.apple.com/auth/keys', {
    method: 'GET',
    cache: 'no-store',
  });

  if (!keysResponse.ok) {
    throw new Error('Unable to fetch Apple JWKS');
  }

  const jwks = (await keysResponse.json()) as {
    keys?: Array<Record<string, string>>;
  };

  const jwk = jwks.keys?.find((key) => key.kid === kid && key.kty === 'RSA');
  if (!jwk) {
    throw new Error('Apple key not found for token');
  }

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const valid = verify('RSA-SHA256', decoded.signedContent, publicKey, decoded.signature);
  if (!valid) {
    throw new Error('Invalid Apple token signature');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (decoded.payload.iss !== 'https://appleid.apple.com') {
    throw new Error('Invalid Apple token issuer');
  }
  if (decoded.payload.aud !== expectedAudience) {
    throw new Error('Invalid Apple token audience');
  }
  if (!decoded.payload.exp || decoded.payload.exp < nowSeconds) {
    throw new Error('Apple token expired');
  }
  if (!decoded.payload.sub || !decoded.payload.email) {
    throw new Error('Apple token missing subject/email');
  }

  return {
    sub: decoded.payload.sub,
    email: decoded.payload.email,
    emailVerified: decoded.payload.email_verified === true || decoded.payload.email_verified === 'true',
  };
}
