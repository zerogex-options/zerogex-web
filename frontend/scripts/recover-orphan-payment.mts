#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/recover-orphan-payment.mts \
//     --email <addr> [--invoice in_...] [--dry-run | --yes]
//
// Restore a member whose payment was ORPHANED — the manual twin of
// maybeRecoverOrphanPayment in app/api/webhooks/stripe/route.ts.
//
// The shape of the problem:
//   1. A trial's conversion charge (or a renewal) fails; Stripe's Smart Retries
//      run and are exhausted; Stripe cancels the subscription for nonpayment.
//      customer.subscription.deleted lands and the member drops to 'public'.
//   2. Stripe leaves that failed invoice OPEN and still payable — its hosted
//      invoice URL is in every dunning email Stripe sent.
//   3. Days later the member fixes their card and pays it. We collect in full.
//      Stripe does NOT resurrect a canceled subscription when its final invoice
//      is paid out of band, so only invoice.paid fires — no subscription event,
//      no tier grant. The member has paid and is still on 'public'.
//
// The webhook now catches this as it happens. This script exists for the ones
// that slipped through BEFORE that shipped: their invoice.paid is already
// recorded in stripe_webhook_events, so re-sending it from the Stripe Dashboard
// is deduped as a redelivery, not replayed.
//
// What it does, with --yes:
//   1. Picks the orphaned invoice (--invoice, or the most recent paid,
//      non-zero invoice on the customer that left no entitlement).
//   2. Re-creates the SAME plan in Stripe with billing_cycle_anchor at the END
//      of the period that invoice paid for and proration_behavior 'none' — so
//      the member gets exactly the access they bought, is NOT charged again for
//      it, and renews normally afterwards. The card that settled the invoice is
//      wired as the subscription default.
//   3. Mirrors the grant onto the users row (tier, subscription mirror, grace
//      latches cleared) for immediacy, and writes an audit row. The
//      customer.subscription.created webhook reconciles to the same values and
//      sends the welcome-back email.
//
// SAFETY: refuses to act when the customer already has a live subscription, or
// when this invoice was already recovered (the recovered_from_invoice metadata
// stamp), so a double-run can never double-bill. Dry-run by default.
//
// Reads STRIPE_SECRET_KEY + STRIPE_PRICE_* from env or .env.local. Set
// AUTH_DB_PATH to override the default DB path (data/auth.db).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

import { decideOrphanPayment, buildRecoverySubscriptionParams, RECOVERED_FROM_INVOICE_KEY } from '../core/orphanPayment.ts';
import {
  readInvoicePaymentMethodId,
  readInvoicePeriodEndUnix,
  readInvoicePeriodStartUnix,
  readInvoicePriceId,
  readInvoiceSubscriptionId,
} from '../core/stripeInvoice.ts';

const AUDIT_TYPE = 'billing_orphan_payment_recovered';

type Tier = 'basic' | 'pro';
type Cadence = 'monthly' | 'annual';

type Args = {
  email: string | null;
  invoice: string | null;
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
  const args: Args = { email: null, invoice: null, dryRun: false, yes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--invoice') args.invoice = (argv[++i] ?? '').trim() || null;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/recover-orphan-payment.mts \\
    --email <addr> [--invoice in_...] [--dry-run | --yes]

Restores a member who paid an invoice AFTER Stripe canceled their subscription
for nonpayment — money collected, no subscription left to grant the tier. The
plan is re-created with billing anchored at the end of the period they already
paid for, so they are never charged twice.

Options:
      --email     Member's email address (required).
      --invoice   Recover this specific invoice. Defaults to the most recent
                  paid, non-zero invoice on the customer that left no
                  entitlement.
      --dry-run   Print the plan; no Stripe or DB writes. (Default without --yes.)
  -y, --yes       Apply: create the subscription, mirror the row, audit it.
  -h, --help      Show this help.

Reads STRIPE_SECRET_KEY and STRIPE_PRICE_* from env or .env.local; set
AUTH_DB_PATH to override the default DB path (data/auth.db).`);
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

function isoOf(unix: number | null | undefined): string {
  return typeof unix === 'number' ? new Date(unix * 1000).toISOString() : '—';
}

function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string {
  if (typeof amount !== 'number' || typeof currency !== 'string') return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${String(currency).toUpperCase()}`;
  }
}

