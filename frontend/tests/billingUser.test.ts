import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Exercises core/billingUser.ts against a throwaway SQLite file carrying the
// REAL schema (core/db.ts builds it), because the thing under test is a SQL
// predicate — `deleted_at IS NULL` — and a predicate can only be trusted if a
// database has actually applied it.
//
// This is the guard that stands between a soft-deleted account and the Stripe
// webhook re-granting it a paid tier, re-creating its subscription, or emailing
// it. A deleted row keeps its stripe_customer_id and its still-open invoices,
// whose hosted payment pages stay live indefinitely, so those events keep
// arriving long after the person is gone.

const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-billing-user-')), 'auth.db');
process.env.AUTH_DB_PATH = dbPath;

// Dynamic import: core/db.ts reads AUTH_DB_PATH at module load, so the
// assignment above has to land first. A static import would be hoisted past it.
const { getDb } = await import('../core/db.ts');
const { findUserByCustomerId, findUserByCustomerIdIncludingDeleted, markSubscriptionEnded } =
  await import('../core/billingUser.ts');

const db = getDb();

function seed(opts: {
  id: string;
  email: string;
  customerId: string | null;
  deletedAt?: string | null;
  tier?: string;
}) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, tier, created_at, updated_at, stripe_customer_id, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    opts.id,
    opts.email,
    opts.tier ?? 'pro',
    now,
    now,
    opts.customerId,
    opts.deletedAt ?? null,
  );
}

seed({ id: 'u_live', email: 'live@example.com', customerId: 'cus_LIVE' });
seed({
  id: 'u_gone',
  email: 'gone@example.com',
  customerId: 'cus_GONE',
  deletedAt: '2026-09-08T17:59:48.606Z',
});
// A member with no Stripe customer at all — the lookups must not match them
// when a null/absent id is passed around.
seed({ id: 'u_free', email: 'free@example.com', customerId: null, tier: 'public' });

test('the default lookup returns a live member', () => {
  const user = findUserByCustomerId('cus_LIVE');
  assert.equal(user?.email, 'live@example.com');
  assert.equal(user?.deleted_at, null);
});

// The whole point of the module.
test('the default lookup refuses a soft-deleted member', () => {
  assert.equal(findUserByCustomerId('cus_GONE'), null);
});

test('the explicit variant returns a soft-deleted member, with the marker set', () => {
  const user = findUserByCustomerIdIncludingDeleted('cus_GONE');
  assert.equal(user?.email, 'gone@example.com');
  assert.equal(user?.deleted_at, '2026-09-08T17:59:48.606Z');
});

test('the explicit variant returns live members too, so callers need no fallback', () => {
  assert.equal(findUserByCustomerIdIncludingDeleted('cus_LIVE')?.email, 'live@example.com');
});

test('an unknown customer id resolves to null in both', () => {
  assert.equal(findUserByCustomerId('cus_NOPE'), null);
  assert.equal(findUserByCustomerIdIncludingDeleted('cus_NOPE'), null);
});

// A NULL stripe_customer_id must never be treated as a wildcard: SQL `= NULL`
// is never true, but an empty-string id reaching the query would be a real
// caller bug worth locking down rather than discovering in production.
test('neither lookup matches a member who has no Stripe customer', () => {
  assert.equal(findUserByCustomerId(''), null);
  assert.equal(findUserByCustomerIdIncludingDeleted(''), null);
});

// Both lookups must return the SAME shape — the webhook aliases this type as
// UserRow and reads these fields across every branch, so a column dropped from
// one list and not the other would surface as an undefined at runtime rather
// than a type error.
test('both lookups return the same column set', () => {
  const viaDefault = findUserByCustomerId('cus_LIVE');
  const viaExplicit = findUserByCustomerIdIncludingDeleted('cus_LIVE');
  assert.deepEqual(Object.keys(viaDefault ?? {}).sort(), Object.keys(viaExplicit ?? {}).sort());
  // Spot-check the fields the grace and dunning paths depend on, so a rename in
  // core/db.ts that silently drops one from the SELECT fails here.
  for (const column of [
    'deleted_at',
    'tier',
    'subscription_status',
    'payment_grace_started_at',
    'payment_grace_reason',
    'first_payment_at',
    'trial_converted_email_sent_at',
  ]) {
    assert.ok(column in (viaDefault ?? {}), `expected column ${column} in the selected row`);
  }
});

// ── markSubscriptionEnded ────────────────────────────────────────────────────
// The row clear on customer.subscription.deleted. Its WHERE clause is what keeps
// a late deletion for a replaced subscription off the member's new one, and its
// SET list is what a returning member starts from.

type SubscriptionRow = {
  tier: string;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: number;
  cancel_ack_email_sent_at: string | null;
  subscription_lapsed: number;
};

