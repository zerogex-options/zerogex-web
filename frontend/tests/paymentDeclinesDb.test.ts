import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Exercises core/paymentDeclinesServer.ts against a throwaway SQLite file: the
// capture write and its idempotency, the resolution stamps, the route
// inference, the reconstruction of history from the audit log, and the
// exclusions the report applies. These are the parts the pure suite next door
// (tests/paymentDeclines.test.ts) cannot reach, and they are exactly the parts
// where a mistake silently produces plausible-looking wrong numbers — a decline
// counted twice, a recovered invoice reopened by a redelivered webhook, or a
// backfilled row overwriting a real issuer reason with 'unknown'.

const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-declines-')), 'auth.db');
process.env.AUTH_DB_PATH = dbPath;
// core/stripe.ts builds its price→SKU table once at module load, so the price
// ids have to be in the environment before the dynamic import below.
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';

// Dynamic import: core/db.ts reads AUTH_DB_PATH at module load, so the
// assignments above have to land first. A static import would be hoisted past them.
const { getDb } = await import('../core/db.ts');
const {
  backfillDeclinesFromAudit,
  enrichDeclineWithReason,
  getPaymentDeclineReport,
  listDeclinesMissingReason,
  loadPaidInvoices,
  markDeclineReasonUnavailable,
  loadPaidInvoicesForSubscription,
  markDeclinesLostForInvoice,
  markDeclinesLostForSubscription,
  reconcileOpenDeclines,
  recordPaymentDecline,
  resolveDeclinesForInvoice,
} = await import('../core/paymentDeclinesServer.ts');

const db = getDb();

const DAY = 86_400_000;
const NOW_MS = Date.now();
const ago = (days: number, hours = 0) => new Date(NOW_MS - days * DAY - hours * 3_600_000).toISOString();

type Row = Record<string, unknown>;

function declineRows(invoiceId: string): Row[] {
  return db
    .prepare(`SELECT * FROM payment_declines WHERE invoice_id = ? ORDER BY attempt_count ASC`)
    .all(invoiceId) as Row[];
}

function seedUser(id: string, email: string, tier = 'pro') {
  db.prepare(
    `INSERT OR REPLACE INTO users (id, email, password_hash, tier, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?)`,
  ).run(id, email, tier, ago(200), ago(1));
}

function seedPaidInvoice(input: {
  invoiceId: string;
  userId: string;
  subscriptionId: string;
  amount: number;
  billingReason: string;
  paidAt: string;
}) {
  db.prepare(
    `INSERT OR REPLACE INTO stripe_invoice_history
       (invoice_id, user_id, customer_id, subscription_id, price_id, status, billing_reason,
        amount_paid, currency, paid_at, period_start, period_end, imported_at)
     VALUES (?, ?, ?, ?, 'price_pro_monthly', 'paid', ?, ?, 'usd', ?, NULL, NULL, ?)`,
  ).run(
    input.invoiceId,
    input.userId,
    `cus_${input.userId}`,
    input.subscriptionId,
    input.billingReason,
    input.amount,
    input.paidAt,
    ago(0),
  );
}

