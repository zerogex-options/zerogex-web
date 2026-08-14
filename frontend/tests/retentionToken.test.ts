import test from 'node:test';
import assert from 'node:assert/strict';

// Set the secret BEFORE importing the module under test — the token functions
// read process.env.ZEROGEX_END_USER_TOKEN_SECRET at call time, so a fixed value
// here makes the HMAC deterministic.
process.env.ZEROGEX_END_USER_TOKEN_SECRET = 'test-secret-fixed';

const { saveToken, verifySaveToken, buildSaveUrl, convertToken, verifyConvertToken, buildConvertUrl } =
  await import('../core/retentionToken.ts');
const { unsubToken } = await import('../core/unsubToken.ts');

// The save token gates a one-click discount + un-cancel, so its verification is
// security-load-bearing: it must accept only the exact token for that user, and
// must never collide with the unsubscribe token (which is far more widely
// distributed).

test('a token verifies for its own user', () => {
  const t = saveToken('user_123');
  assert.equal(verifySaveToken('user_123', t), true);
});

test('a token does NOT verify for a different user', () => {
  const t = saveToken('user_123');
  assert.equal(verifySaveToken('user_456', t), false);
});

test('empty / malformed inputs never verify', () => {
  assert.equal(verifySaveToken('user_123', ''), false);
  assert.equal(verifySaveToken('', saveToken('user_123')), false);
  assert.equal(verifySaveToken('user_123', 'not-a-real-token'), false);
});

test('the save token is namespaced apart from the unsubscribe token', () => {
  const uid = 'user_123';
  // A valid unsub token must not pass save verification (different namespace),
  // or an unsubscribe link could be replayed to claim a discount.
  assert.notEqual(saveToken(uid), unsubToken(uid));
  assert.equal(verifySaveToken(uid, unsubToken(uid)), false);
});

test('buildSaveUrl embeds the user id and a matching token', () => {
  const url = buildSaveUrl('https://zerogex.io/', 'user_123');
  assert.match(url, /^https:\/\/zerogex\.io\/save\?u=user_123&t=/);
  const t = new URL(url).searchParams.get('t');
  assert.ok(t);
  assert.equal(verifySaveToken('user_123', t), true);
});

test('the convert token verifies for its own user and not others', () => {
  const t = convertToken('user_123');
  assert.equal(verifyConvertToken('user_123', t), true);
  assert.equal(verifyConvertToken('user_456', t), false);
  assert.equal(verifyConvertToken('user_123', 'nope'), false);
});

test('save and convert tokens are namespaced apart (neither passes the other)', () => {
  const uid = 'user_123';
  assert.notEqual(saveToken(uid), convertToken(uid));
  // A save link must not be replayable to claim a conversion discount, or vice-versa.
  assert.equal(verifyConvertToken(uid, saveToken(uid)), false);
  assert.equal(verifySaveToken(uid, convertToken(uid)), false);
  // And neither collides with the widely-distributed unsubscribe token.
  assert.equal(verifyConvertToken(uid, unsubToken(uid)), false);
});

test('buildConvertUrl embeds the user id and a matching token', () => {
  const url = buildConvertUrl('https://zerogex.io/', 'user_123');
  assert.match(url, /^https:\/\/zerogex\.io\/convert\?u=user_123&t=/);
  const t = new URL(url).searchParams.get('t');
  assert.ok(t);
  assert.equal(verifyConvertToken('user_123', t), true);
});
