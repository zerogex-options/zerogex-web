#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/unwind-orphan-recovery.mts \
//     --email <addr> [--dry-run | --yes] [--force]
//
// Undo an ORPHAN RECOVERY that should never have run — the inverse of
// scripts/recover-orphan-payment.mts and of maybeRecoverOrphanPayment in
// app/api/webhooks/stripe/route.ts.
//
// WHY THIS EXISTS. Recovery re-creates a canceled plan when a member paid an
// invoice that left them with no entitlement. Until the refund guard shipped it
// had no way to tell that apart from a payment that had been GIVEN BACK: Stripe
// leaves a refunded invoice reading status=paid with amount_paid untouched (the
// Dashboard says "Refunded", the API does not), and a refunded member is
// normally canceled in the same breath, which clears their local subscription id
// and drops them to 'public'. Every signal the decision looked at was therefore
// identical for a refunded close-out and a real orphan.
//
// So a member who converted, was refunded in full and canceled immediately could
// be handed, a fortnight later, a free run of the period they had been
// reimbursed for — plus any repeating coupon re-applied with its clock
// restarted, which discounts their renewals all over again. The guard stops new
// ones. This reverses the ones already made.
//
// What it does, with --yes:
//   1. Cancels the recovery subscription IMMEDIATELY, with no proration invoice.
//      Nothing was ever charged on it (recovery anchors billing at the end of
//      the period the old invoice paid for), so there is nothing to refund and
//      nothing to collect. Any coupon carried onto it dies with it — coupons
//      live on the subscription.
//   2. Mirrors the downgrade onto the users row: the exact columns
//      clearSubscriptionFromUser writes, so the row returns to the state it held
//      before the recovery. The customer.subscription.deleted webhook reconciles
//      to identical values (idempotent).
//   3. Writes an audit row (billing_orphan_recovery_unwound) naming the invoice,
//      the refund that justified the unwind, and the coupons that went with it.
//
// SAFETY — it refuses unless all of these hold, because each one is a case where
// reversing would take away something the member is owed:
//   * the subscription carries the recovered_from_invoice stamp. Without it this
//     is an ordinary subscription and not this script's business.
//   * the recovered invoice was refunded IN FULL. A payment still held is a real
//     orphan and the recovery was correct; a PARTIAL refund means some of the
//     period was paid for, and how much access that buys is a judgment call.
//     --force asserts "not entitled regardless" and skips only this check.
//   * no invoice has ever been PAID on the recovery subscription. If one has,
//     real money is involved and a refund decision comes first — that is yours,
//     not this script's.
//
// Idempotent: a subscription already canceled is not canceled again, and the row
// is reconciled either way. Sends NO email. Dry-run by default.
//
// NOTE ON ALERTS: cancelling through the API records no cancellation survey, so
// the churn row it produces is "silent" and send-cancellation-alerts suppresses
// it by default. Running that with --include-silent will surface this one; it is
// not a new churn — the member already churned when they were refunded.
//
// Reads STRIPE_SECRET_KEY from env or .env.local. Set AUTH_DB_PATH to override
// the DB path (data/auth.db).

import crypto from 'node:crypto';

import Stripe from 'stripe';

import { loadEnvLocal } from './env-local.mts';

// The whole file, before anything that reads env at module load is imported.
loadEnvLocal();

const AUDIT_TYPE = 'billing_orphan_recovery_unwound';
const RECOVERED_FROM_INVOICE_KEY = 'recovered_from_invoice';

// Statuses in which the subscription still exists and still grants access, so
// cancelling it actually changes something. Mirrors LIVE_SUBSCRIPTION_STATUSES
// in core/orphanPayment.ts.
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']);

const argv = process.argv.slice(2);
function flag(name: string): boolean {
  return argv.includes(name);
}
function value(name: string): string | null {
  const i = argv.indexOf(name);
  return i >= 0 ? (argv[i + 1] ?? '').trim() || null : null;
}