// Mirror core/stripe.ts getCurrentPeriodEndUnix without importing it (that
// module pulls the '@/core/auth' path alias a raw strip-types run can't
// resolve). Item-level first (2024+ API), then the legacy sub-level.
function currentPeriodEndUnix(subscription: Stripe.Subscription): number | null {
  const item = subscription.items?.data?.[0];
  const itemValue = (item as unknown as { current_period_end?: number } | undefined)
    ?.current_period_end;
  if (typeof itemValue === 'number') return itemValue;
  const subValue = (subscription as unknown as { current_period_end?: number })
    .current_period_end;
  if (typeof subValue === 'number') return subValue;
  return null;
}

// Statuses in which a subscription still grants (or can still recover) access on
// its own — kept in sync with LIVE_SUBSCRIPTION_STATUSES in core/orphanPayment.ts.
const LIVE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'];

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

// --- Resolve the price -> sku map from env (mirrors core/stripe.ts) ---------
// A raw `node --experimental-strip-types` run can't resolve the '@/core/*' path
// alias, so the lookup is inlined here from the same env vars the app reads.
// Keep in sync with core/stripe.ts if the keys change.
const PRICE_ENV: Array<{ env: string; tier: Tier; cadence: Cadence }> = [
  { env: 'STRIPE_PRICE_BASIC_MONTHLY', tier: 'basic', cadence: 'monthly' },
  { env: 'STRIPE_PRICE_BASIC_ANNUAL', tier: 'basic', cadence: 'annual' },
  { env: 'STRIPE_PRICE_PRO_MONTHLY', tier: 'pro', cadence: 'monthly' },
  { env: 'STRIPE_PRICE_PRO_ANNUAL', tier: 'pro', cadence: 'annual' },
];
const skuByPriceId = new Map<string, { tier: Tier; cadence: Cadence }>();
for (const p of PRICE_ENV) {
  const id = envOrLocal(p.env);
  if (id) skuByPriceId.set(id, { tier: p.tier, cadence: p.cadence });
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
  tier: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

const rows = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, tier, subscription_status, stripe_customer_id, stripe_subscription_id
   FROM users WHERE lower(email) = '${escapeSqlLiteral(cliArgs.email)}' LIMIT 1;`,
);
const user = rows[0];
if (!user) {
  console.error(`Error: no user found with email ${cliArgs.email}.`);
  process.exit(1);
}
if (!user.stripe_customer_id) {
  console.error(`Error: ${user.email} has no Stripe customer id — nothing was ever charged.`);
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

// --- Find the orphaned invoice ---------------------------------------------
// Every candidate is run through the SAME decision the webhook uses, so the
// script and the automatic path can never disagree about what is recoverable.

type Candidate = {
  invoice: Stripe.Invoice;
  decision: ReturnType<typeof decideOrphanPayment>;
  subscriptionStatus: string | null;
};

async function subscriptionStatusOf(subscriptionId: string | null): Promise<string | null> {
  if (!subscriptionId) return null;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return sub.status;
  } catch (err) {
    const code = (err as { code?: string; statusCode?: number }).code;
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (code === 'resource_missing' || statusCode === 404) return null;
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`Error: could not read subscription ${subscriptionId}: ${message}`);
    console.error('Refusing to continue — a transient Stripe error must not be read as');
    console.error('"the subscription is gone", which would create a second one.');
    process.exit(1);
  }
}

async function evaluate(invoice: Stripe.Invoice): Promise<Candidate> {
  const subscriptionId = readInvoiceSubscriptionId(invoice);
  const subscriptionStatus = await subscriptionStatusOf(subscriptionId);
  const priceId = readInvoicePriceId(invoice);
  return {
    invoice,
    subscriptionStatus,
    decision: decideOrphanPayment({
      amountPaid: invoice.amount_paid ?? 0,
      invoiceStatus: invoice.status ?? null,
      billingReason: invoice.billing_reason ?? null,
      subscriptionId,
      subscriptionStatus,
      localTier: user.tier ?? 'public',
      localSubscriptionId: user.stripe_subscription_id,
      priceId,
      priceMapsToPaidTier: priceId ? skuByPriceId.has(priceId) : false,
      coveredPeriodEndUnix: readInvoicePeriodEndUnix(invoice),
      nowUnix: Math.floor(Date.now() / 1000),
    }),
  };
}

let candidate: Candidate | null = null;

if (cliArgs.invoice) {
  let invoice: Stripe.Invoice;
  try {
    invoice = await stripe.invoices.retrieve(cliArgs.invoice, {
      expand: ['payment_intent', 'charge'],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`Error: could not retrieve invoice ${cliArgs.invoice}: ${message}`);
    process.exit(1);
  }
  const invoiceCustomer =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
  if (invoiceCustomer !== user.stripe_customer_id) {
    console.error(
      `Error: invoice ${cliArgs.invoice} belongs to customer ${invoiceCustomer ?? 'unknown'}, not to ${user.email} (${user.stripe_customer_id}).`,
    );
    process.exit(1);
  }
  candidate = await evaluate(invoice);
} else {
  let invoices: Stripe.Invoice[] = [];
  try {
    const list = await stripe.invoices.list({
      customer: user.stripe_customer_id,
      status: 'paid',
      limit: 20,
      expand: ['data.payment_intent', 'data.charge'],
    });
    invoices = list.data;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`Error: could not list invoices for ${user.email}: ${message}`);
    process.exit(1);
  }
  // Newest first (Stripe's default order). Take the first invoice that left
  // the member with nothing — recoverable or not, so the operator sees WHY.
  for (const invoice of invoices) {
    const evaluated = await evaluate(invoice);
    if (evaluated.decision.kind === 'detected') {
      candidate = evaluated;
      break;
    }
  }
}

console.log(`Auth DB:            ${dbPath}`);
console.log(`Member:             ${user.email} (id=${user.id})`);
console.log(`Tier (DB):          ${user.tier ?? '—'}`);
console.log(`Stripe customer:    ${user.stripe_customer_id}`);

if (!candidate) {
  console.log('');
  console.log('No orphaned payment found: every recent paid invoice on this customer is');
  console.log('either $0, already reflected in their tier, or still owned by a live');
  console.log('subscription. Nothing to recover.');
  process.exit(0);
}

const { invoice, decision, subscriptionStatus } = candidate;
const periodStartUnix = readInvoicePeriodStartUnix(invoice);
const periodEndUnix = readInvoicePeriodEndUnix(invoice);

console.log(`Invoice:            ${invoice.id}  ${formatAmount(invoice.amount_paid, invoice.currency)}  status=${invoice.status ?? '—'}`);
console.log(`  billing reason    ${invoice.billing_reason ?? '—'}`);
console.log(`  paid period       ${isoOf(periodStartUnix)}  →  ${isoOf(periodEndUnix)}`);
console.log(`  subscription      ${readInvoiceSubscriptionId(invoice) ?? '—'} (${subscriptionStatus ?? 'gone'})`);
console.log('');

if (!(decision.kind === 'detected' && decision.recoverable)) {
  const reason = decision.kind === 'detected' ? decision.reason : 'not_orphaned';
  console.log(`This payment left no entitlement, but it cannot be recovered automatically:`);
  console.log(`  reason: ${reason}`);
  console.log('');
  console.log('Handle it by hand in the Stripe Dashboard — the usual options are a refund');
  console.log('of the orphaned amount, or a fresh checkout with a credit applied.');
  process.exit(1);
}

const sku = skuByPriceId.get(decision.priceId)!;
console.log(`Plan to restore:    ${sku.tier} / ${sku.cadence}  (price ${decision.priceId})`);
console.log(`First renewal:      ${isoOf(decision.billingCycleAnchorUnix)}  ← paid period honoured until here`);
console.log(`Charge now:         $0.00  (proration_behavior=none — they already paid for this period)`);
console.log('');
console.log(`Effect: create the subscription in Stripe, set ${user.email} to '${sku.tier}',`);
console.log('and let the customer.subscription.created webhook reconcile + send welcome-back.');

if (!cliArgs.yes) {
  console.log('\n[dry-run] No Stripe or DB writes. Re-run with --yes to apply.');
  process.exit(0);
}

// --- Apply -----------------------------------------------------------------

// Double-charge guard, read from Stripe rather than from our mirror: a live
// subscription anywhere on this customer means there is nothing to restore (the
// row can lag a webhook), and a subscription already stamped with this invoice
// id means a previous run — this script's or the webhook's — recovered it.
let existing: Stripe.Subscription[] = [];
try {
  const list = await stripe.subscriptions.list({
    customer: user.stripe_customer_id,
    status: 'all',
    limit: 100,
  });
  existing = list.data;
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: could not list existing subscriptions: ${message}`);
  console.error('No changes were made.');
  process.exit(1);
}

