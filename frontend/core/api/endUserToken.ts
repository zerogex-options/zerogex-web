/**
 * Server-only minting of the X-End-User-Token sent alongside the existing
 * `Authorization: Bearer <ZEROGEX_API_TOKEN>` on every authenticated
 * server→ZeroGEX request.
 *
 * The website proxies every backend call through one shared per-user key
 * (`user_id=zerogex-web`), so the API can't tell which logged-in human a
 * request is for. This mints a short-lived HS256 JWT naming the end-user;
 * the API verifies it (pure crypto, shared secret) and attaches the
 * end-user to its request identity for audit logging / rate limiting.
 *
 * Wire contract (the API verifier is strict — keep in lockstep):
 *   - JWT, alg HS256 only. Header {"alg":"HS256","typ":"JWT"}.
 *   - Claims: sub = our stable internal user id (string, 1–256 chars,
 *     opaque, NOT email/PII); iat (auto); exp = iat + 5m.
 *   - Signature: HMAC-SHA256 over base64url(header).base64url(payload)
 *     using the raw secret's UTF-8 bytes (the secret is NOT base64-decoded
 *     first), base64url without padding — jose's default.
 *
 * Secret: `ZEROGEX_END_USER_TOKEN_SECRET`, server-only (no NEXT_PUBLIC_
 * prefix, so Next never inlines it into the client bundle). It must be
 * byte-identical to the API's `END_USER_TOKEN_SECRET`. Unset ⇒ no token
 * minted ⇒ requests stay caller-only (the API treats a missing token as
 * "no end-user" and does not reject).
 *
 * jose is used (not jsonwebtoken) because it runs in both the Node and
 * Edge runtimes — relevant if any of this ever moves into middleware.
 */

import { SignJWT } from 'jose';

const SECRET_ENV = 'ZEROGEX_END_USER_TOKEN_SECRET';
const TOKEN_TTL = '5m';
const MAX_SUB_LEN = 256;

let warnedMissingSecret = false;

function loadKey(): Uint8Array | null {
  const raw = process.env[SECRET_ENV];
  if (!raw || raw.trim() === '') {
    // Fail fast-ish: a loud one-time warning in production where this is
    // expected to be configured. Dev/CI without the secret is normal —
    // attribution is simply disabled there.
    if (process.env.NODE_ENV === 'production' && !warnedMissingSecret) {
      warnedMissingSecret = true;
      console.error(
        `[end-user-token] ${SECRET_ENV} is not set; server→ZeroGEX ` +
          'requests will carry no end-user attribution. Set it (byte-' +
          "identical to the API's END_USER_TOKEN_SECRET) to enable.",
      );
    }
    return null;
  }
  return new TextEncoder().encode(raw);
}

/**
 * Mint a token for `userId`, or return `null` when attribution is
 * disabled (no secret) or there is no usable id. Never throws — callers
 * treat `null` as "send the request with the Bearer key only".
 */
export async function mintEndUserToken(userId: string | null | undefined): Promise<string | null> {
  const key = loadKey();
  if (!key) return null;

  const sub = (userId ?? '').trim();
  if (!sub || sub.length > MAX_SUB_LEN) return null;

  return new SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(key);
}
