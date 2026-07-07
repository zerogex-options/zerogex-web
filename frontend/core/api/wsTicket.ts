/**
 * Server-only minting of the short-lived JWT ("ticket") that authorizes a
 * browser WebSocket handshake against the FastAPI /ws endpoint.
 *
 * Why a ticket rather than the same X-End-User-Token header we send with
 * REST calls? Browsers cannot attach arbitrary headers to a WebSocket
 * handshake — only the URL is under our control. So the handshake carries
 * the token as ?ticket=<jwt> in the URL, and the API verifies it with the
 * same HS256 secret.
 *
 * Wire contract (must stay in lockstep with API `verify_ws_ticket`):
 *   - alg: HS256 only. Any other algorithm is refused as algorithm-
 *     confusion. Header: {"alg":"HS256","typ":"JWT"}.
 *   - Claims: sub = internal user id (opaque, 1-256 chars, not PII),
 *     aud = "ws" (mandatory — separates WS tickets from the plain HTTP
 *     end-user token so a leaked one can't authenticate the other), iat
 *     (auto), exp = iat + 60s.
 *   - Signature: HMAC-SHA256 over base64url(header).base64url(payload)
 *     using the raw secret's UTF-8 bytes (NOT base64-decoded first).
 *
 * Secret: `ZEROGEX_END_USER_TOKEN_SECRET`. Same one the header-token
 * signer uses (so ops have exactly one secret to rotate). It MUST be
 * byte-identical to the API's END_USER_TOKEN_SECRET. Unset ⇒ ticket
 * minting is disabled and /api/ws/ticket returns 503 so the browser can
 * fall back to polling instead of opening a socket that would just be
 * rejected on the API side.
 */

import { SignJWT } from 'jose';

const SECRET_ENV = 'ZEROGEX_END_USER_TOKEN_SECRET';
// 60s is the ceiling on how long a handshake can be delayed by the
// browser's tab-throttling / network. Anything shorter risks a slow
// initial connect landing outside the window.
const TICKET_TTL_SECONDS = 60;
const MAX_SUB_LEN = 256;

function loadKey(): Uint8Array | null {
  const raw = process.env[SECRET_ENV];
  if (!raw || raw.trim() === '') return null;
  return new TextEncoder().encode(raw);
}

export interface MintedTicket {
  ticket: string;
  expiresAt: number; // unix seconds
}

/**
 * Mint a ticket for `userId`, or return `null` when disabled (no secret
 * or no usable id). Never throws — callers treat `null` as "WS is not
 * available; keep polling."
 */
export async function mintWsTicket(userId: string | null | undefined): Promise<MintedTicket | null> {
  const key = loadKey();
  if (!key) return null;

  const sub = (userId ?? '').trim();
  if (!sub || sub.length > MAX_SUB_LEN) return null;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + TICKET_TTL_SECONDS;
  const ticket = await new SignJWT({ sub, aud: 'ws' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key);
  return { ticket, expiresAt: exp };
}
