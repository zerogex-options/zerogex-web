#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/reinstate-paid-period.mts \
//     --email <addr> [--until <ISO>] [--dry-run | --yes]
//
// Give a member back the REST OF A PERIOD THEY HAD ALREADY PAID FOR, as a comp
// that ends on its own and never bills.
//
// THE SUPPORT SHAPE. A member forgets to cancel, gets billed, writes in, and you
// refund them. There are two kind ways to close that out and they are not the
// same:
//
//   * end the access with the refund — clean, and what `make cancel-subscription`
//     does; or
//   * refund the money but let them keep the period they had paid for, ending at
//     its natural period end.
//
// The second has no path. The subscription is already gone, and Stripe cannot
// un-cancel one — so this re-creates it for the remainder of that period with
// cancel_at_period_end set, which means Stripe holds it open to the end and then
// drops it WITHOUT raising a renewal invoice.
//
// WHAT IT IS NOT. It is not orphan recovery. Recovery re-homes a payment we
// collected and KEPT (core/orphanPayment.ts); this hands back a period whose
// payment went out the door. Both leave a subscription carrying an already-paid
// period, which is why both write an audit row the Subscriber Ledger reads — but
// they are tagged differently, so the ledger says "reinstated as a comp after the
// payment was refunded" rather than reporting a new sale.
//
// DELIBERATELY NOT CARRIED: any coupon the old subscription had. A coupon
// re-applied to a new subscription restarts its clock, so a half-spent 6-month
// promo would be granted in full again. Nothing here bills, so a discount buys
// the member nothing and costs the next renewal real money — there is no next
// renewal, but a resubscribe would inherit nothing either way. Carrying one is
// pure downside. (This is the bug that produced the incident this script came
// out of; see docs/billing-anti-abuse-runbook.md.)
//
// The paid-subscription pointer IS stamped, so the admin headcount counts them
// as a Full Subscriber with a scheduled departure rather than as a conversion
// charge in flight. That is the honest reading of "holds a paid period, leaving
// on a known date" — but note it DOES count them in the paying total until the
// period ends, and the money was refunded. The audit row records that.
//
// The welcome-back email is suppressed: subscription_lapsed is cleared BEFORE
// the subscription is created, which is the latch maybeSendPaidWelcomeEmail
// reads. A member who has just been told their subscription is closed must not
// then be congratulated on its return.
//
// SAFETY: refuses when the member already has a live subscription, when the
// period to honor has already elapsed, or when the price cannot be mapped to a
// tier. Dry-run by default.
//
// Reads STRIPE_SECRET_KEY + STRIPE_PRICE_* from env or .env.local. Set
// AUTH_DB_PATH to override the DB path (data/auth.db).

import crypto from 'node:crypto';

import Stripe from 'stripe';

import { loadEnvLocal, warnIfPricesUnconfigured } from './env-local.mts';

loadEnvLocal();

const AUDIT_TYPE = 'billing_paid_period_reinstated';
const COMPED_FROM_INVOICE_KEY = 'comped_period_from_invoice';
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']);

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string) => {
  const i = argv.indexOf(f);
  return i >= 0 ? (argv[i + 1] ?? '').trim() || null : null;
};

