// Exercises core/levelsSubscribers.ts against a throwaway SQLite file.
//
// The decision rules are unit-tested next door without a database
// (tests/levelsEmail.test.ts). What is covered HERE is everything that only
// shows up once real rows exist: that the abuse paths a public unauthenticated
// form invites are actually closed at the storage layer, that an opt-out
// cannot be undone by resubmitting the address, that one human cannot become
// two rows, and that the daily send reads exactly the people it is allowed to.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ZEROGEX_END_USER_TOKEN_SECRET =
  process.env.ZEROGEX_END_USER_TOKEN_SECRET || 'test-secret-do-not-use-in-production';

const dbPath = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-levels-subs-')),
  'auth.db',
);
process.env.AUTH_DB_PATH = dbPath;

// Dynamic import: core/db.ts reads AUTH_DB_PATH at module load, so the
// assignment above has to land first. A static import would be hoisted past it.
const { getDb } = await import('../core/db.ts');
const { levelsToken } = await import('../core/levelsEmail.ts');
const {
  confirmLevelsSubscriber,
  countLevelsSubscribers,
  getLevelsSubscriberByEmail,
  getLevelsSubscriberById,
  listSendableLevelsSubscribers,
  markLevelsDigestSent,
  recordLevelsSubscription,
  unsubscribeLevelsSubscriber,
} = await import('../core/levelsSubscribers.ts');

const db = getDb();

/** Wipe between tests so each one owns the table outright. */
function reset() {
  db.exec('DELETE FROM levels_subscribers;');
}

const T0 = new Date('2026-09-21T12:45:00Z');
const plusMinutes = (m: number) => new Date(T0.getTime() + m * 60_000);

// ── Schema ──────────────────────────────────────────────────────────────────

test('the migration creates the table, the confirm_ip column and the send index', () => {
  const cols = (db.prepare('PRAGMA table_info(levels_subscribers)').all() as Array<{ name: string }>)
    .map((r) => r.name);
  for (const c of [
    'id', 'email', 'confirmed_at', 'confirm_sent_at', 'unsubscribed_at',
    'source', 'signup_ip', 'confirm_ip', 'created_at', 'updated_at', 'last_sent_at',
  ]) {
    assert.ok(cols.includes(c), `missing column ${c}`);
  }
  const idx = (db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='levels_subscribers'")
    .all() as Array<{ name: string }>).map((r) => r.name);
  assert.ok(idx.includes('idx_levels_subscribers_sendable'));
});

test('the table has no foreign key into users — it is deliberately standalone', () => {
  const fks = db.prepare('PRAGMA foreign_key_list(levels_subscribers)').all();
  assert.equal(fks.length, 0);
});

// ── Subscribing ─────────────────────────────────────────────────────────────

test('a first submission creates a pending row and asks for a confirmation', () => {
  reset();
  const r = recordLevelsSubscription({
    email: 'Trader@Example.COM', source: '/spx-gamma-levels', ip: '203.0.113.9', now: T0,
  });
  assert.ok(r);
  assert.equal(r.outcome, 'created');
  assert.equal(r.shouldSend, true);
  assert.equal(r.subscriber.email, 'trader@example.com'); // normalized
  assert.equal(r.subscriber.confirmed_at, null);          // NOT yet subscribed
  assert.equal(r.subscriber.confirm_sent_at, T0.toISOString());
  assert.equal(r.subscriber.source, '/spx-gamma-levels');
  assert.equal(r.subscriber.signup_ip, '203.0.113.9');
  assert.match(r.subscriber.id, /^lvl_[0-9a-f]{32}$/);
});

test('an unusable address is rejected without a row, and without a distinct answer', () => {
  reset();
  assert.equal(recordLevelsSubscription({ email: 'not-an-address', now: T0 }), null);
  assert.equal(countLevelsSubscribers().total, 0);
});

test('case and whitespace variants of one address stay one row', () => {
  reset();
  recordLevelsSubscription({ email: 'trader@example.com', now: T0 });
  recordLevelsSubscription({ email: '  TRADER@Example.com ', now: plusMinutes(60) });
  assert.equal(countLevelsSubscribers().total, 1);
});

test('resubmitting inside the cooldown does not send again', () => {
  reset();
  recordLevelsSubscription({ email: 'a@b.com', now: T0 });
  const again = recordLevelsSubscription({ email: 'a@b.com', now: plusMinutes(5) });
  assert.equal(again?.outcome, 'pending-cooldown');
  assert.equal(again?.shouldSend, false);
  // The original stamp is untouched, so the window does not slide forward on
  // every submission — otherwise a fast loop could hold it open indefinitely.
  assert.equal(again?.subscriber.confirm_sent_at, T0.toISOString());
});

test('resubmitting after the cooldown resends — "I never got it" has to work', () => {
  reset();
  recordLevelsSubscription({ email: 'a@b.com', now: T0 });
  const again = recordLevelsSubscription({ email: 'a@b.com', now: plusMinutes(20) });
  assert.equal(again?.outcome, 'resent');
  assert.equal(again?.shouldSend, true);
  assert.equal(again?.subscriber.confirm_sent_at, plusMinutes(20).toISOString());
});

