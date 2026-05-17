import test from 'node:test';
import assert from 'node:assert/strict';

// The secret is read lazily inside mintEndUserToken, but set it before the
// import anyway so the module is exercised exactly as in production.
process.env.ZEROGEX_END_USER_TOKEN_SECRET = 'test-end-user-secret-please-change';

import { mintEndUserToken } from '../core/api/endUserToken.ts';

function decodeSegment(seg: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'));
}

test('mints a 3-segment HS256 JWT with the expected sub and 5-minute exp', async () => {
  const userId = 'user_abc123';
  const token = await mintEndUserToken(userId);

  assert.ok(token, 'expected a token to be minted');

  const parts = token!.split('.');
  assert.equal(parts.length, 3, 'JWT must have header.payload.signature');

  const header = decodeSegment(parts[0]);
  assert.equal(header.alg, 'HS256');
  assert.equal(header.typ, 'JWT');

  const payload = decodeSegment(parts[1]);
  assert.equal(payload.sub, userId);
  assert.equal(typeof payload.iat, 'number');
  assert.equal(typeof payload.exp, 'number');
  // 5m lifetime: exp is exactly iat + 300 with jose's setExpirationTime('5m').
  assert.equal((payload.exp as number) - (payload.iat as number), 300);

  // Signature segment is non-empty base64url (HS256 ⇒ 32-byte HMAC).
  assert.ok(parts[2].length > 0);
});

test('trims the subject', async () => {
  const token = await mintEndUserToken('  user_padded  ');
  const payload = decodeSegment(token!.split('.')[1]);
  assert.equal(payload.sub, 'user_padded');
});

test('returns null for an empty / missing user id (fail-open)', async () => {
  assert.equal(await mintEndUserToken(''), null);
  assert.equal(await mintEndUserToken('   '), null);
  assert.equal(await mintEndUserToken(null), null);
  assert.equal(await mintEndUserToken(undefined), null);
});

test('returns null when the secret is not configured (attribution disabled)', async () => {
  const saved = process.env.ZEROGEX_END_USER_TOKEN_SECRET;
  delete process.env.ZEROGEX_END_USER_TOKEN_SECRET;
  try {
    assert.equal(await mintEndUserToken('user_abc123'), null);
  } finally {
    process.env.ZEROGEX_END_USER_TOKEN_SECRET = saved;
  }
});