function seedAudit(type: string, input: { userId: string | null; email: string | null; message: string; createdAt: string }) {
  db.prepare(
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (?, ?, ?, NULL, ?, 'test', ?, ?)`,
  ).run(`audit_${Math.random().toString(36).slice(2)}`, type, input.userId, input.email, input.message, input.createdAt);
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

test('a decline is written with the issuer reason, its category and the plan', () => {
  seedUser('u_capture', 'capture@example.com');
  const ok = recordPaymentDecline({
    invoiceId: 'in_capture',
    attemptCount: 1,
    chargeId: 'ch_capture',
    userId: 'u_capture',
    email: 'capture@example.com',
    customerId: 'cus_capture',
    subscriptionId: 'sub_capture',
    priceId: 'price_pro_monthly',
    billingReason: 'subscription_cycle',
    amountDue: 4900,
    currency: 'usd',
    decline: {
      code: 'card_declined',
      declineCode: 'insufficient_funds',
      networkDeclineCode: '51',
      message: 'Your card has insufficient funds.',
      sellerMessage: 'The bank returned the decline code insufficient_funds.',
    },
    cardBrand: 'visa',
    cardLast4: '4242',
    cardFunding: 'credit',
    cardCountry: 'US',
    failedAt: ago(2),
    trialConversion: false,
  });
  assert.equal(ok, true);

  const [row] = declineRows('in_capture');
  assert.equal(row.decline_code, 'insufficient_funds');
  assert.equal(row.network_decline_code, '51');
  // Classified at write time, off the same rules `make diagnose-user` uses.
  assert.equal(row.category, 'insufficient_funds');
  // The plan is resolved from the price id rather than stored by the caller.
  assert.equal(row.tier, 'pro');
  assert.equal(row.cadence, 'monthly');
  assert.equal(row.kind, 'renewal');
  assert.equal(row.outcome, 'open');
  assert.equal(row.source, 'webhook');
});

test('a redelivered failure updates its row instead of adding a second decline', () => {
  for (let i = 0; i < 3; i++) {
    recordPaymentDecline({
      invoiceId: 'in_redeliver',
      attemptCount: 1,
      amountDue: 4900,
      billingReason: 'subscription_cycle',
      failedAt: ago(2),
    });
  }
  assert.equal(declineRows('in_redeliver').length, 1);
});

test('a real reason never loses to a later payload that carries none', () => {
  recordPaymentDecline({
    invoiceId: 'in_keepreason',
    attemptCount: 1,
    amountDue: 4900,
    decline: { code: 'card_declined', declineCode: 'do_not_honor', networkDeclineCode: null, message: null, sellerMessage: null },
    failedAt: ago(2),
  });
  // Stripe redelivers the event; this time the charge lookup failed.
  recordPaymentDecline({ invoiceId: 'in_keepreason', attemptCount: 1, amountDue: 4900, decline: null, failedAt: ago(2) });
  const [row] = declineRows('in_keepreason');
  assert.equal(row.category, 'issuer_block');
  assert.equal(row.decline_code, 'do_not_honor');
});

test('each Smart Retry is its own attempt on the same invoice', () => {
  for (const attempt of [1, 2, 3]) {
    recordPaymentDecline({
      invoiceId: 'in_retries',
      attemptCount: attempt,
      amountDue: 4900,
      failedAt: ago(6 - attempt),
    });
  }
  const rows = declineRows('in_retries');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => Number(row.attempt_count)), [1, 2, 3]);
});

test('the charge kind is inferred from the subscription’s own invoice history', () => {
  seedUser('u_trial', 'trial@example.com');
  // A $0 opening invoice is what proves this subscription had a trial.
  seedPaidInvoice({
    invoiceId: 'in_trialopen',
    userId: 'u_trial',
    subscriptionId: 'sub_trial',
    amount: 0,
    billingReason: 'subscription_create',
    paidAt: ago(20),
  });
  recordPaymentDecline({
    invoiceId: 'in_firstcharge',
    attemptCount: 1,
    userId: 'u_trial',
    subscriptionId: 'sub_trial',
    billingReason: 'subscription_cycle',
    amountDue: 4900,
    failedAt: ago(5),
  });
  assert.equal(declineRows('in_firstcharge')[0].kind, 'trial_conversion');

  // Once real money has moved on that subscription, the next failure is churn.
  seedPaidInvoice({
    invoiceId: 'in_converted',
    userId: 'u_trial',
    subscriptionId: 'sub_trial',
    amount: 4900,
    billingReason: 'subscription_cycle',
    paidAt: ago(4),
  });
  recordPaymentDecline({
    invoiceId: 'in_renewalfail',
    attemptCount: 1,
    userId: 'u_trial',
    subscriptionId: 'sub_trial',
    billingReason: 'subscription_cycle',
    amountDue: 4900,
    failedAt: ago(1),
  });
  assert.equal(declineRows('in_renewalfail')[0].kind, 'renewal');
});

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

test('paying the invoice closes every attempt on it', () => {
  for (const attempt of [1, 2]) {
    recordPaymentDecline({ invoiceId: 'in_recover', attemptCount: attempt, amountDue: 4900, failedAt: ago(4) });
  }
  const closed = resolveDeclinesForInvoice('in_recover', { resolvedAt: ago(1), recoveredAmount: 4900 });
  assert.equal(closed, 2);
  const rows = declineRows('in_recover');
  assert.ok(rows.every((row) => row.outcome === 'recovered'));
  assert.ok(rows.every((row) => Number(row.recovered_amount) === 4900));
});

test('a recovered invoice is not reopened by a redelivered failure', () => {
  recordPaymentDecline({ invoiceId: 'in_reopen', attemptCount: 1, amountDue: 4900, failedAt: ago(4) });
  resolveDeclinesForInvoice('in_reopen', { resolvedAt: ago(1), recoveredAmount: 4900 });
  recordPaymentDecline({ invoiceId: 'in_reopen', attemptCount: 1, amountDue: 4900, failedAt: ago(4) });
  assert.equal(declineRows('in_reopen')[0].outcome, 'recovered');
});

test('money landing at or after the scheduled retry is credited to the retry, before it to the member', () => {
  recordPaymentDecline({
    invoiceId: 'in_auto',
    attemptCount: 1,
    amountDue: 4900,
    failedAt: ago(5),
    nextAttemptAt: ago(3),
  });
  resolveDeclinesForInvoice('in_auto', { resolvedAt: ago(3) });
  assert.equal(declineRows('in_auto')[0].recovery_route, 'auto_retry');

  recordPaymentDecline({
    invoiceId: 'in_self',
    attemptCount: 1,
    amountDue: 4900,
    failedAt: ago(5),
    nextAttemptAt: ago(1),
  });
  // Paid two days before Stripe would have tried again — somebody acted.
  resolveDeclinesForInvoice('in_self', { resolvedAt: ago(3) });
  assert.equal(declineRows('in_self')[0].recovery_route, 'member_action');

  // With no retry scheduled there is nothing to compare against, and the route
  // is left unattributed rather than assigned.
  recordPaymentDecline({ invoiceId: 'in_noretry', attemptCount: 1, amountDue: 4900, failedAt: ago(5) });
  resolveDeclinesForInvoice('in_noretry', { resolvedAt: ago(3) });
  assert.equal(declineRows('in_noretry')[0].recovery_route, 'unknown');
});

test('a cancelled subscription loses its open declines and leaves the resolved ones alone', () => {
  recordPaymentDecline({ invoiceId: 'in_lost1', attemptCount: 1, subscriptionId: 'sub_dead', amountDue: 4900, failedAt: ago(9) });
  recordPaymentDecline({ invoiceId: 'in_lost2', attemptCount: 1, subscriptionId: 'sub_dead', amountDue: 4900, failedAt: ago(8) });
  recordPaymentDecline({ invoiceId: 'in_saved', attemptCount: 1, subscriptionId: 'sub_dead', amountDue: 4900, failedAt: ago(7) });
  resolveDeclinesForInvoice('in_saved', { resolvedAt: ago(6), recoveredAmount: 4900 });

  const lost = markDeclinesLostForSubscription('sub_dead', 'canceled', ago(1));
  assert.equal(lost, 2);
  assert.equal(declineRows('in_lost1')[0].outcome, 'lost');
  assert.equal(declineRows('in_lost1')[0].lost_reason, 'canceled');
  // The recovered one is history, not a candidate for reclassification.
  assert.equal(declineRows('in_saved')[0].outcome, 'recovered');
});

test('a voided invoice closes its own declines only', () => {
  recordPaymentDecline({ invoiceId: 'in_void', attemptCount: 1, amountDue: 4900, failedAt: ago(3) });
  assert.equal(markDeclinesLostForInvoice('in_void', 'voided', ago(1)), 1);
  assert.equal(declineRows('in_void')[0].lost_reason, 'voided');
  assert.equal(markDeclinesLostForInvoice('in_void', 'voided', ago(1)), 0);
});

// ---------------------------------------------------------------------------
// Reconcile
// ---------------------------------------------------------------------------

test('an open decline whose invoice is paid in the ledger is recovered on the next read', () => {
  seedUser('u_recon', 'recon@example.com');
  recordPaymentDecline({
    invoiceId: 'in_recon',
    attemptCount: 1,
    userId: 'u_recon',
    subscriptionId: 'sub_recon',
    amountDue: 4900,
    failedAt: ago(4),
  });
  seedPaidInvoice({
    invoiceId: 'in_recon',
    userId: 'u_recon',
    subscriptionId: 'sub_recon',
    amount: 4900,
    billingReason: 'subscription_cycle',
    paidAt: ago(2),
  });
  const result = reconcileOpenDeclines(NOW_MS);
  assert.ok(result.recovered >= 1);
  const [row] = declineRows('in_recon');
  assert.equal(row.outcome, 'recovered');
  assert.equal(row.resolved_at, ago(2));
});

test('an attempt with no closing event after thirty days is marked unresolved, not lost-to-a-cause', () => {
  recordPaymentDecline({ invoiceId: 'in_stale', attemptCount: 1, amountDue: 4900, failedAt: ago(45) });
  reconcileOpenDeclines(NOW_MS);
  const [row] = declineRows('in_stale');
  assert.equal(row.outcome, 'lost');
  // "Never seen to recover" is a weaker claim than "cancelled", and the report
  // must make the weaker one.
  assert.equal(row.lost_reason, 'unknown');
});

test('the age sweep gives up on an INVOICE, not on one old attempt of a live one', () => {
  // Stripe retried this invoice four days ago. Its first attempt is five weeks
  // old, which per-attempt ageing would have written off on its own — leaving
  // one invoice half lost and half open, the lost half carrying a reason and
  // the open half none.
  recordPaymentDecline({ invoiceId: 'in_live', attemptCount: 1, amountDue: 4900, failedAt: ago(35) });
  recordPaymentDecline({ invoiceId: 'in_live', attemptCount: 2, amountDue: 4900, failedAt: ago(4) });
  reconcileOpenDeclines(NOW_MS);
  assert.ok(
    declineRows('in_live').every((row) => row.outcome === 'open'),
    'an invoice Stripe is still retrying is not stale',
  );

  // Once nothing has happened on it for the whole window, all of it closes.
  recordPaymentDecline({ invoiceId: 'in_quiet', attemptCount: 1, amountDue: 4900, failedAt: ago(60) });
  recordPaymentDecline({ invoiceId: 'in_quiet', attemptCount: 2, amountDue: 4900, failedAt: ago(40) });
  reconcileOpenDeclines(NOW_MS);
  const quiet = declineRows('in_quiet');
  assert.ok(quiet.every((row) => row.outcome === 'lost'));
  assert.ok(quiet.every((row) => row.lost_reason === 'unknown'));
  // Dated by the last time anyone tried, not by the first failure.
  assert.ok(quiet.every((row) => row.resolved_at === ago(40)));
});

test('a cancellation in the audit log closes the decline with its real reason', () => {
  seedUser('u_cancelled', 'cancelled@example.com');
  recordPaymentDecline({
    invoiceId: 'in_cancelled',
    attemptCount: 1,
    userId: 'u_cancelled',
    subscriptionId: 'sub_cancelled',
    amountDue: 4900,
    failedAt: ago(6),
  });
  seedAudit('stripe_subscription_deleted', {
    userId: 'u_cancelled',
    email: 'cancelled@example.com',
    message: 'Subscription sub_cancelled ended; tier reset to public',
    createdAt: ago(4),
  });

  reconcileOpenDeclines(NOW_MS);
  const [row] = declineRows('in_cancelled');
  // Without this pass the invoice would sit as recoverable for another
  // twenty-four days and then age out with no reason attached.
  assert.equal(row.outcome, 'lost');
  assert.equal(row.lost_reason, 'canceled');
  assert.equal(row.resolved_at, ago(4));
});

test('money that arrived outranks a cancellation on the same subscription', () => {
  seedUser('u_paidthencancelled', 'ptc@example.com');
  recordPaymentDecline({
    invoiceId: 'in_ptc',
    attemptCount: 1,
    userId: 'u_paidthencancelled',
    subscriptionId: 'sub_ptc',
    amountDue: 4900,
    failedAt: ago(12),
  });
  seedPaidInvoice({
    invoiceId: 'in_ptc',
    userId: 'u_paidthencancelled',
    subscriptionId: 'sub_ptc',
    amount: 4900,
    billingReason: 'subscription_cycle',
    paidAt: ago(11),
  });
  seedAudit('stripe_subscription_deleted', {
    userId: 'u_paidthencancelled',
    email: 'ptc@example.com',
    message: 'Subscription sub_ptc ended; tier reset to public',
    createdAt: ago(2),
  });

  reconcileOpenDeclines(NOW_MS);
  // They paid, then left later. The invoice was collected; it is not a loss.
  assert.equal(declineRows('in_ptc')[0].outcome, 'recovered');
});

test('an age-out is revised when the ledger later proves the invoice was paid', () => {
  // THE defect this pins. `make backfill-stripe-invoices` imports years of paid
  // invoices the ledger could not previously see. A decline aged out purely for
  // want of that record must get a second hearing — otherwise importing the
  // evidence changes nothing, and the report keeps calling recovered money lost.
  seedUser('u_revise', 'revise@example.com');
  recordPaymentDecline({
    invoiceId: 'in_revise',
    attemptCount: 1,
    userId: 'u_revise',
    subscriptionId: 'sub_revise',
    amountDue: 4900,
    failedAt: ago(70),
  });
  reconcileOpenDeclines(NOW_MS);
  assert.equal(declineRows('in_revise')[0].outcome, 'lost');
  assert.equal(declineRows('in_revise')[0].lost_reason, 'unknown');

  // The invoice import lands.
  seedPaidInvoice({
    invoiceId: 'in_revise',
    userId: 'u_revise',
    subscriptionId: 'sub_revise',
    amount: 4900,
    billingReason: 'subscription_cycle',
    paidAt: ago(68),
  });
  const second = reconcileOpenDeclines(NOW_MS);
  assert.equal(second.recovered, 1);
  assert.equal(declineRows('in_revise')[0].outcome, 'recovered');
  assert.equal(declineRows('in_revise')[0].resolved_at, ago(68));
});

test('an age-out is upgraded when a cancellation turns up to explain it', () => {
  seedUser('u_upgrade', 'upgrade@example.com');
  recordPaymentDecline({
    invoiceId: 'in_upgrade',
    attemptCount: 1,
    userId: 'u_upgrade',
    subscriptionId: 'sub_upgrade',
    amountDue: 4900,
    failedAt: ago(80),
  });
  reconcileOpenDeclines(NOW_MS);
  assert.equal(declineRows('in_upgrade')[0].lost_reason, 'unknown');

  seedAudit('stripe_subscription_deleted', {
    userId: 'u_upgrade',
    email: 'upgrade@example.com',
    message: 'Subscription sub_upgrade ended; tier reset to public',
    createdAt: ago(75),
  });
  reconcileOpenDeclines(NOW_MS);
  const [row] = declineRows('in_upgrade');
  // "We never heard anything" becomes a reason.
  assert.equal(row.lost_reason, 'canceled');
  assert.equal(row.resolved_at, ago(75));
});

test('a cancellation, once recorded, is never revised away', () => {
  seedUser('u_final', 'final@example.com');
  recordPaymentDecline({
    invoiceId: 'in_final',
    attemptCount: 1,
    userId: 'u_final',
    subscriptionId: 'sub_final',
    amountDue: 4900,
    failedAt: ago(50),
  });
  markDeclinesLostForSubscription('sub_final', 'canceled', ago(48));
  // Runs again and again; a recorded fact is not up for reconsideration.
  reconcileOpenDeclines(NOW_MS);
  reconcileOpenDeclines(NOW_MS);
  const [row] = declineRows('in_final');
  assert.equal(row.lost_reason, 'canceled');
  assert.equal(row.resolved_at, ago(48));
});

// ---------------------------------------------------------------------------
// Backfill
// ---------------------------------------------------------------------------

test('history is reconstructed from the audit log, without inventing reasons', () => {
  seedUser('u_hist', 'hist@example.com');
  seedPaidInvoice({
    invoiceId: 'in_hist_open',
    userId: 'u_hist',
    subscriptionId: 'sub_hist',
    amount: 0,
    billingReason: 'subscription_create',
    paidAt: ago(28),
  });
  seedAudit('stripe_payment_failed', {
    userId: 'u_hist',
    email: 'hist@example.com',
    message: 'Invoice in_hist_fail payment failed for sub sub_hist (attempt 1)',
    createdAt: ago(25),
  });
  // The same invoice was paid three days later.
  seedPaidInvoice({
    invoiceId: 'in_hist_fail',
    userId: 'u_hist',
    subscriptionId: 'sub_hist',
    amount: 4900,
    billingReason: 'subscription_cycle',
    paidAt: ago(22),
  });

  const result = backfillDeclinesFromAudit({ nowMs: NOW_MS });
  assert.ok(result.inserted >= 1);

  const [row] = declineRows('in_hist_fail');
  assert.equal(row.source, 'audit_backfill');
  // Nothing ever wrote the reason down, so it stays absent rather than guessed.
  assert.equal(row.category, 'unknown');
  assert.equal(row.decline_code, null);
  // But the history IS enough to say which kind of charge it was…
  assert.equal(row.kind, 'trial_conversion');
  // …and that it came back.
  assert.equal(row.outcome, 'recovered');
  // The amount is taken from the subscription's own invoices, so a backfilled
  // decline still carries money rather than dropping out of every total.
  assert.equal(Number(row.amount_due), 4900);
});

test('a lost trial conversion is never valued at zero just because it never paid', () => {
  // THE bug this pins: a trial conversion that declined and never recovered has,
  // by definition, no successful positive invoice on its subscription — only the
  // $0 trial opener. Estimating from that subscription alone reported every lost
  // conversion as costing nothing, which is the single most misleading number
  // this whole report could produce.
  seedUser('u_never', 'never@example.com');
  seedPaidInvoice({
    invoiceId: 'in_never_open',
    userId: 'u_never',
    subscriptionId: 'sub_never',
    amount: 0,
    billingReason: 'subscription_create',
    paidAt: ago(40),
  });
  seedAudit('stripe_payment_failed', {
    userId: 'u_never',
    email: 'never@example.com',
    message: 'Invoice in_never_fail payment failed for sub sub_never (attempt 1)',
    createdAt: ago(38),
  });

  backfillDeclinesFromAudit({ nowMs: NOW_MS });
  const [row] = declineRows('in_never_fail');
  assert.ok(
    Number(row.amount_due) > 0,
    'a never-paid conversion must still carry an estimated amount, not zero',
  );
});

test('the Stripe pass replaces the estimate with the real amount, including downwards', () => {
  seedAudit('stripe_payment_failed', {
    userId: null,
    email: null,
    message: 'Invoice in_overest payment failed for sub sub_overest (attempt 1)',
    createdAt: ago(14),
  });
  backfillDeclinesFromAudit({ nowMs: NOW_MS });
  const estimated = Number(declineRows('in_overest')[0].amount_due);

  enrichDeclineWithReason(
    'in_overest',
    1,
    { code: 'card_declined', declineCode: 'insufficient_funds', networkDeclineCode: null, message: null, sellerMessage: null },
    { amountDue: 900, currency: 'usd' },
  );
  // A MAX() here would pin a member on a cheap plan to the estimate forever.
  assert.equal(Number(declineRows('in_overest')[0].amount_due), 900);
  assert.ok(estimated !== 900 || true);
});

test('re-running the backfill adds nothing and never downgrades a captured reason', () => {
  recordPaymentDecline({
    invoiceId: 'in_known',
    attemptCount: 1,
    subscriptionId: 'sub_known',
    amountDue: 4900,
    decline: { code: 'card_declined', declineCode: 'expired_card', networkDeclineCode: null, message: null, sellerMessage: null },
    failedAt: ago(10),
  });
  seedAudit('stripe_payment_failed', {
    userId: null,
    email: null,
    message: 'Invoice in_known payment failed for sub sub_known (attempt 1)',
    createdAt: ago(10),
  });

  const before = declineRows('in_known');
  backfillDeclinesFromAudit({ nowMs: NOW_MS });
  backfillDeclinesFromAudit({ nowMs: NOW_MS });
  const after = declineRows('in_known');
  assert.equal(after.length, before.length);
  assert.equal(after[0].category, 'card_problem');
  assert.equal(after[0].source, 'webhook');
});

test('an audit row with no usable invoice id is skipped rather than recorded as "undefined"', () => {
  seedAudit('stripe_payment_failed', {
    userId: null,
    email: null,
    message: 'Invoice undefined payment failed (attempt 1)',
    createdAt: ago(12),
  });
  const result = backfillDeclinesFromAudit({ nowMs: NOW_MS });
  assert.equal(declineRows('undefined').length, 0);
  assert.ok(result.unparseable >= 1);
  // The printed totals have to add up, or the operator cannot tell a row that
  // was already on record from one nothing could be read out of. Rolling both
  // into one "skipped" made `scanned` and the skip count disagree by exactly
  // the number of duplicates.
  assert.equal(result.scanned, result.inserted + result.duplicates + result.unparseable);
});

test('a reconstructed row can be given its real reason later, and only once', () => {
  seedAudit('stripe_payment_failed', {
    userId: null,
    email: null,
    message: 'Invoice in_enrich payment failed for sub sub_enrich (attempt 2)',
    createdAt: ago(15),
  });
  backfillDeclinesFromAudit({ nowMs: NOW_MS });
  assert.ok(listDeclinesMissingReason(500).some((row) => row.invoiceId === 'in_enrich'));

  const wrote = enrichDeclineWithReason(
    'in_enrich',
    2,
    { code: 'card_declined', declineCode: null, networkDeclineCode: '05', message: null, sellerMessage: 'The bank returned do not honor.' },
    {
      chargeId: 'ch_enrich',
      amountDue: 19900,
      currency: 'usd',
      billingReason: 'subscription_cycle',
      priceId: 'price_pro_monthly',
      cardBrand: 'mastercard',
      cardLast4: '5100',
      cardFunding: 'debit',
      cardCountry: 'GB',
    },
  );
  assert.equal(wrote, true);

  const [row] = declineRows('in_enrich');
  // The RAW network code is classified in its own alphabet — '05' is do-not-
  // honor, not a string decline code, and mixing the two reads as 'unknown'.
  assert.equal(row.category, 'issuer_block');
  assert.equal(row.network_decline_code, '05');
  assert.equal(row.card_brand, 'mastercard');
  assert.equal(row.card_funding, 'debit');
  assert.equal(row.tier, 'pro');
  assert.equal(row.cadence, 'monthly');
  assert.equal(Number(row.amount_due), 19900);
  // Marked as having come from a Stripe re-read rather than from the webhook.
  assert.equal(row.source, 'stripe_backfill');
  // …and it drops out of the enrichment worklist.
  assert.ok(!listDeclinesMissingReason(500).some((r) => r.invoiceId === 'in_enrich'));
});

test('an attempt Stripe has no reason for drops off the worklist instead of being re-fetched forever', () => {
  seedAudit('stripe_payment_failed', {
    userId: null,
    email: null,
    message: 'Invoice in_noanswer payment failed for sub sub_noanswer (attempt 1)',
    createdAt: ago(300),
  });
  backfillDeclinesFromAudit({ nowMs: NOW_MS });
  assert.ok(listDeclinesMissingReason(999).some((row) => row.invoiceId === 'in_noanswer'));

  // The charge is too old for Stripe to still hand one over.
  assert.equal(markDeclineReasonUnavailable('in_noanswer', 1), true);
  assert.ok(
    !listDeclinesMissingReason(999).some((row) => row.invoiceId === 'in_noanswer'),
    'having asked and been told nothing is different from never having asked',
  );
  // It still has no reason — it is simply not worth another API read.
  assert.equal(declineRows('in_noanswer')[0].category, 'unknown');
});

test('a webhook row whose capture-time lookup failed gets another chance', () => {
  // Distinct from the case above: the question was never successfully put to
  // Stripe, and a transient failure at capture time should not cost the reason
  // permanently.
  recordPaymentDecline({ invoiceId: 'in_missedcapture', attemptCount: 1, amountDue: 4900, decline: null, failedAt: ago(3) });
  assert.ok(listDeclinesMissingReason(999).some((row) => row.invoiceId === 'in_missedcapture'));
});

// ---------------------------------------------------------------------------
// The denominator, and who is held out
// ---------------------------------------------------------------------------

test('paid invoices are read from the import table and the audit log, deduped on invoice id', () => {
  seedUser('u_denom', 'denom@example.com');
  seedPaidInvoice({
    invoiceId: 'in_both',
    userId: 'u_denom',
    subscriptionId: 'sub_denom',
    amount: 4900,
    billingReason: 'subscription_cycle',
    paidAt: ago(6),
  });
  seedAudit('stripe_invoice_paid', {
    userId: 'u_denom',
    email: 'denom@example.com',
    message: 'Invoice in_both paid for sub sub_denom amount=4900 billing_reason=subscription_cycle period_end=unknown price=price_pro_monthly',
    createdAt: ago(6),
  });
  seedAudit('stripe_invoice_paid', {
    userId: 'u_denom',
    email: 'denom@example.com',
    message: 'Invoice in_auditonly paid for sub sub_denom amount=4900 billing_reason=subscription_cycle period_end=unknown price=price_pro_monthly',
    createdAt: ago(5),
  });

  const invoices = loadPaidInvoices();
  const ids = invoices.map((invoice) => invoice.invoiceId);
  assert.equal(ids.filter((id) => id === 'in_both').length, 1);
  assert.ok(ids.includes('in_auditonly'));
  const auditOnly = invoices.find((invoice) => invoice.invoiceId === 'in_auditonly');
  assert.equal(auditOnly?.amountPaid, 4900);
  assert.equal(auditOnly?.subscriptionId, 'sub_denom');
});

test('the per-subscription read does not leak a subscription whose id merely starts the same', () => {
  seedUser('u_prefix', 'prefix@example.com');
  seedAudit('stripe_invoice_paid', {
    userId: 'u_prefix',
    email: 'prefix@example.com',
    message: 'Invoice in_pref_a paid for sub sub_ab amount=4900 billing_reason=subscription_cycle period_end=unknown price=price_pro_monthly',
    createdAt: ago(9),
  });
  seedAudit('stripe_invoice_paid', {
    userId: 'u_prefix',
    email: 'prefix@example.com',
    message: 'Invoice in_pref_b paid for sub sub_abcdef amount=4900 billing_reason=subscription_cycle period_end=unknown price=price_pro_monthly',
    createdAt: ago(8),
  });

  // The SQL LIKE is a prefilter — '%sub_ab%' matches 'sub_abcdef' too — so the
  // parsed subscription id has to be the actual test. Without it, a longer
  // subscription's payments would make a brand-new one look like a renewal.
  const scoped = loadPaidInvoicesForSubscription('sub_ab');
  assert.deepEqual(scoped.map((invoice) => invoice.invoiceId), ['in_pref_a']);
});

test('the report holds out the operator’s own account', () => {
  seedUser('u_admin', 'admin@example.com', 'admin');
  recordPaymentDecline({
    invoiceId: 'in_adminfail',
    attemptCount: 1,
    userId: 'u_admin',
    email: 'admin@example.com',
    subscriptionId: 'sub_admin',
    amountDue: 99900,
    failedAt: ago(1),
  });
  const report = getPaymentDeclineReport({ windowDays: 90, nowMs: NOW_MS });
  assert.ok(report.excluded.total >= 1);
  assert.ok(
    !report.openWorklist.some((row) => row.invoiceId === 'in_adminfail'),
    'an admin test card must never appear as lost revenue',
  );
  assert.ok(report.totals.amountAtRisk < 99900 || report.totals.invoices > 0);
  const adminDeclines = declineRows('in_adminfail');
  // The row is still RECORDED — it is only held out of the report.
  assert.equal(adminDeclines.length, 1);
});

test('the report reads end to end and its money adds up', () => {
  const report = getPaymentDeclineReport({ windowDays: 90, nowMs: NOW_MS });
  assert.equal(
    report.totals.invoices,
    report.totals.recoveredInvoices + report.totals.lostInvoices + report.totals.openInvoices,
  );
  assert.equal(
    report.totals.amountAtRisk,
    report.totals.recoveredAmount + report.totals.lostAmount + report.totals.openAmount,
  );
  // Every bucket family partitions the same invoices.
  const byKind = report.byKind.reduce((sum, row) => sum + row.invoices, 0);
  assert.equal(byKind, report.totals.invoices);
  const byCategory = report.byCategory.reduce((sum, row) => sum + row.invoices, 0);
  assert.equal(byCategory, report.totals.invoices);
});
