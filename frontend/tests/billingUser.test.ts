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
const { findUserByCustomerId, findUserByCustomerIdIncludingDeleted } = await import(
  '../core/billingUser.ts'
);

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
