import { createHmac, timingSafeEqual } from 'crypto';

// Signed, stateless retention-SAVE tokens. The token is an HMAC of the user id,
// so the /save route can verify a one-click "keep my access + claim my discount"
// link from a cancellation email without a DB lookup, and nobody can forge a
// save for another account. Reuses the existing ZEROGEX_END_USER_TOKEN_SECRET,
// namespaced ('save:v1') so it can't collide with the unsubscribe token or any
// other use — a valid unsub token is NOT a valid save token and vice-versa.
// Mirrors core/unsubToken.ts; shared by app/save/route.ts and the Stripe webhook
// (which builds the link into sendCancellationEmail) so both compute the same
// token.

function secret(): string {
  const s = process.env.ZEROGEX_END_USER_TOKEN_SECRET;
  if (!s) throw new Error('ZEROGEX_END_USER_TOKEN_SECRET is not set');
  return s;
}

export function saveToken(userId: string): string {
  return createHmac('sha256', secret()).update(`save:v1:${userId}`).digest('base64url');
}

export function verifySaveToken(userId: string, token: string): boolean {
  if (!userId || !token) return false;
  const expected = Buffer.from(saveToken(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function buildSaveUrl(appUrl: string, userId: string): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}/save?u=${encodeURIComponent(userId)}&t=${saveToken(userId)}`;
}
