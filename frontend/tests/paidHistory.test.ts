import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Exercises core/paidHistory.ts against a throwaway SQLite file carrying the
// REAL schema (core/db.ts builds it), because the question under test —
// "has money ever cleared on this account?" — is answered by a SQL predicate
// over stripe_invoice_history, and the failure being fixed was precisely a
// proxy that never touched that table.
//
// The incident: an account whose only invoices were a $0.00 trial invoice and a
// $29.00 conversion charge declined five times read back as
// `hasPriorPaidSubscription: yes`, because a trial stamps the paid-welcome and
// a nonpayment cancel sets the lapse flag. An operator quoting that line told a
// member their records showed a prior paid subscription. We had collected $0.00.

const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-paid-history-')), 'auth.db');
process.env.AUTH_DB_PATH = dbPath;

// Dynamic import: core/db.ts reads AUTH_DB_PATH at module load, so the
// assignment above has to land first. A static import would be hoisted past it.
const { getDb } = await import('../core/db.ts');
const { countClearedInvoices, decideEverPaid, hasEverPaid } = await import(
  '../core/paidHistory.ts'
);

const db = getDb();
const now = new Date().toISOString();

function seedUser(id: string, firstPaymentAt: string | null) {
  db.prepare(
    `INSERT INTO users (id, email, tier, created_at, updated_at, first_payment_at)
     VALUES (?, ?, 'public', ?, ?, ?)`,
  ).run(id, `${id}@example.com`, now, now, firstPaymentAt);
}

function seedInvoice(opts: {
  invoiceId: string;
  userId: string;
  status: string;
  amountPaid: number;
}) {
  db.prepare(
    `INSERT INTO stripe_invoice_history
       (invoice_id, user_id, customer_id, subscription_id, price_id, status,
        billing_reason, amount_paid, currency, paid_at, imported_at)
     VALUES (?, ?, 'cus_x', 'sub_x', 'price_x', ?, 'subscription_cycle', ?, 'usd', ?, ?)`,
  ).run(opts.invoiceId, opts.userId, opts.status, opts.amountPaid, now, now);
}

// --- the pure decision ------------------------------------------------------

test('no evidence from either source means never paid', () => {
  assert.equal(decideEverPaid({ firstPaymentAt: null, clearedInvoiceCount: 0 }), false);
});

test('either source alone is enough', () => {
  // They fail in opposite directions — one is real-time but young, the other is
  // authoritative but refreshed on a timer — so neither may veto the other.
  assert.equal(decideEverPaid({ firstPaymentAt: '2026-08-19T06:44:00Z', clearedInvoiceCount: 0 }), true);
  assert.equal(decideEverPaid({ firstPaymentAt: null, clearedInvoiceCount: 1 }), true);
});

// --- against the real schema ------------------------------------------------

test('a trial that never converted has never paid', () => {
  // The exact shape of the incident: the $0.00 trial invoice is PAID, and it
  // buys nothing. Counting it would reproduce the bug in a new place.
  seedUser('user_trialer', null);
  seedInvoice({ invoiceId: 'in_trial', userId: 'user_trialer', status: 'paid', amountPaid: 0 });
  assert.equal(countClearedInvoices(db, 'user_trialer'), 0);
  assert.equal(hasEverPaid(db, 'user_trialer', null), false);
});

test('an open invoice is not money, however large', () => {
  // The $29.00 conversion charge that declined five times sits `open` forever.
  // It is a bill, not a payment.
  seedUser('user_declined', null);
  seedInvoice({ invoiceId: 'in_open', userId: 'user_declined', status: 'open', amountPaid: 0 });
  seedInvoice({ invoiceId: 'in_void', userId: 'user_declined', status: 'void', amountPaid: 0 });
  assert.equal(hasEverPaid(db, 'user_declined', null), false);
});

test('one cleared non-zero invoice makes them a payer', () => {
  seedUser('user_payer', null);
  seedInvoice({ invoiceId: 'in_paid', userId: 'user_payer', status: 'paid', amountPaid: 2950 });
  assert.equal(countClearedInvoices(db, 'user_payer'), 1);
  assert.equal(hasEverPaid(db, 'user_payer', null), true);
});

test('the first_payment_at column alone is enough, with no invoice rows', () => {
  // The import timer lags a live payment by up to one tick; the webhook stamp
  // does not. A member who paid two minutes ago must not read back as unpaid.
  seedUser('user_juststamped', '2026-09-13T12:00:00Z');
  assert.equal(countClearedInvoices(db, 'user_juststamped'), 0);
  assert.equal(hasEverPaid(db, 'user_juststamped', '2026-09-13T12:00:00Z'), true);
});

test("one member's invoices never answer for another", () => {
  seedUser('user_neighbour', null);
  assert.equal(hasEverPaid(db, 'user_neighbour', null), false);
});

test('a missing stripe_invoice_history table degrades to "no evidence", not a crash', async () => {
  // A deploy predating that migration must not take down checkout. The column
  // signal still answers on its own.
  const barePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-bare-')), 'bare.db');
  const { DatabaseSync } = await import('node:sqlite');
  const bare = new DatabaseSync(barePath);
  bare.exec('CREATE TABLE users (id TEXT PRIMARY KEY);');
  assert.equal(countClearedInvoices(bare, 'user_any'), 0);
  assert.equal(hasEverPaid(bare, 'user_any', null), false);
  assert.equal(hasEverPaid(bare, 'user_any', '2026-01-01T00:00:00Z'), true);
});
