#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/restore-trial-after-switch.mts \
//     --email <addr> [--trial-end <ISO>] [--invoice in_...] [--skip-refund] [--dry-run | --yes]
//
// Make-good for a member whose FREE TRIAL was wrongly ended (and card charged)
// when they switched plan/cadence in the billing portal — the bug where the
// portal config used Stripe's default "end trial & invoice immediately" behavior
// instead of continue_trial. This script:
//
//   1. Refunds the wrongful charge in full (the most recent paid, non-zero
//      invoice on the customer — override with --invoice, or skip with
//      --skip-refund if you already refunded by hand).
//   2. Restores the free trial by setting the subscription's trial_end to a
//      FUTURE date (proration_behavior=none), which moves the subscription back
//      to 'trialing' so no charge lands until then. Defaults to a fresh 7-day
//      trial from now; override with --trial-end for a longer goodwill window.
//   3. Verifies the correct cadence promo coupon is still attached so the
//      eventual trial->paid conversion charges the right amount (e.g. the annual
//      $49-off promo => $150, not rack rate). If it's missing, it says so and
//      points at scripts/fix-plan-switch-discount.mts — it does NOT change
//      coupons itself (single responsibility).
//   4. Re-mirrors the users row (status=trialing, current_period_end=trial_end)
//      and re-arms the ~48h trial reminder latch, exactly like extend-trial.mts.
//
// Refund happens FIRST and, if it fails, the script aborts before touching the
// trial — so the promise-critical money-back step is never skipped silently.
//
// Records an audit_events row (type billing_trial_restored_after_switch).
// Read-only until --yes; --dry-run prints the full plan with no writes.
//
// PREVENTION (do this too, or it recurs): the underlying cause is the billing
// portal configuration. Run scripts/setup-billing-portal.mts with
// --trial-update-behavior continue_trial and pin the printed bpc_... id into
// STRIPE_PORTAL_CONFIG_ID so switches keep the trial instead of charging.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

const AUDIT_TYPE = 'billing_trial_restored_after_switch';
// Stripe rejects a trial_end < ~48h out, and the ~48h reminder can only fire if
// the new end is at least that far away. Match extend-trial.mts / the checkout route.
const MIN_TRIAL_END_BUFFER_MS = 48 * 60 * 60 * 1000;

type Tier = 'basic' | 'pro';
type Cadence = 'monthly' | 'annual';

type Args = {
  email: string | null;
  trialEndIso: string | null;
  invoiceId: string | null;
  skipRefund: boolean;
  dryRun: boolean;
  yes: boolean;
  help: boolean;
};

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    email: null,
    trialEndIso: null,
    invoiceId: null,
    skipRefund: false,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--trial-end') args.trialEndIso = (argv[++i] ?? '').trim() || null;
    else if (arg === '--invoice') args.invoiceId = (argv[++i] ?? '').trim() || null;
    else if (arg === '--skip-refund') args.skipRefund = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (!arg.startsWith('--') && !args.email) args.email = arg.trim().toLowerCase() || null;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/restore-trial-after-switch.mts \\
    --email <addr> [--trial-end <ISO>] [--invoice in_...] [--skip-refund] [--dry-run | --yes]

Refunds the wrongful charge and restores the free trial for a member whose trial
was ended by a portal plan switch. Then verifies the promo coupon so the eventual
conversion charges the correct amount.

Options:
      --trial-end <ISO>  Restored trial end, e.g. 2026-07-23T16:00:00Z. Must be
                         >48h out. Defaults to a fresh 7-day trial from now.
      --invoice in_...   Refund this specific invoice's charge. Default: the most
                         recent paid, non-zero invoice on the customer.
      --skip-refund      Don't refund (use if you already refunded by hand).
      --dry-run          Print the plan; no Stripe or DB writes.
  -y, --yes              Apply: refund, restore the trial, re-mirror the row.
  -h, --help             Show this help.

Only operates on a subscription Stripe reports as 'active' (the wrongful-
conversion state). If it's already 'trialing', use scripts/extend-trial.mts.

Reads STRIPE_SECRET_KEY, the STRIPE_PRICE_* ids and STRIPE_COUPON_PROMO_* envs
from env or .env.local. Set AUTH_DB_PATH to override the DB path (data/auth.db).`);
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH.');
    console.error('Install it with: sudo apt-get install sqlite3');
    process.exit(1);
  }
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function runSqlite(dbPath: string, sql: string): string {
  try {
    return execFileSync('sqlite3', ['-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr;
    const message =
      typeof stderr === 'string' ? stderr : stderr?.toString?.() ?? (err as Error).message;
    throw new Error(message.trim() || (err as Error).message);
  }
}

function querySqlite<T = Record<string, unknown>>(dbPath: string, sql: string): T[] {
  const output = runSqlite(dbPath, sql).trim();
  if (!output) return [];
  return JSON.parse(output) as T[];
}

function execSqlite(dbPath: string, sql: string) {
  runSqlite(dbPath, sql);
}

function nowIso() {
  return new Date().toISOString();
}

function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || currency == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${(currency ?? 'usd').toUpperCase()}`;
  }
}

