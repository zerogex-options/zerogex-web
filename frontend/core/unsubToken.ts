import { createHmac, timingSafeEqual } from 'crypto';

// Signed, stateless unsubscribe tokens for marketing emails. The token is an
// HMAC of the user id, so the /unsubscribe route can verify a link without a DB
// lookup, and nobody can forge an opt-out for another account. Reuses the
// existing ZEROGEX_END_USER_TOKEN_SECRET (namespaced so it can't collide with
// other token uses). Shared by app/unsubscribe/route.ts and
// scripts/send-product-update.mts so both sides compute the identical token.

function secret(): string {
  const s = process.env.ZEROGEX_END_USER_TOKEN_SECRET;
  if (!s) throw new Error('ZEROGEX_END_USER_TOKEN_SECRET is not set');
  return s;
}

export function unsubToken(userId: string): string {
  return createHmac('sha256', secret()).update(`unsub:v1:${userId}`).digest('base64url');
}

export function verifyUnsubToken(userId: string, token: string): boolean {
  if (!userId || !token) return false;
  const expected = Buffer.from(unsubToken(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function buildUnsubUrl(appUrl: string, userId: string): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubToken(userId)}`;
}
