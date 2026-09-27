import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The cancellation acknowledgment's whole lifecycle (core/cancelAck.ts), driven
// through the same calls the Stripe webhook makes, against a throwaway SQLite
// file carrying the REAL schema. The send-once latch is a SQL predicate
// (`cancel_ack_email_sent_at IS NULL`) and its failure mode is silence: a latch
// that is never released just makes the next cancel send nothing. That is how
// members who lapsed and came back went unacknowledged when they canceled again.

const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-cancel-ack-')), 'auth.db');
process.env.AUTH_DB_PATH = dbPath;

// Dynamic import: core/db.ts reads AUTH_DB_PATH at module load, so the
// assignment above has to land first.
const { getDb } = await import('../core/db.ts');
const { markSubscriptionEnded } = await import('../core/billingUser.ts');
const { handleCancelAckTransition } = await import('../core/cancelAck.ts');

const db = getDb();

type Sent = {
  to: string;
  periodEndIso: string | null;
  saveUrl: string | null;
  conversionChargePending: boolean;
};

// Fakes for what the webhook passes in: the mailer, the save-link builder and
// its audit writer. The clock ticks a second per call so stamps are ordered.
function harness(opts: { failSend?: boolean; noSaveSecret?: boolean } = {}) {
  const sent: Sent[] = [];
  const audits: Array<{ type: string; userId: string; message: string }> = [];
  let clock = Date.UTC(2026, 6, 1, 12, 0, 0);
  const deps = {
    send: async (to: string, o: Omit<Sent, 'to'>) => {
      if (opts.failSend) throw new Error('Resend returned 503');
      sent.push({ to, ...o });
    },
    buildSaveUrl: (userId: string) => {
      if (opts.noSaveSecret) throw new Error('ZEROGEX_END_USER_TOKEN_SECRET is not set');
      return `https://zerogex.io/save?u=${userId}`;
    },
    audit: (e: { type: string; userId: string; email: string; message: string }) => {
      audits.push({ type: e.type, userId: e.userId, message: e.message });
    },
    nowIso: () => new Date((clock += 1000)).toISOString(),
  };
  const acks = (userId: string) =>
    audits.filter((a) => a.userId === userId && a.type === 'cancellation_ack_email_sent');
  return { sent, audits, deps, acks };
}

function seedMember(id: string) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, tier, created_at, updated_at, stripe_customer_id)
     VALUES (?, ?, 'public', ?, ?, ?)`,
  ).run(id, `${id}@example.com`, now, now, `cus_${id}`);
  return { id, email: `${id}@example.com` };
}

// What syncSubscriptionToUser does to the row for one subscription event, as far
// as this latch is concerned: read cancel_at_period_end BEFORE the update, write
// the subscription's state, and hand the before/after pair on.
function sync(memberId: string, sub: { id: string; cancelAtPeriodEnd: 0 | 1 }) {
  const before = db
    .prepare('SELECT cancel_at_period_end FROM users WHERE id = ?')
    .get(memberId) as { cancel_at_period_end: number };
  db.prepare(
    `UPDATE users SET tier = 'pro', stripe_subscription_id = ?, subscription_status = 'active',
                      current_period_end = '2026-10-01T12:00:00.000Z', cancel_at_period_end = ?
     WHERE id = ?`,
  ).run(sub.id, sub.cancelAtPeriodEnd, memberId);
  return {
    previous: before.cancel_at_period_end ? 1 : 0,
    next: sub.cancelAtPeriodEnd,
    periodEndIso: '2026-10-01T12:00:00.000Z',
    subscriptionId: sub.id,
    conversionChargePending: false,
  };
}

function latchOf(memberId: string): string | null {
  return (
    db.prepare('SELECT cancel_ack_email_sent_at AS l FROM users WHERE id = ?').get(memberId) as {
      l: string | null;
    }
  ).l;
}

test('a cancel is acknowledged once, with the save link, and a repeat sends nothing', async () => {
  const h = harness();
  const m = seedMember('u_once');
  sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 0 });

  assert.equal(await handleCancelAckTransition(m, sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 1 }), h.deps), 'sent');
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].to, m.email);
  assert.equal(h.sent[0].saveUrl, `https://zerogex.io/save?u=${m.id}`);
  assert.equal(h.sent[0].periodEndIso, '2026-10-01T12:00:00.000Z');
  assert.equal(h.acks(m.id).length, 1);
  assert.notEqual(latchOf(m.id), null);

  // A second event that also saw the 0→1 flip (a race between two deliveries)
  // finds the latch taken.
  const again = { previous: 0, next: 1, periodEndIso: null, subscriptionId: 'sub_A', conversionChargePending: false };
  assert.equal(await handleCancelAckTransition(m, again, h.deps), 'already_acknowledged');
  assert.equal(h.sent.length, 1);
  assert.equal(h.acks(m.id).length, 1);
});