// Mirror core/stripe.ts getCurrentPeriodEndUnix without importing it (the '@/'
// alias doesn't resolve under raw --experimental-strip-types). During a trial
// this equals trial_end; read item-level first (2024+ API), then legacy sub-level.
function currentPeriodEndUnix(subscription: Stripe.Subscription): number | null {
  const item = subscription.items?.data?.[0];
  const itemValue = (item as unknown as { current_period_end?: number } | undefined)
    ?.current_period_end;
  if (typeof itemValue === 'number') return itemValue;
  const subValue = (subscription as unknown as { current_period_end?: number }).current_period_end;
  if (typeof subValue === 'number') return subValue;
  return null;
}

// ---------------------------------------------------------------------------

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  usage();
  process.exit(0);
}
if (!cliArgs.email) {
  console.error('Error: --email is required. See --help.');
  process.exit(1);
}
if (cliArgs.dryRun && cliArgs.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
function envOrLocal(key: string): string | undefined {
  return process.env[key] || envLocal[key] || undefined;
}

const STRIPE_SECRET_KEY = envOrLocal('STRIPE_SECRET_KEY');
if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY not set in env or .env.local.');
  process.exit(1);
}

// Default restored trial: a fresh standard 7-day trial from now (matches the
// product's TRIAL_PERIOD_DAYS in the checkout route), so "restore the trial"
// gives back a normal trial rather than a surprise long comp. Override with
// --trial-end for an exact date or a longer goodwill window. Comfortably past
// Stripe's ~48h trial_end floor.
const DEFAULT_TRIAL_DAYS = 7;
let newTrialEndMs: number;
if (cliArgs.trialEndIso) {
  const ms = Date.parse(cliArgs.trialEndIso);
  if (!Number.isFinite(ms)) {
    console.error(`Error: --trial-end is not a valid date: ${cliArgs.trialEndIso}`);
    process.exit(1);
  }
  newTrialEndMs = ms;
} else {
  newTrialEndMs = Date.now() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000;
}
const nowMs = Date.now();
if (newTrialEndMs - nowMs < MIN_TRIAL_END_BUFFER_MS) {
  console.error(
    `Error: restored trial end must be at least 48h from now. Got ${new Date(newTrialEndMs).toISOString()}.`,
  );
  process.exit(1);
}
const newTrialEndUnix = Math.floor(newTrialEndMs / 1000);
const newTrialEndIso = new Date(newTrialEndMs).toISOString();

// Price id -> (tier, cadence), for display + coupon verification.
const skuByPriceId = new Map<string, { tier: Tier; cadence: Cadence }>();
for (const [env, tier, cadence] of [
  ['STRIPE_PRICE_BASIC_MONTHLY', 'basic', 'monthly'],
  ['STRIPE_PRICE_BASIC_ANNUAL', 'basic', 'annual'],
  ['STRIPE_PRICE_PRO_MONTHLY', 'pro', 'monthly'],
  ['STRIPE_PRICE_PRO_ANNUAL', 'pro', 'annual'],
] as Array<[string, Tier, Cadence]>) {
  const id = envOrLocal(env);
  if (id) skuByPriceId.set(id, { tier, cadence });
}
function configuredPromoCouponId(tier: Tier, cadence: Cadence): string | null {
  const key =
    cadence === 'monthly'
      ? tier === 'basic'
        ? 'STRIPE_COUPON_PROMO_BASIC_MONTHLY'
        : 'STRIPE_COUPON_PROMO_PRO_MONTHLY'
      : tier === 'basic'
        ? 'STRIPE_COUPON_PROMO_BASIC_ANNUAL'
        : 'STRIPE_COUPON_PROMO_PRO_ANNUAL';
  return envOrLocal(key) ?? null;
}

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

ensureSqlite3Cli();

type UserRow = {
  id: string;
  email: string;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  trial_reminder_email_sent_at: string | null;
};