if (flag('--help') || flag('-h')) {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/unwind-orphan-recovery.mts \\
    --email <addr> [--dry-run | --yes] [--force]

Reverses an orphan recovery that granted a period the member had been refunded
for: cancels the recovery subscription immediately (nothing was charged on it),
returns the users row to its pre-recovery state, and audits it.

Options:
      --email     Member's email address (required).
      --dry-run   Print the plan; no Stripe or DB writes. (Default without --yes.)
  -y, --yes       Apply.
      --force     Skip ONLY the "invoice was refunded in full" check. Use when
                  you are asserting the member is not entitled to this period
                  for some other reason. Never skips the money-collected check.
  -h, --help      Show this help.`);
  process.exit(0);
}

const email = (value('--email') ?? '').toLowerCase() || null;
const apply = flag('--yes') || flag('-y');
const force = flag('--force');
if (!email) {
  console.error('Error: --email is required. See --help.');
  process.exit(1);
}
if (apply && flag('--dry-run')) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('Error: STRIPE_SECRET_KEY is not set (env or .env.local).');
  process.exit(1);
}

const { getDb } = await import('../core/db.ts');
const { readInvoiceRefundedAmount } = await import('../core/stripeInvoice.ts');

const db = getDb();
const stripe = new Stripe(secretKey);

function money(amount: number | null | undefined, currency: string | null | undefined): string {
  if (typeof amount !== 'number') return '—';
  const code = (currency ?? 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${code}`;
  }
}

function fail(message: string, ...detail: string[]): never {
  console.error('');
  console.error(`REFUSING: ${message}`);
  for (const line of detail) console.error(`  ${line}`);
  console.error('');
  console.error('Nothing was changed.');
  process.exit(1);
}

type UserRow = {
  id: string;
  email: string;
  tier: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  subscription_lapsed: number | null;
};

const user = db
  .prepare(
    `SELECT id, email, tier, subscription_status, stripe_customer_id,
            stripe_subscription_id, current_period_end, subscription_lapsed
       FROM users WHERE lower(email) = ? LIMIT 1`,
  )
  .get(email) as UserRow | undefined;

if (!user) fail(`no user found with email ${email}.`);
if (!user.stripe_subscription_id) {
  fail(
    `${user.email} has no subscription on their row — nothing to unwind.`,
    'If a recovery subscription still exists in Stripe, cancel it there.',
  );
}

console.log(`Member:             ${user.email} (id=${user.id})`);
console.log(`Tier (DB):          ${user.tier ?? '—'}`);
console.log(`Subscription (DB):  ${user.stripe_subscription_id} (${user.subscription_status ?? '—'})`);
console.log(`Period end (DB):    ${user.current_period_end ?? '—'}`);

let subscription: Stripe.Subscription;
try {
  subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id, {
    expand: ['discounts.coupon'],
  });
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  fail(`could not read subscription ${user.stripe_subscription_id}: ${message}`,
    'A transient Stripe error must not be read as "already gone".');
}

// --- Guard 1: this must be a recovery ---------------------------------------
const recoveredInvoiceId = subscription.metadata?.[RECOVERED_FROM_INVOICE_KEY] ?? null;
if (!recoveredInvoiceId) {
  fail(
    `subscription ${subscription.id} carries no ${RECOVERED_FROM_INVOICE_KEY} stamp.`,
    'It was not created by orphan recovery, so this script will not touch it.',
    'For an ordinary cancellation use: make cancel-subscription EMAIL=<addr>',
  );
}

console.log(`Recovered from:     ${recoveredInvoiceId}`);
console.log(`Stripe status:      ${subscription.status}`);

// --- Guard 2: the recovered payment must have been given back ---------------
let recoveredInvoice: Stripe.Invoice;
try {
  recoveredInvoice = await stripe.invoices.retrieve(recoveredInvoiceId, {
    expand: ['payment_intent', 'charge'],
  });
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  fail(`could not read the recovered invoice ${recoveredInvoiceId}: ${message}`);
}

const amountPaid = recoveredInvoice.amount_paid ?? 0;
const refunded = readInvoiceRefundedAmount(recoveredInvoice);
console.log(
  `Recovered invoice:  ${money(amountPaid, recoveredInvoice.currency)} paid, ` +
    `${refunded == null ? 'refund state UNREADABLE' : `${money(refunded, recoveredInvoice.currency)} refunded`}` +
    ` (status=${recoveredInvoice.status ?? '—'})`,
);