// The case this module was pulled out of the webhook to prove.
test('a member who lapses, comes back and cancels again is acknowledged again', async () => {
  const h = harness();
  const m = seedMember('u_returning');

  // First subscription: cancel, acknowledged.
  sync(m.id, { id: 'sub_FIRST', cancelAtPeriodEnd: 0 });
  assert.equal(
    await handleCancelAckTransition(m, sync(m.id, { id: 'sub_FIRST', cancelAtPeriodEnd: 1 }), h.deps),
    'sent',
  );

  // It runs out: customer.subscription.deleted.
  assert.equal(
    markSubscriptionEnded({ userId: m.id, subscriptionId: 'sub_FIRST', status: 'canceled', nowIso: h.deps.nowIso() }),
    true,
  );

  // Weeks later they buy again. The new subscription arrives un-canceled, so
  // there is no transition to act on.
  assert.equal(
    await handleCancelAckTransition(m, sync(m.id, { id: 'sub_SECOND', cancelAtPeriodEnd: 0 }), h.deps),
    'no_transition',
  );

  // And cancel again.
  assert.equal(
    await handleCancelAckTransition(m, sync(m.id, { id: 'sub_SECOND', cancelAtPeriodEnd: 1 }), h.deps),
    'sent',
  );
  assert.equal(h.sent.length, 2);
  const acks = h.acks(m.id);
  assert.equal(acks.length, 2);
  assert.match(acks[1].message, /sub_SECOND/);
});

// The state the bug left behind: a latch from an earlier subscription on a row
// with no cancel pending. Members already in it when the fix shipped needed
// the latch cleared by hand; nothing clears it on its own until they cancel
// and that subscription ends.
test('a latch left over from an earlier subscription swallows the next acknowledgment', async () => {
  const h = harness();
  const m = seedMember('u_leftover');
  sync(m.id, { id: 'sub_NOW', cancelAtPeriodEnd: 0 });
  db.prepare('UPDATE users SET cancel_ack_email_sent_at = ? WHERE id = ?').run('2026-07-15T09:00:00.000Z', m.id);

  const outcome = await handleCancelAckTransition(m, sync(m.id, { id: 'sub_NOW', cancelAtPeriodEnd: 1 }), h.deps);
  assert.equal(outcome, 'already_acknowledged');
  assert.equal(h.sent.length, 0);
  // The cancel itself is still on record; only the acknowledgment is missing.
  assert.equal(h.audits.filter((a) => a.type === 'stripe_cancellation_requested').length, 1);
  assert.equal(h.acks(m.id).length, 0);
});

test('un-canceling releases the latch, so a second cancel is acknowledged', async () => {
  const h = harness();
  const m = seedMember('u_changed_mind');
  sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 0 });
  await handleCancelAckTransition(m, sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 1 }), h.deps);

  assert.equal(await handleCancelAckTransition(m, sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 0 }), h.deps), 'released');
  assert.equal(latchOf(m.id), null);

  assert.equal(await handleCancelAckTransition(m, sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 1 }), h.deps), 'sent');
  assert.equal(h.acks(m.id).length, 2);
});

// A failed send keeps the latch: the claim happens before the send, so a
// redelivery can't turn one outage into a string of duplicate emails.
test('a failed send is recorded, and a repeat does not resend', async () => {
  const h = harness({ failSend: true });
  const m = seedMember('u_send_failed');
  sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 0 });

  assert.equal(
    await handleCancelAckTransition(m, sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 1 }), h.deps),
    'send_failed',
  );
  const errors = h.audits.filter((a) => a.type === 'cancellation_ack_email_error');
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Resend returned 503/);
  assert.notEqual(latchOf(m.id), null);

  const again = { previous: 0, next: 1, periodEndIso: null, subscriptionId: 'sub_A', conversionChargePending: false };
  assert.equal(await handleCancelAckTransition(m, again, h.deps), 'already_acknowledged');
});

test('without a save link the acknowledgment still goes out, just without the offer', async () => {
  const h = harness({ noSaveSecret: true });
  const m = seedMember('u_no_secret');
  sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 0 });

  assert.equal(await handleCancelAckTransition(m, sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 1 }), h.deps), 'sent');
  assert.equal(h.sent[0].saveUrl, null);
});