const rows = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, subscription_status, stripe_customer_id, stripe_subscription_id,
          stripe_price_id, trial_reminder_email_sent_at
   FROM users WHERE lower(email) = '${escapeSqlLiteral(cliArgs.email)}' LIMIT 1;`,
);
const user = rows[0];
if (!user) {
  console.error(`Error: no user found with email ${cliArgs.email}.`);
  process.exit(1);
}
if (!user.stripe_subscription_id || !user.stripe_customer_id) {
  console.error(`Error: ${user.email} has no Stripe subscription/customer on file.`);
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

// --- Live Stripe reads -------------------------------------------------------

let subscription: Stripe.Subscription;
try {
  subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id, {
    expand: ['items.data.price', 'discounts'],
  });
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Error: could not retrieve subscription ${user.stripe_subscription_id}: ${message}`);
  process.exit(1);
}

if (subscription.status !== 'active') {
  console.error(
    `Error: Stripe reports subscription ${subscription.id} as '${subscription.status}', not 'active'.`,
  );
  console.error(
    "       This tool restores a trial that a switch wrongly converted. If it's already",
  );
  console.error('       trialing, use scripts/extend-trial.mts instead.');
  process.exit(1);
}

const item0 = subscription.items.data[0];
const priceId = item0?.price?.id ?? null;
const sku = priceId ? skuByPriceId.get(priceId) ?? null : null;
const priceLabel = item0?.price
  ? `${formatMoney(item0.price.unit_amount, item0.price.currency)} / ${item0.price.recurring?.interval ?? '?'}`
  : '—';

// Coupon presence check (verification only — this script never mutates coupons).
type SubDiscount = { coupon?: { id?: string } | string | null };
const subCouponIds: string[] = [];
for (const d of ((subscription as unknown as { discounts?: SubDiscount[] }).discounts ??
  []) as SubDiscount[]) {
  const c = d?.coupon;
  const id = typeof c === 'string' ? c : c?.id;
  if (id && !subCouponIds.includes(id)) subCouponIds.push(id);
}
const expectedCoupon = sku ? configuredPromoCouponId(sku.tier, sku.cadence) : null;
const couponOk = expectedCoupon != null && subCouponIds.includes(expectedCoupon);

// Find the invoice to refund: explicit --invoice, else the most recent paid,
// non-zero invoice on the customer (the wrongful conversion charge).
let refundInvoice: Stripe.Invoice | null = null;
if (!cliArgs.skipRefund) {
  try {
    if (cliArgs.invoiceId) {
      refundInvoice = await stripe.invoices.retrieve(cliArgs.invoiceId);
    } else {
      const list = await stripe.invoices.list({ customer: user.stripe_customer_id, limit: 10 });
      refundInvoice =
        list.data.find(
          (inv) => inv.status === 'paid' && typeof inv.amount_paid === 'number' && inv.amount_paid > 0,
        ) ?? null;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`Error: could not look up the invoice to refund: ${message}`);
    process.exit(1);
  }
  if (!refundInvoice) {
    console.error(
      'Error: no paid, non-zero invoice found to refund. Pass --invoice in_... explicitly,',
    );
    console.error('       or --skip-refund if the charge was already refunded.');
    process.exit(1);
  }
}

// Resolve the charge behind the invoice (for the refund call).
function invoiceChargeId(inv: Stripe.Invoice): string | null {
  const charge = (inv as unknown as { charge?: string | { id?: string } | null }).charge;
  if (typeof charge === 'string') return charge;
  if (charge && typeof charge === 'object' && charge.id) return charge.id;
  return null;
}
function invoicePaymentIntentId(inv: Stripe.Invoice): string | null {
  const pi = (inv as unknown as { payment_intent?: string | { id?: string } | null }).payment_intent;
  if (typeof pi === 'string') return pi;
  if (pi && typeof pi === 'object' && pi.id) return pi.id;
  return null;
}

const refundChargeId = refundInvoice ? invoiceChargeId(refundInvoice) : null;
const refundPaymentIntentId = refundInvoice ? invoicePaymentIntentId(refundInvoice) : null;
if (refundInvoice && !refundChargeId && !refundPaymentIntentId) {
  console.error(
    `Error: invoice ${refundInvoice.id} has no charge/payment_intent to refund. Refund it by hand`,
  );
  console.error('       in the dashboard, then re-run with --skip-refund.');
  process.exit(1);
}

// --- Print the plan ----------------------------------------------------------