if (has('--help') || has('-h')) {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/reinstate-paid-period.mts \\
    --email <addr> [--until <ISO>] [--dry-run | --yes]

Re-creates a canceled subscription for the remainder of a period the member had
already paid for, set to cancel at period end so it never bills. For the case
where you refunded someone but want them to keep the access they had bought.

Options:
      --email     Member's email address (required).
      --until     End of the period to honor, ISO 8601. Defaults to the period
                  end of their most recent paid non-zero invoice.
      --dry-run   Print the plan; no writes. (Default without --yes.)
  -y, --yes       Apply.
  -h, --help      Show this help.`);
  process.exit(0);
}

const email = (val('--email') ?? '').toLowerCase() || null;
const untilArg = val('--until');
const apply = has('--yes') || has('-y');
if (!email) {
  console.error('Error: --email is required. See --help.');
  process.exit(1);
}
if (apply && has('--dry-run')) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('Error: STRIPE_SECRET_KEY is not set (env or .env.local).');
  process.exit(1);
}
warnIfPricesUnconfigured();

const { getDb } = await import('../core/db.ts');
const { priceIdToSku } = await import('../core/stripe.ts');
const {
  readInvoicePaidAtUnix,
  readInvoicePeriodEndUnix,
  readInvoicePeriodStartUnix,
  readInvoicePriceId,
  readInvoicePaymentMethodId,
  readInvoiceRefundedAmount,
} = await import('../core/stripeInvoice.ts');
const { buildRecoverySubscriptionParams } = await import('../core/orphanPayment.ts');

const db = getDb();
const stripe = new Stripe(secretKey);

const money = (a: number | null | undefined, c: string | null | undefined) =>
  typeof a !== 'number'
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: (c ?? 'usd').toUpperCase() }).format(a / 100);
const isoOf = (u: number | null | undefined) => (typeof u === 'number' ? new Date(u * 1000).toISOString() : '—');

function fail(message: string, ...detail: string[]): never {
  console.error('');
  console.error(`REFUSING: ${message}`);
  for (const d of detail) console.error(`  ${d}`);
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
};

const user = db
  .prepare(
    `SELECT id, email, tier, subscription_status, stripe_customer_id, stripe_subscription_id
       FROM users WHERE lower(email) = ? LIMIT 1`,
  )
  .get(email) as UserRow | undefined;

if (!user) fail(`no user found with email ${email}.`);
if (!user.stripe_customer_id) fail(`${user.email} has no Stripe customer — nothing was ever billed.`);

console.log(`Member:             ${user.email} (id=${user.id})`);
console.log(`Tier (DB):          ${user.tier ?? '—'}`);
console.log(`Subscription (DB):  ${user.stripe_subscription_id ?? '—'} (${user.subscription_status ?? '—'})`);

// --- Guard: nothing live, in Stripe or on the row --------------------------
let existing: Stripe.Subscription[] = [];
try {
  const list = await stripe.subscriptions.list({ customer: user.stripe_customer_id, status: 'all', limit: 100 });
  existing = list.data;
} catch (err) {
  fail(`could not list subscriptions: ${err instanceof Error ? err.message : 'unknown error'}`);
}
const live = existing.find((sub) => LIVE_STATUSES.has(sub.status));
if (live) {
  fail(
    `${user.email} already has a live subscription ${live.id} (${live.status}).`,
    'There is nothing to reinstate. To schedule its end instead, use:',
    `  make set-cancellation EMAIL=${user.email} ON=1 YES=1`,
  );
}

// --- Pick the period to honor ----------------------------------------------
let invoice: Stripe.Invoice | null = null;
try {
  const list = await stripe.invoices.list({
    customer: user.stripe_customer_id,
    status: 'paid',
    limit: 20,
    expand: ['data.payment_intent', 'data.charge'],
  });
  // Newest paid, non-zero invoice: the one that bought the period in question.
  invoice = list.data.find((inv) => (inv.amount_paid ?? 0) > 0) ?? null;
} catch (err) {
  fail(`could not list invoices: ${err instanceof Error ? err.message : 'unknown error'}`);
}
if (!invoice) {
  fail(`no paid, non-zero invoice on ${user.email} — there is no paid period to reinstate.`);
}

const periodStartUnix = readInvoicePeriodStartUnix(invoice);
const invoicePeriodEndUnix = readInvoicePeriodEndUnix(invoice);
const refunded = readInvoiceRefundedAmount(invoice);
const priceId = readInvoicePriceId(invoice);

let untilUnix: number | null = invoicePeriodEndUnix;
if (untilArg) {
  const parsed = Date.parse(untilArg);
  if (!Number.isFinite(parsed)) fail(`--until "${untilArg}" is not a valid ISO 8601 instant.`);
  untilUnix = Math.floor(parsed / 1000);
}

console.log(
  `Paid invoice:       ${invoice.id}  ${money(invoice.amount_paid, invoice.currency)}` +
    `${refunded != null && refunded > 0 ? `  (${money(refunded, invoice.currency)} refunded)` : ''}`,
);
console.log(`  paid period       ${isoOf(periodStartUnix)}  ->  ${isoOf(invoicePeriodEndUnix)}`);
console.log(`Honor access until: ${isoOf(untilUnix)}${untilArg ? '  (from --until)' : ''}`);

if (untilUnix == null) fail('the period end could not be resolved from the invoice; pass --until <ISO>.');
const nowUnix = Math.floor(Date.now() / 1000);
if (untilUnix <= nowUnix) {
  fail(
    `that period ended at ${isoOf(untilUnix)}, which is in the past.`,
    'There is no remaining access to hand back, and Stripe rejects a billing anchor',
    'in the past. If they are owed something, it is a credit or a fresh checkout.',
  );
}
if (!priceId) fail('the price on that invoice could not be resolved; nothing to re-create.');
const sku = priceIdToSku(priceId);
if (!sku) {
  fail(
    `price ${priceId} does not map to a current plan.`,
    'Re-creating it would grant an undefined tier. Set it up by hand in Stripe.',
  );
}

const existingComp = existing.find((sub) => sub.metadata?.[COMPED_FROM_INVOICE_KEY] === invoice.id);
if (existingComp) {
  fail(
    `invoice ${invoice.id} was already reinstated as ${existingComp.id} (${existingComp.status}).`,
    'A second run would hand out the same period twice.',
  );
}

console.log('');
console.log(`Plan to reinstate:  ${sku.tier} / ${sku.cadence}  (price ${priceId})`);
console.log(`Charge now:         $0.00  (proration_behavior=none)`);
console.log(`Charge at period end: NONE — created with cancel_at_period_end, so Stripe`);
console.log(`                    drops it at ${isoOf(untilUnix)} without invoicing`);
console.log('Coupons carried:    none, deliberately — a re-applied coupon restarts its clock');
console.log('Welcome-back email: suppressed (subscription_lapsed cleared before the create)');
console.log('');
console.log('Effect:');
console.log(`  1. create a ${sku.tier} subscription for ${user.email}, ending ${isoOf(untilUnix)}`);
console.log(`  2. set the row to '${sku.tier}' with the cancellation already scheduled`);
console.log(`  3. write a ${AUDIT_TYPE} audit row`);
console.log('');
console.log('NOTE: they will count as a Full Subscriber in the admin headcount until the');
console.log('period ends, and appear under "Leaving Next" with a dated departure. The money');
console.log(`for this period was refunded${refunded != null && refunded > 0 ? '' : ' (check that — no refund was detected)'}, so that one is a comped subscriber, not revenue.`);

if (!apply) {
  console.log('');
  console.log('[dry-run] No Stripe or DB writes. Re-run with --yes to apply.');
  process.exit(0);
}

// --- Apply ------------------------------------------------------------------

// Prepared before the Stripe create, so a bad column cannot surface after an
// object has been made in Stripe.
const mirrorRow = db.prepare(
  `UPDATE users SET
     tier = ?,
     stripe_subscription_id = ?,
     stripe_price_id = ?,
     subscription_status = ?,
     current_period_end = ?,
     cancel_at_period_end = 1,
     last_paid_subscription_id = ?,
     last_paid_invoice_at = ?,
     payment_grace_started_at = NULL,
     payment_grace_reason = NULL,
     payment_recovery_pending = 0,
     updated_at = ?
   WHERE id = ?`,
);
const writeAudit = db.prepare(
  `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
   VALUES (?, ?, ?, NULL, ?, 'manual-script', ?, ?)`,
);

// Disarm the welcome-back latch FIRST. maybeSendPaidWelcomeEmail fires off
// subscription_lapsed=1 when customer.subscription.created lands, and that event
// cannot arrive before the create call below is even made — so doing it here
// closes the window entirely rather than racing it.
db.prepare(`UPDATE users SET subscription_lapsed = 0, updated_at = ? WHERE id = ?`).run(
  new Date().toISOString(),
  user.id,
);

const params = buildRecoverySubscriptionParams({
  customerId: user.stripe_customer_id,
  priceId,
  billingCycleAnchorUnix: untilUnix,
  invoiceId: invoice.id!,
  periodStartUnix,
  defaultPaymentMethodId: readInvoicePaymentMethodId(invoice),
  carryCouponIds: [],
});
// Stamp the metadata under this script's own key: the recovery key is an
// idempotency guard for a DIFFERENT operation, and a comp must not read as a
// recovered payment to it or to anything else.
params.metadata = { [COMPED_FROM_INVOICE_KEY]: invoice.id };
// The whole point: Stripe holds it to the period end and then drops it with no
// renewal invoice.
params.cancel_at_period_end = true;

// backdate_start_date is cosmetic — it lines the member's invoice history up
// with the period they bought — and some Stripe states reject it. Dropping it
// and retrying beats failing, which would leave a refunded member with none of
// the access this is meant to hand back. Same degradation as
// createRecoverySubscription in the webhook; nothing load-bearing is optional,
// so the retry cannot quietly change what the member gets.
async function createComp(create: Record<string, unknown>): Promise<Stripe.Subscription> {
  const attempt = { ...create };
  for (;;) {
    try {
      return await stripe.subscriptions.create(attempt as unknown as Stripe.SubscriptionCreateParams);
    } catch (err) {
      if (!('backdate_start_date' in attempt)) throw err;
      console.log('Note: Stripe rejected backdate_start_date; retrying without it.');
      delete attempt.backdate_start_date;
    }
  }
}

let created: Stripe.Subscription;
try {
  created = await createComp(params);
} catch (err) {
  // Restore the latch: no subscription exists, so a later genuine return should
  // still read as a welcome-back.
  db.prepare(`UPDATE users SET subscription_lapsed = 1, updated_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    user.id,
  );
  console.error('');
  console.error(`Error: Stripe subscription create failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  console.error('No DB changes were kept.');
  process.exit(1);
}

const stamp = new Date().toISOString();
const periodEndIso = new Date(untilUnix * 1000).toISOString();
// last_paid_invoice_at records WHEN THE MONEY MOVED, which is the original
// invoice's paid-at — not the period end, and not now. Only the pointer's
// identity decides the bucket, so this date is purely for whoever reads
// `make diagnose-user`; dating it the period end told them an invoice had
// cleared on a date still in the future. Same source the recovery paths use.
const invoicePaidAtUnix = readInvoicePaidAtUnix(invoice);
const paidAtIso = invoicePaidAtUnix != null ? new Date(invoicePaidAtUnix * 1000).toISOString() : stamp;
db.exec('BEGIN');
try {
  mirrorRow.run(
    sku.tier,
    created.id,
    priceId,
    created.status,
    periodEndIso,
    created.id,
    paidAtIso,
    stamp,
    user.id,
  );
  writeAudit.run(
    `audit_${crypto.randomBytes(12).toString('hex')}`,
    AUDIT_TYPE,
    user.id,
    user.email,
    `Invoice ${invoice.id} recovered as subscription ${created.id} on price ${priceId}; ` +
      `paid period REINSTATED AS A COMP through ${periodEndIso}, cancel_at_period_end set so it ` +
      `never bills; tier set to ${sku.tier}; no coupons carried; ` +
      `${refunded != null && refunded > 0 ? `the ${refunded} was refunded, so this period is comped, not revenue` : 'no refund was detected on that invoice — confirm this period should be free'}`,
    stamp,
  );
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  console.error('');
  console.error(`Error: the row mirror failed (${err instanceof Error ? err.message : 'unknown error'}).`);
  console.error(`Subscription ${created.id} EXISTS in Stripe but the row was not updated.`);
  console.error('The customer.subscription.created webhook should reconcile it; verify with');
  console.error(`  make diagnose-user EMAIL=${user.email}`);
  process.exit(1);
}

console.log('');
console.log(`Done. ${user.email} is '${sku.tier}' on ${created.id} (${created.status}).`);
console.log(`Access ends ${periodEndIso}; cancel_at_period_end is set, so nothing will be charged.`);
console.log('No email was sent.');
