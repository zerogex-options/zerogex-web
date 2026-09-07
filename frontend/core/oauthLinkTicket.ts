import { createHmac, timingSafeEqual } from 'crypto';

// Signed, stateless "link this provider to user X" tickets, used only by the
// Apple flow.
//
// Google's callback arrives as a top-level GET redirect, which SameSite=Lax
// cookies ride along with, so google/callback can simply call requireSession()
// and read the signed-in user. Apple answers with response_mode=form_post — a
// cross-site POST — and the session cookie is withheld on those, so the same
// trick would report every linking attempt as unauthenticated.
//
// Instead apple/start resolves the session while it still can (it runs as an
// ordinary same-site GET) and hands the callback a short-lived HMAC of the user
// id. The ticket is not a credential: it only names the account to attach the
// Apple identity to, is bounded to ten minutes, and rides an httpOnly cookie
// the browser only returns to us. Reuses ZEROGEX_END_USER_TOKEN_SECRET, in its
// own namespace, exactly as core/unsubToken.ts does.

const TICKET_TTL_SECONDS = 60 * 10;

function secret(): string | null {
  return process.env.ZEROGEX_END_USER_TOKEN_SECRET || null;
}

/**
 * False when no signing secret is configured, in which case provider linking is
 * unavailable but plain sign-in still works. Callers surface this as its own
 * error code rather than a misleading "you are not signed in".
 */
export function isLinkTicketAvailable(): boolean {
  return !!secret();
}

function signature(provider: string, userId: string, expiresAt: number, key: string): string {
  return createHmac('sha256', key)
    .update(`oauthlink:v1:${provider}:${userId}:${expiresAt}`)
    .digest('base64url');
}

export function createLinkTicket(provider: string, userId: string): string | null {
  const key = secret();
  if (!key) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS;
  return `${userId}.${expiresAt}.${signature(provider, userId, expiresAt, key)}`;
}

/** Returns the user id the ticket names, or null if it is absent/expired/forged. */
export function readLinkTicket(provider: string, ticket: string | undefined): string | null {
  const key = secret();
  if (!key || !ticket) return null;

  const parts = ticket.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiresRaw, given] = parts;

  const expiresAt = Number(expiresRaw);
  if (!userId || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  const expected = Buffer.from(signature(provider, userId, expiresAt, key));
  const provided = Buffer.from(given);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  return userId;
}