console.log(`Auth DB:            ${dbPath}`);
console.log(`Stripe:             ${STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE mode' : 'test mode'}`);
console.log(`Customer:           ${user.email} (id=${user.id}, ${user.stripe_customer_id})`);
console.log(`Subscription:       ${subscription.id}`);
console.log(`Status:             ${subscription.status}  (will become 'trialing')`);
console.log(`Plan:               ${sku ? `${sku.tier}/${sku.cadence}` : 'unknown'} — ${priceLabel}`);
console.log(
  `Discounts:          ${subCouponIds.length ? subCouponIds.join(', ') : 'none'}${
    expectedCoupon ? ` (expected for this plan: ${expectedCoupon} → ${couponOk ? 'present ✓' : 'MISSING ✗'})` : ''
  }`,
);
console.log('');
if (refundInvoice) {
  console.log(
    `Refund:             ${refundInvoice.id} → ${formatMoney(refundInvoice.amount_paid, refundInvoice.currency)} back to card ` +
      `(via ${refundChargeId ? `charge ${refundChargeId}` : `payment_intent ${refundPaymentIntentId}`})`,
  );
} else {
  console.log('Refund:             skipped (--skip-refund)');
}
console.log(`Restore trial end:  ${newTrialEndIso}  (${((newTrialEndMs - nowMs) / 86_400_000).toFixed(1)}d from now)`);
console.log('');
console.log('On apply (in order):');
console.log('  1. Refund the wrongful charge in full (money back to his card).');
console.log('  2. subscription.trial_end → restored date (proration_behavior=none) → back to trialing.');
console.log('  3. Re-mirror users row: status=trialing, current_period_end, re-arm ~48h reminder.');
if (!couponOk && expectedCoupon) {
  console.log('');
  console.log(
    `WARNING: the expected promo coupon (${expectedCoupon}) is NOT on the subscription, so the`,
  );
  console.log(
    '         eventual conversion would charge rack rate. Fix it first with:',
  );
  console.log(`           scripts/fix-plan-switch-discount.mts --email ${user.email} --yes`);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No Stripe or DB writes.');
  process.exit(0);
}
if (!cliArgs.yes) {
  console.log(
    '\nRefusing to write without --yes. Re-run with --yes to apply, or --dry-run to preview.',
  );
  process.exit(1);
}

// --- Apply (refund FIRST; abort if it fails) --------------------------------

let refundId: string | null = null;
if (refundInvoice) {
  try {
    const refund = await stripe.refunds.create(
      refundChargeId ? { charge: refundChargeId } : { payment_intent: refundPaymentIntentId! },
    );
    refundId = refund.id;
    console.log(`\nRefunded: ${refund.id} (${formatMoney(refund.amount, refund.currency)}), status=${refund.status}.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`\nError: refund failed: ${message}`);
    console.error('Aborted BEFORE changing the trial — no other changes were made.');
    process.exit(1);
  }
}

let updated: Stripe.Subscription;
try {
  updated = await stripe.subscriptions.update(subscription.id, {
    trial_end: newTrialEndUnix,
    proration_behavior: 'none',
  });
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: restoring the trial failed: ${message}`);
  console.error(
    refundId
      ? `The refund (${refundId}) already succeeded. Set trial_end on ${subscription.id} by hand in the dashboard to finish.`
      : 'No refund was issued. No changes were made beyond this failed update.',
  );
  process.exit(1);
}

const mirroredEndUnix = currentPeriodEndUnix(updated) ?? newTrialEndUnix;
const mirroredEndIso = new Date(mirroredEndUnix * 1000).toISOString();
const stamp = nowIso();

// Re-mirror the row immediately (the webhook's customer.subscription.updated will
// converge to the same values; these writes are idempotent).
execSqlite(
  dbPath,
  `UPDATE users SET
     subscription_status = 'trialing',
     current_period_end = '${escapeSqlLiteral(mirroredEndIso)}',
     trial_reminder_email_sent_at = NULL,
     updated_at = '${escapeSqlLiteral(stamp)}'
   WHERE id = '${escapeSqlLiteral(user.id)}';`,
);

const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
const auditMessage =
  `Restored trial after wrongful switch-conversion on sub ${subscription.id}: ` +
  `${refundId ? `refunded ${refundInvoice?.id} (${refundId})` : 'refund skipped'}, ` +
  `trial_end → ${newTrialEndIso}, coupon ${couponOk ? expectedCoupon : 'CHECK'}`;
execSqlite(
  dbPath,
  `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
   VALUES (
     '${escapeSqlLiteral(auditId)}',
     '${escapeSqlLiteral(AUDIT_TYPE)}',
     '${escapeSqlLiteral(user.id)}',
     NULL,
     '${escapeSqlLiteral(user.email)}',
     'manual-script',
     '${escapeSqlLiteral(auditMessage)}',
     '${escapeSqlLiteral(stamp)}'
   );`,
);

console.log(`\nDone. ${user.email} is back on a free trial until ${newTrialEndIso}.`);
console.log(
  couponOk
    ? `When it converts, Stripe will charge the correct promo price (coupon ${expectedCoupon}).`
    : 'NOTE: verify the promo coupon before the trial converts (see the warning above).',
);
console.log('Reminder latch re-armed; the ~48h nudge will fire before the new end.');