function seedSubscriber(opts: {
  id: string;
  subscriptionId: string | null;
  cancelAtPeriodEnd: 0 | 1;
  cancelAckSentAt: string | null;
}) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, tier, created_at, updated_at, stripe_customer_id,
                        stripe_subscription_id, stripe_price_id, subscription_status,
                        current_period_end, cancel_at_period_end, cancel_ack_email_sent_at)
     VALUES (?, ?, 'pro', ?, ?, ?, ?, 'price_pro_monthly', 'active',
             '2026-10-01T12:00:00.000Z', ?, ?)`,
  ).run(
    opts.id,
    `${opts.id}@example.com`,
    now,
    now,
    `cus_${opts.id}`,
    opts.subscriptionId,
    opts.cancelAtPeriodEnd,
    opts.cancelAckSentAt,
  );
}

function subscriptionRow(id: string): SubscriptionRow {
  return db
    .prepare(
      `SELECT tier, stripe_subscription_id, subscription_status, current_period_end,
              cancel_at_period_end, cancel_ack_email_sent_at, subscription_lapsed
       FROM users WHERE id = ?`,
    )
    .get(id) as SubscriptionRow;
}

test('a subscription ending drops the member to public and marks them lapsed', () => {
  seedSubscriber({
    id: 'u_lapse',
    subscriptionId: 'sub_OLD',
    cancelAtPeriodEnd: 1,
    cancelAckSentAt: '2026-07-15T09:00:00.000Z',
  });
  const ended = markSubscriptionEnded({
    userId: 'u_lapse',
    subscriptionId: 'sub_OLD',
    status: 'canceled',
    nowIso: '2026-07-20T12:00:00.000Z',
  });
  assert.equal(ended, true);
  const row = subscriptionRow('u_lapse');
  assert.equal(row.tier, 'public');
  assert.equal(row.stripe_subscription_id, null);
  assert.equal(row.subscription_status, 'canceled');
  assert.equal(row.current_period_end, null);
  assert.equal(row.cancel_at_period_end, 0);
  assert.equal(row.subscription_lapsed, 1);
});

// The regression. The acknowledgment latch outlived the lapse, so when the
// member came back and canceled their NEW subscription, the webhook's claim
// (`... WHERE cancel_ack_email_sent_at IS NULL`) found it already taken and
// sent nothing: no acknowledgment, no one-click save offer.
test('a subscription ending releases its cancellation acknowledgment', () => {
  seedSubscriber({
    id: 'u_ack',
    subscriptionId: 'sub_ACKED',
    cancelAtPeriodEnd: 1,
    cancelAckSentAt: '2026-07-15T09:00:00.000Z',
  });
  const ended = markSubscriptionEnded({
    userId: 'u_ack',
    subscriptionId: 'sub_ACKED',
    status: 'canceled',
    nowIso: '2026-07-20T12:00:00.000Z',
  });
  assert.equal(ended, true);
  assert.equal(subscriptionRow('u_ack').cancel_ack_email_sent_at, null);
});

// comp-member (and the other scripts that mirror a cancel onto the row before
// the webhook lands) NULL the subscription id first. The deletion still has to
// finish the job when it arrives, latch included.
test('a row that no longer names any subscription is still cleared', () => {
  seedSubscriber({
    id: 'u_premirrored',
    subscriptionId: null,
    cancelAtPeriodEnd: 1,
    cancelAckSentAt: '2026-08-01T09:00:00.000Z',
  });
  const ended = markSubscriptionEnded({
    userId: 'u_premirrored',
    subscriptionId: 'sub_GONE',
    status: 'canceled',
    nowIso: '2026-08-02T00:00:00.000Z',
  });
  assert.equal(ended, true);
  assert.equal(subscriptionRow('u_premirrored').cancel_ack_email_sent_at, null);
  assert.equal(subscriptionRow('u_premirrored').subscription_lapsed, 1);
});

// A deletion for a subscription the member has since replaced must not touch
// the new one, including the acknowledgment of a cancel made on it.
test('a late deletion for a replaced subscription changes nothing', () => {
  seedSubscriber({
    id: 'u_moved_on',
    subscriptionId: 'sub_NEW',
    cancelAtPeriodEnd: 1,
    cancelAckSentAt: '2026-09-20T12:00:00.000Z',
  });
  const before = subscriptionRow('u_moved_on');
  const ended = markSubscriptionEnded({
    userId: 'u_moved_on',
    subscriptionId: 'sub_OLD',
    status: 'canceled',
    nowIso: '2026-09-27T00:00:00.000Z',
  });
  assert.equal(ended, false);
  assert.deepEqual(subscriptionRow('u_moved_on'), before);
});