test('a confirmed address is never re-mailed — the form is not a mailbomb', () => {
  reset();
  const created = recordLevelsSubscription({ email: 'a@b.com', now: T0 })!;
  confirmLevelsSubscriber(created.subscriber.id, levelsToken('confirm', created.subscriber.id), null, plusMinutes(1));
  // Someone else now types this address repeatedly, long past any cooldown.
  for (const m of [30, 60, 600]) {
    const r = recordLevelsSubscription({ email: 'a@b.com', now: plusMinutes(m) });
    assert.equal(r?.outcome, 'already-confirmed');
    assert.equal(r?.shouldSend, false);
  }
});

test('an opt-out cannot be undone by resubmitting the address', () => {
  reset();
  const created = recordLevelsSubscription({ email: 'a@b.com', now: T0 })!;
  const id = created.subscriber.id;
  unsubscribeLevelsSubscriber(id, levelsToken('unsub', id), plusMinutes(5));
  const r = recordLevelsSubscription({ email: 'a@b.com', now: plusMinutes(600) });
  assert.equal(r?.outcome, 'unsubscribed');
  assert.equal(r?.shouldSend, false);
});

test('an overlong source is truncated rather than stored whole', () => {
  reset();
  const r = recordLevelsSubscription({ email: 'a@b.com', source: 'x'.repeat(500), now: T0 });
  assert.equal(r?.subscriber.source?.length, 64);
});

test('a duplicate insert races to a no-op instead of throwing', () => {
  reset();
  // Same instant, same address — the second INSERT hits the UNIQUE index and
  // must be absorbed by ON CONFLICT DO NOTHING rather than raising.
  const first = recordLevelsSubscription({ email: 'a@b.com', now: T0 });
  const second = recordLevelsSubscription({ email: 'a@b.com', now: T0 });
  assert.ok(first && second);
  assert.equal(countLevelsSubscribers().total, 1);
  assert.equal(first.subscriber.id, second.subscriber.id);
});

// ── Confirming ──────────────────────────────────────────────────────────────

test('a valid token confirms, records the confirming IP and completes the consent record', () => {
  reset();
  const created = recordLevelsSubscription({ email: 'a@b.com', ip: '203.0.113.9', now: T0 })!;
  const id = created.subscriber.id;
  const r = confirmLevelsSubscriber(id, levelsToken('confirm', id), '198.51.100.4', plusMinutes(3));
  assert.equal(r.outcome, 'confirmed');
  const row = getLevelsSubscriberById(id)!;
  assert.equal(row.confirmed_at, plusMinutes(3).toISOString());
  assert.equal(row.signup_ip, '203.0.113.9');   // where consent was given
  assert.equal(row.confirm_ip, '198.51.100.4'); // where it was confirmed
});

test('re-clicking a confirmation link is not an error — mail clients prefetch', () => {
  reset();
  const created = recordLevelsSubscription({ email: 'a@b.com', now: T0 })!;
  const id = created.subscriber.id;
  const token = levelsToken('confirm', id);
  confirmLevelsSubscriber(id, token, null, plusMinutes(3));
  const again = confirmLevelsSubscriber(id, token, '9.9.9.9', plusMinutes(9));
  assert.equal(again.outcome, 'already-confirmed');
  // The original confirmation instant stands; a scanner's later hit must not
  // rewrite the consent record.
  assert.equal(getLevelsSubscriberById(id)!.confirmed_at, plusMinutes(3).toISOString());
});

test('a bad, missing or wrong-purpose token cannot confirm', () => {
  reset();
  const created = recordLevelsSubscription({ email: 'a@b.com', now: T0 })!;
  const id = created.subscriber.id;
  assert.equal(confirmLevelsSubscriber(id, 'forged', null, T0).outcome, 'invalid');
  assert.equal(confirmLevelsSubscriber(id, null, null, T0).outcome, 'invalid');
  // An unsubscribe link must not be replayable as a confirmation.
  assert.equal(confirmLevelsSubscriber(id, levelsToken('unsub', id), null, T0).outcome, 'invalid');
  assert.equal(getLevelsSubscriberById(id)!.confirmed_at, null);
});

test('a token for an id that does not exist is invalid, not a crash', () => {
  reset();
  const ghost = 'lvl_' + '0'.repeat(32);
  assert.equal(confirmLevelsSubscriber(ghost, levelsToken('confirm', ghost), null, T0).outcome, 'invalid');
});

test('confirming after opting out is refused — it would silently restart mail', () => {
  reset();
  const created = recordLevelsSubscription({ email: 'a@b.com', now: T0 })!;
  const id = created.subscriber.id;
  unsubscribeLevelsSubscriber(id, levelsToken('unsub', id), plusMinutes(2));
  const r = confirmLevelsSubscriber(id, levelsToken('confirm', id), null, plusMinutes(5));
  assert.equal(r.outcome, 'unsubscribed');
  assert.equal(getLevelsSubscriberById(id)!.confirmed_at, null);
});

// ── Unsubscribing ───────────────────────────────────────────────────────────