const live = existing.find((sub) => LIVE_STATUSES.includes(sub.status));
if (live) {
  console.error(`\nError: customer already has a live subscription ${live.id} (${live.status}).`);
  console.error('Nothing to recover — re-run `make diagnose-user` and reconcile the row instead.');
  process.exit(1);
}
const already = existing.find(
  (sub) => sub.metadata?.[RECOVERED_FROM_INVOICE_KEY] === invoice.id,
);
if (already) {
  console.error(`\nError: invoice ${invoice.id} was already recovered as ${already.id} (${already.status}).`);
  process.exit(1);
}

// Renew on the card that actually settled the invoice, not the one that failed.
const paymentMethodId = readInvoicePaymentMethodId(invoice);

const params = buildRecoverySubscriptionParams({
  customerId: user.stripe_customer_id,
  priceId: decision.priceId,
  billingCycleAnchorUnix: decision.billingCycleAnchorUnix,
  invoiceId: invoice.id!,
  periodStartUnix,
  defaultPaymentMethodId: paymentMethodId,
});

// Backdating is cosmetic (it makes the subscription start match the period the
// member paid for); the grant itself comes from billing_cycle_anchor +
// proration_behavior 'none'. Stripe constrains how far back backdate_start_date
// may reach, so a rejection there must not be what leaves a paid-up member on
// 'public' — retry once without it. Mirrors createRecoverySubscription in the
// webhook.
async function createRecoverySubscription(
  createParams: Record<string, unknown>,
): Promise<Stripe.Subscription> {
  try {
    return await stripe.subscriptions.create(
      createParams as unknown as Stripe.SubscriptionCreateParams,
    );
  } catch (err) {
    if (!('backdate_start_date' in createParams)) throw err;
    console.log('Note: Stripe rejected backdate_start_date; retrying without it.');
    const withoutBackdate = { ...createParams };
    delete withoutBackdate.backdate_start_date;
    return await stripe.subscriptions.create(
      withoutBackdate as unknown as Stripe.SubscriptionCreateParams,
    );
  }
}