const fullyRefunded = refunded != null && amountPaid > 0 && refunded >= amountPaid;
if (!fullyRefunded && !force) {
  if (refunded == null) {
    fail(
      `whether ${recoveredInvoiceId} was refunded could not be read from Stripe.`,
      'Not guessed: unwinding a payment the member still holds takes away access',
      'they paid for. Check the charge in the Dashboard, then re-run (--force to override).',
    );
  }
  if (refunded > 0) {
    fail(
      `${recoveredInvoiceId} was only PARTLY refunded (${money(refunded, recoveredInvoice.currency)} of ${money(amountPaid, recoveredInvoice.currency)}).`,
      'Some of this period was genuinely paid for, and how much access the retained',
      'amount buys is your call. Decide it, then use --force or handle by hand.',
    );
  }
  fail(
    `${recoveredInvoiceId} was NOT refunded — the member paid ${money(amountPaid, recoveredInvoice.currency)} and still holds it.`,
    'This was a legitimate orphan recovery. Reversing it would take away a period',
    'they paid for. Nothing to unwind.',
  );
}
if (!fullyRefunded && force) {
  console.log('Refund check:       SKIPPED via --force — you are asserting they are not entitled');
}

// --- Guard 3: no money collected on the recovery subscription ---------------
// Recovery creates the subscription with no invoice of its own, so normally
// there is none. If a renewal has since cleared, real money is involved and a
// refund decision has to come before the cancellation.
let paidOnRecovery: Stripe.Invoice[] = [];
try {
  const list = await stripe.invoices.list({ subscription: subscription.id, limit: 100 });
  paidOnRecovery = list.data.filter((inv) => (inv.amount_paid ?? 0) > 0);
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  fail(`could not list invoices on ${subscription.id}: ${message}`);
}
if (paidOnRecovery.length > 0) {
  fail(
    `${paidOnRecovery.length} invoice(s) have been PAID on recovery subscription ${subscription.id}.`,
    ...paidOnRecovery.map(
      (inv) => `${inv.id} ${money(inv.amount_paid, inv.currency)} paid`,
    ),
    'The member has since been charged real money on this subscription. Refunding',
    'that is your decision and has to happen first — cancelling now would strip the',
    'access they just paid for.',
  );
}
console.log('Paid on this sub:   none — nothing to refund, nothing to collect');

// --- What goes away with it -------------------------------------------------
const subDiscounts = (subscription.discounts ?? [])
  .map((d) => {
    if (typeof d === 'string') return { id: d, coupon: null as string | null, duration: null as string | null };
    const coupon = d.coupon;
    return {
      id: d.id,
      coupon: typeof coupon === 'string' ? coupon : coupon?.id ?? null,
      duration: typeof coupon === 'string' ? null : coupon?.duration ?? null,
    };
  });
for (const d of subDiscounts) {
  console.log(
    `Coupon removed:     ${d.coupon ?? d.id}${d.duration ? ` (duration=${d.duration})` : ''} — dies with the subscription`,
  );
}

// A discount on the CUSTOMER survives the subscription and would silently price
// their next checkout, so it is reported rather than assumed harmless.
if (user.stripe_customer_id) {
  try {
    const customer = await stripe.customers.retrieve(user.stripe_customer_id);
    const custDiscount = (customer as Stripe.Customer).discount;
    if (custDiscount) {
      const coupon = custDiscount.coupon;
      console.log('');
      console.log(
        `  ! CHECK: customer ${user.stripe_customer_id} carries a CUSTOMER-level discount ` +
          `(${typeof coupon === 'string' ? coupon : coupon?.id ?? custDiscount.id}).`,
      );
      console.log('    That is not on the subscription, so cancelling does NOT remove it — it would');
      console.log('    discount their next checkout. Remove it in Stripe if it was not intended.');
    }
  } catch {
    console.log('  (could not read the customer record to check for a customer-level discount)');
  }
}