test('unsubscribe is idempotent and preserves the original withdrawal instant', () => {
  reset();
  const created = recordLevelsSubscription({ email: 'a@b.com', now: T0 })!;
  const id = created.subscriber.id;
  const token = levelsToken('unsub', id);
  assert.equal(unsubscribeLevelsSubscriber(id, token, plusMinutes(5)).outcome, 'unsubscribed');
  assert.equal(unsubscribeLevelsSubscriber(id, token, plusMinutes(90)).outcome, 'already-unsubscribed');
  assert.equal(getLevelsSubscriberById(id)!.unsubscribed_at, plusMinutes(5).toISOString());
});

test('a confirmation link cannot be replayed to unsubscribe', () => {
  reset();
  const created = recordLevelsSubscription({ email: 'a@b.com', now: T0 })!;
  const id = created.subscriber.id;
  assert.equal(unsubscribeLevelsSubscriber(id, levelsToken('confirm', id), T0).outcome, 'invalid');
  assert.equal(getLevelsSubscriberById(id)!.unsubscribed_at, null);
});

// ── The send list ───────────────────────────────────────────────────────────

test('the daily send sees confirmed subscribers only — never pending, never opted out', () => {
  reset();
  const mk = (email: string) => recordLevelsSubscription({ email, now: T0 })!.subscriber.id;
  const confirmed = mk('confirmed@x.com');
  mk('pending@x.com'); // created but deliberately never confirmed
  const gone = mk('gone@x.com');

  confirmLevelsSubscriber(confirmed, levelsToken('confirm', confirmed), null, plusMinutes(1));
  confirmLevelsSubscriber(gone, levelsToken('confirm', gone), null, plusMinutes(1));
  unsubscribeLevelsSubscriber(gone, levelsToken('unsub', gone), plusMinutes(2));

  const sendable = listSendableLevelsSubscribers().map((s) => s.email);
  assert.deepEqual(sendable, ['confirmed@x.com']);
  assert.ok(!sendable.includes('pending@x.com'), 'unconfirmed address must never be mailed');
  assert.ok(!sendable.includes('gone@x.com'), 'opted-out address must never be mailed');
});

test('the send list is stably ordered and respects a limit, for throttled runs', () => {
  reset();
  const ids: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const id = recordLevelsSubscription({ email: `u${i}@x.com`, now: plusMinutes(i) })!.subscriber.id;
    confirmLevelsSubscriber(id, levelsToken('confirm', id), null, plusMinutes(i + 100));
    ids.push(id);
  }
  const all = listSendableLevelsSubscribers().map((s) => s.email);
  assert.deepEqual(all, ['u0@x.com', 'u1@x.com', 'u2@x.com', 'u3@x.com', 'u4@x.com']);
  assert.deepEqual(listSendableLevelsSubscribers(2).map((s) => s.email), ['u0@x.com', 'u1@x.com']);
});

test('markLevelsDigestSent records delivery without disturbing consent', () => {
  reset();
  const id = recordLevelsSubscription({ email: 'a@b.com', now: T0 })!.subscriber.id;
  confirmLevelsSubscriber(id, levelsToken('confirm', id), null, plusMinutes(1));
  markLevelsDigestSent(id, plusMinutes(500));
  const row = getLevelsSubscriberById(id)!;
  assert.equal(row.last_sent_at, plusMinutes(500).toISOString());
  assert.equal(row.confirmed_at, plusMinutes(1).toISOString());
  assert.equal(row.unsubscribed_at, null);
});

// ── Counts and lookups ──────────────────────────────────────────────────────

test('counts split the list the way the operator reads it', () => {
  reset();
  const a = recordLevelsSubscription({ email: 'a@x.com', now: T0 })!.subscriber.id;
  const b = recordLevelsSubscription({ email: 'b@x.com', now: T0 })!.subscriber.id;
  recordLevelsSubscription({ email: 'c@x.com', now: T0 });
  confirmLevelsSubscriber(a, levelsToken('confirm', a), null, plusMinutes(1));
  confirmLevelsSubscriber(b, levelsToken('confirm', b), null, plusMinutes(1));
  unsubscribeLevelsSubscriber(b, levelsToken('unsub', b), plusMinutes(2));

  assert.deepEqual(countLevelsSubscribers(), {
    total: 3, confirmed: 1, pending: 1, unsubscribed: 1,
  });
});

test('counts are zeroes on an empty table rather than nulls', () => {
  reset();
  assert.deepEqual(countLevelsSubscribers(), {
    total: 0, confirmed: 0, pending: 0, unsubscribed: 0,
  });
});

test('lookup by email normalizes, and misses return null rather than throwing', () => {
  reset();
  recordLevelsSubscription({ email: 'a@b.com', now: T0 });
  assert.ok(getLevelsSubscriberByEmail('  A@B.COM '));
  assert.equal(getLevelsSubscriberByEmail('nobody@x.com'), null);
  assert.equal(getLevelsSubscriberByEmail('garbage'), null);
  assert.equal(getLevelsSubscriberById('lvl_missing'), null);
  assert.equal(getLevelsSubscriberById(''), null);
});