let created: Stripe.Subscription;
try {
  created = await createRecoverySubscription(params);
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: Stripe subscription create failed: ${message}`);
  console.error('No DB changes were made.');
  process.exit(1);
}

// Mirror the grant onto the row for immediacy — the same columns
// syncSubscriptionToUser writes. The webhook reconciles to identical values when
// customer.subscription.created lands (idempotent), and it — not this script —
// sends the welcome-back email off the still-set subscription_lapsed latch,
// which is why that column is deliberately left alone here.
const stamp = nowIso();
const createdPeriodEnd = currentPeriodEndUnix(created);
execSqlite(
  dbPath,
  `UPDATE users SET
     tier = '${escapeSqlLiteral(sku.tier)}',
     stripe_subscription_id = '${escapeSqlLiteral(created.id)}',
     stripe_price_id = '${escapeSqlLiteral(decision.priceId)}',
     subscription_status = '${escapeSqlLiteral(created.status)}',
     current_period_end = ${createdPeriodEnd ? `'${escapeSqlLiteral(new Date(createdPeriodEnd * 1000).toISOString())}'` : 'NULL'},
     cancel_at_period_end = ${created.cancel_at_period_end ? 1 : 0},
     payment_grace_started_at = NULL,
     payment_grace_reason = NULL,
     payment_recovery_pending = 0,
     updated_at = '${escapeSqlLiteral(stamp)}'
   WHERE id = '${escapeSqlLiteral(user.id)}';`,
);

const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
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
     '${escapeSqlLiteral(`Invoice ${invoice.id} recovered as subscription ${created.id} on price ${decision.priceId}; paid period honoured through ${isoOf(decision.billingCycleAnchorUnix)} (first renewal charge); tier set to ${sku.tier}`)}',
     '${escapeSqlLiteral(stamp)}'
   );`,
);

console.log('');
console.log(`Done. ${user.email} is now '${sku.tier}' on subscription ${created.id} (${created.status}).`);
console.log(`Next charge: ${isoOf(decision.billingCycleAnchorUnix)} — nothing was billed today.`);
console.log('The customer.subscription.created webhook will reconcile the row and send the');
console.log('welcome-back email.');