console.log('');
console.log('Effect:');
if (LIVE_STATUSES.has(subscription.status)) {
  console.log(`  1. cancel ${subscription.id} immediately (no proration invoice)`);
} else {
  console.log(`  1. ${subscription.id} is already '${subscription.status}' — no Stripe change`);
}
console.log(`  2. set ${user.email} back to 'public' and clear the subscription mirror`);
console.log(`  3. write a ${AUDIT_TYPE} audit row`);

if (!apply) {
  console.log('');
  console.log('[dry-run] No Stripe or DB writes. Re-run with --yes to apply.');
  process.exit(0);
}

// --- Apply ------------------------------------------------------------------

// Both statements are PREPARED BEFORE the Stripe cancel, deliberately. The
// cancel is irreversible and the row reset has to follow it, so a mistyped
// column discovered afterwards would leave the subscription gone and the member
// still reading as a paying subscriber. Preparing first moves that failure to
// before anything has happened.
const resetRow = db.prepare(
  `UPDATE users SET
     tier = 'public',
     stripe_subscription_id = NULL,
     stripe_price_id = NULL,
     last_paid_subscription_id = NULL,
     last_paid_invoice_at = NULL,
     subscription_status = ?,
     current_period_end = NULL,
     cancel_at_period_end = 0,
     subscription_lapsed = 1,
     payment_recovery_pending = 0,
     payment_grace_started_at = NULL,
     payment_grace_reason = NULL,
     updated_at = ?
   WHERE id = ?`,
);
const writeAudit = db.prepare(
  `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
   VALUES (?, ?, ?, NULL, ?, 'manual-script', ?, ?)`,
);

let finalStatus = subscription.status;
if (LIVE_STATUSES.has(subscription.status)) {
  try {
    // prorate:false + invoice_now:false — this period was never billed, and we
    // must not raise an invoice on the way out.
    const canceled = await stripe.subscriptions.cancel(subscription.id, {
      prorate: false,
      invoice_now: false,
    });
    finalStatus = canceled.status;
    console.log('');
    console.log(`Canceled ${canceled.id} (${canceled.status}).`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('');
    console.error(`Error: Stripe cancel failed: ${message}`);
    console.error('No DB changes were made.');
    process.exit(1);
  }
} else {
  console.log('');
  console.log(`Subscription already '${subscription.status}' — reconciling the row only.`);
}

// The row lands where it was before the recovery: no tier, no mirror, no
// paid-subscription pointer, and subscription_lapsed re-armed so a genuine
// return still reads as a welcome-back rather than a new signup.
const stamp = new Date().toISOString();
const couponNote = subDiscounts.length
  ? `; removed coupon(s) ${subDiscounts.map((d) => d.coupon ?? d.id).join(', ')}`
  : '';
const refundNote = fullyRefunded
  ? `invoice was refunded in full (${refunded} of ${amountPaid} ${(recoveredInvoice.currency ?? 'usd').toUpperCase()})`
  : 'refund check overridden with --force';

// The reset and its audit row land together or not at all: a reset with no
// record of why is exactly the state this whole incident came out of.
db.exec('BEGIN');
try {
  resetRow.run(finalStatus, stamp, user.id);
  writeAudit.run(
    `audit_${crypto.randomBytes(12).toString('hex')}`,
    AUDIT_TYPE,
    user.id,
    user.email,
    `Unwound orphan recovery: subscription ${subscription.id} (recovered from ${recoveredInvoiceId}) ` +
      `canceled and tier reset to public because ${refundNote}; no invoice had cleared on it${couponNote}`,
    stamp,
  );
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error('');
  console.error(`Error: the row reset failed (${message}).`);
  console.error(`Subscription ${subscription.id} IS ALREADY CANCELED in Stripe, so the member`);
  console.error(`still reads as '${user.tier ?? 'pro'}' locally. Re-run this script — it is`);
  console.error('idempotent and will reconcile the row without touching Stripe again.');
  process.exit(1);
}

console.log(`${user.email} is back on 'public'. Audit row written.`);
console.log('');
console.log('Worth knowing: the recovery sent this member a welcome-back email when it ran.');
console.log('They may believe their subscription was restored. If that needs correcting, it');
console.log('is a note from you — this script sends nothing.');
