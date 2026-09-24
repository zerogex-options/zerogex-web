import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSkipList, skipArg, skipEntryFor, suspectSkipEntries } from '../core/emailSkipList.ts';

// SKIP= is how the operator keeps a batch email away from someone they already
// wrote to by hand. Getting it wrong means exactly that person gets the
// automated email, so the parsing is deliberately forgiving and the typo
// warning deliberately strict.

test('takes emails and invoice ids, separated any reasonable way', () => {
  const list = parseSkipList(' Vernon@iCloud.com, in_1AbC ;hollandsp@ymail.com  other@x.io ');
  assert.deepEqual(list.entries, ['Vernon@iCloud.com', 'in_1AbC', 'hollandsp@ymail.com', 'other@x.io']);
  assert.deepEqual([...list.emails], ['vernon@icloud.com', 'hollandsp@ymail.com', 'other@x.io']);
  assert.deepEqual([...list.invoiceIds], ['in_1AbC']);
});

test('nothing given means nothing skipped', () => {
  for (const raw of [undefined, null, '', '  ,, ']) {
    const list = parseSkipList(raw);
    assert.equal(list.entries.length, 0);
    assert.equal(skipEntryFor(list, { email: 'a@b.co', invoiceId: 'in_1' }), null);
    assert.equal(skipArg(list), '');
  }
});

test('matches an email whatever its case, or the exact invoice', () => {
  const list = parseSkipList('vernondailey@icloud.com,in_9Zz');
  assert.equal(skipEntryFor(list, { email: 'VernonDailey@iCloud.com', invoiceId: 'in_1' }), 'vernondailey@icloud.com');
  assert.equal(skipEntryFor(list, { email: 'someone@else.com', invoiceId: 'in_9Zz' }), 'in_9Zz');
  assert.equal(skipEntryFor(list, { email: 'someone@else.com', invoiceId: 'in_1' }), null);
  assert.equal(skipEntryFor(list, { email: null, invoiceId: 'in_1' }), null);
});

test('a likely typo is reported, so it is caught before the send', () => {
  const accounts = new Set(['vernon@icloud.com', 'matheus@example.com']);
  const list = parseSkipList('Vernon@icloud.com,vernnon@icloud.com,matheus@example.com,in_9Zz');
  const matched = new Set(['vernon@icloud.com']);
  // vernnon@ is nobody's address; in_9Zz was never seen. matheus@ is a real
  // member who just isn't in this run — the same list serves both scripts, so
  // that one is not flagged.
  assert.deepEqual(suspectSkipEntries(list, matched, (email) => accounts.has(email)), ['vernnon@icloud.com', 'in_9Zz']);
});

test('the follow-up command carries the list forward verbatim', () => {
  assert.equal(skipArg(parseSkipList('a@b.co b@c.co')), ' SKIP=a@b.co,b@c.co');
});
