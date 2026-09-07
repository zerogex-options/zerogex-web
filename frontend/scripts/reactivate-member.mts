#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/reactivate-member.mts \
//     --email <addr> [--days N | --trial-end <iso>] [--tier basic|pro] \
//     [--cadence monthly|annual] [--price price_...] [--payment-method pm_...] \
//     [--wait-seconds N] [--dry-run | --yes]
//
// Bring a CHURNED member back on a goodwill trial with NOTHING for them to do —
// no second checkout, no re-entering a card. Re-creates the subscription in
// Stripe on the customer and payment method already on file, with an absolute
// trial_end, and lets the webhook do the rest.
//
// Why this exists — the gap between the neighbouring targets:
//   • extend-trial only pushes out trial_end on a sub Stripe reports as
//     'trialing'. Once customer.subscription.deleted lands there is nothing
//     left to extend. set-cancellation, honor-winback-discount and the
//     one-click /save link all need a live trialing/active sub too.
//   • Sending them back through checkout works, but the once-per-account trial
//     gate (hasPriorPaidSubscription, app/api/billing/checkout/route.ts) gives a
//     returning member NO trial — they are charged on the spot — unless you
//     first rewrite their history with reset-user-for-testing, which drops them
//     out of the churn reporting and re-fires the first-time welcome email. And
//     it is still a step for THEM, which is the whole thing you were avoiding.
// This script skips checkout entirely: subscriptions.create with a trial_end.
//
// Writes NOTHING to the users row. The webhook is the authority and already
// does all of it on customer.subscription.created: grants the tier from the
// PRICE (so it survives renewals, unlike a hand-written tier), mirrors
// status/current_period_end, clears subscription_lapsed, sends the welcome-back
// email, and re-arms both trial nudges. The only local write is an
// audit_events row. After creating, this WAITS for that webhook and reports
// what it wrote, so you never leave the member in Stripe-but-not-granted limbo.
//
// Guards: refuses a member who already has a live or pending subscription
// (trialing, active, past_due, unpaid, incomplete, paused), a member with no
// Stripe customer, and a customer with no usable payment method — a trial with
// no card on file just cancels itself at trial end. trial_end must be >= 48h
// out (Stripe's own floor) and <= 365 days (typo guard).
//
// Sends no email of its own. Reads STRIPE_SECRET_KEY from env or .env.local;
// set AUTH_DB_PATH to override the default DB path (data/auth.db).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

const AUDIT_TYPE = 'billing_manual_reactivation';

// Must track core/stripe.ts. Duplicated rather than imported because that module
// pulls the '@/core/auth' path alias, which a raw strip-types run cannot resolve.
const STRIPE_API_VERSION = '2025-02-24.acacia';

// A goodwill reactivation is worth more than the stock 7 days — the member
// already churned once, and the usual reason is "I never got to use it".
const DEFAULT_TRIAL_DAYS = 21;
// Stripe rejects a trial_end less than ~48h out; match the live checkout
// route's MIN_TRIAL_END_BUFFER_MS guard rather than discovering it in the API.
const MIN_TRIAL_END_BUFFER_MS = 48 * 60 * 60 * 1000;
// Pure typo guard (--days 210 instead of 21). Nothing about Stripe forbids it.
const MAX_TRIAL_DAYS = 365;

// A subscription in any of these states means the member is NOT churned, so
// there is nothing to reactivate — and creating a second sub would double-bill.
const LIVE_STATUSES = new Set<Stripe.Subscription.Status>([
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'incomplete',
  'paused',
]);

// Mirrors send-trial-value-nudge.mts (120h before trial end) and
// send-trial-reminders.mts (~48h before), so the operator can see both dates up
// front instead of discovering them when the member forwards the email.
const VALUE_NUDGE_LEAD_MS = 120 * 60 * 60 * 1000;
const REMINDER_LEAD_MS = 48 * 60 * 60 * 1000;

const POLL_INTERVAL_MS = 3000;
const DEFAULT_WAIT_SECONDS = 90;

type Tier = 'basic' | 'pro';
type Cadence = 'monthly' | 'annual';

type Args = {
  email: string | null;
  days: number | null;
  trialEndIso: string | null;
  tier: Tier | null;
  cadence: Cadence | null;
  priceId: string | null;
  paymentMethodId: string | null;
  waitSeconds: number;
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
    days: null,
    trialEndIso: null,
    tier: null,
    cadence: null,
    priceId: null,
    paymentMethodId: null,
    waitSeconds: DEFAULT_WAIT_SECONDS,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--days') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 2) {
        console.error('Error: --days must be an integer >= 2 (Stripe needs a ~48h cushion).');
        process.exit(1);
      }
      if (value > MAX_TRIAL_DAYS) {
        console.error(`Error: --days ${value} looks like a typo (max ${MAX_TRIAL_DAYS}).`);
        process.exit(1);
      }
      args.days = value;
    } else if (arg === '--trial-end') args.trialEndIso = (argv[++i] ?? '').trim() || null;
    else if (arg === '--tier') {
      const value = (argv[++i] ?? '').trim().toLowerCase();
      if (value !== 'basic' && value !== 'pro') {
        console.error(`Error: --tier must be basic|pro (got ${value || '<none>'}).`);
        process.exit(1);
      }
      args.tier = value;
    } else if (arg === '--cadence') {
      const value = (argv[++i] ?? '').trim().toLowerCase();
      if (value !== 'monthly' && value !== 'annual') {
        console.error(`Error: --cadence must be monthly|annual (got ${value || '<none>'}).`);
        process.exit(1);
      }
      args.cadence = value;
    } else if (arg === '--price') args.priceId = (argv[++i] ?? '').trim() || null;
    else if (arg === '--payment-method') args.paymentMethodId = (argv[++i] ?? '').trim() || null;
    else if (arg === '--wait-seconds') args.waitSeconds = Number(argv[++i]);
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
  node --experimental-strip-types --no-warnings scripts/reactivate-member.mts \\
    --email <addr> [--days N | --trial-end <iso>] [--tier basic|pro] \\
    [--cadence monthly|annual] [--price price_...] [--payment-method pm_...] \\
    [--wait-seconds N] [--dry-run | --yes]

Reactivates a CHURNED member with a goodwill free trial, with nothing for them
to do: re-creates their subscription in Stripe on the card already on file, with
an absolute trial_end. The webhook grants the tier, mirrors the row, and sends
the welcome-back email. Use extend-trial instead when the member still HAS a
trialing subscription.

Options:
      --days N            Trial length in days (default ${DEFAULT_TRIAL_DAYS}, min 2, max ${MAX_TRIAL_DAYS}).
      --trial-end <iso>   Absolute trial end instead of a day count (>= 48h out).
      --tier basic|pro    Plan tier. Default: whatever they were last on.
      --cadence m|a       monthly|annual. Default: whatever they were last on.
      --price price_...   Pin an exact Stripe price, bypassing tier/cadence.
      --payment-method pm_...  Card to bill at trial end. Default: the
                          customer's default, else their last subscription's,
                          else the only one attached.
      --wait-seconds N    How long to wait for the webhook (default ${DEFAULT_WAIT_SECONDS}).
      --dry-run           Print the plan; no Stripe or DB writes.
  -y, --yes               Apply: create the subscription, write an audit row.
  -h, --help              Show this help.

Refuses a member who already has a live or pending subscription, one with no
Stripe customer, and one with no usable payment method. Writes nothing to the
users row (the webhook owns it) beyond an audit_events row. Sends no email of
its own; the webhook's welcome-back email does go out. Reads STRIPE_SECRET_KEY
from env or .env.local; set AUTH_DB_PATH to override the DB path.`);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
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

function describePrice(price: Stripe.Price): string {
  const interval = price.recurring
    ? `/ ${price.recurring.interval_count > 1 ? `${price.recurring.interval_count} ` : ''}${price.recurring.interval}`
    : '(one-off)';
  return `${formatAmount(price.unit_amount, price.currency)} ${interval}${price.nickname ? ` — ${price.nickname}` : ''}`;
}

// Stripe hands back id-or-object on every expandable field; we only ever want
// the id, and a missing/deleted one must read as "none" rather than "[object]".
function expandedId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

function describeCard(pm: Stripe.PaymentMethod): string {
  if (pm.card) {
    const brand = pm.card.brand ? pm.card.brand.replace(/^./, (c) => c.toUpperCase()) : 'Card';
    return `${brand} ····${pm.card.last4} exp ${pm.card.exp_month}/${pm.card.exp_year}`;
  }
  return pm.type;
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

if (cliArgs.days != null && cliArgs.trialEndIso != null) {
  console.error('Error: --days and --trial-end are mutually exclusive.');
  process.exit(1);
}

if (!Number.isFinite(cliArgs.waitSeconds) || cliArgs.waitSeconds < 0) {
  console.error('Error: --wait-seconds must be a non-negative number.');
  process.exit(1);
}

// Resolve the trial end once, so the plan we print is the plan we send.
let trialEndMs: number;
if (cliArgs.trialEndIso) {
  const parsed = Date.parse(cliArgs.trialEndIso);
  if (!Number.isFinite(parsed)) {
    console.error(`Error: --trial-end is not a valid date: ${cliArgs.trialEndIso}`);
    process.exit(1);
  }
  trialEndMs = parsed;
} else {
  trialEndMs = Date.now() + (cliArgs.days ?? DEFAULT_TRIAL_DAYS) * 24 * 60 * 60 * 1000;
}
if (trialEndMs - Date.now() < MIN_TRIAL_END_BUFFER_MS) {
  console.error('Error: the trial must end at least 48h from now (Stripe rejects anything nearer).');
  process.exit(1);
}
if (trialEndMs - Date.now() > MAX_TRIAL_DAYS * 24 * 60 * 60 * 1000) {
  console.error(`Error: that trial is longer than ${MAX_TRIAL_DAYS} days — looks like a typo.`);
  process.exit(1);
}
const trialEndUnix = Math.floor(trialEndMs / 1000);
const trialEndIso = new Date(trialEndMs).toISOString();
const trialDaysActual = Math.round((trialEndMs - Date.now()) / (24 * 60 * 60 * 1000));

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
  subscription_lapsed: number | null;
  paid_welcome_email_sent_at: string | null;
  deleted_at: string | null;
};

const rows = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, tier, subscription_status, stripe_customer_id, stripe_subscription_id,
          subscription_lapsed, paid_welcome_email_sent_at, deleted_at
   FROM users WHERE lower(email) = '${escapeSqlLiteral(cliArgs.email)}' LIMIT 1;`,
);
const user = rows[0];
if (!user) {
  console.error(`Error: no user found with email ${cliArgs.email}.`);
  process.exit(1);
}
if (user.deleted_at) {
  console.error(`Error: ${user.email} is deleted (${user.deleted_at}). Nothing to reactivate.`);
  process.exit(1);
}
if (user.stripe_subscription_id) {
  console.error(
    `Error: ${user.email} still has a subscription on file (${user.stripe_subscription_id}, status=${user.subscription_status ?? 'unknown'}).`,
  );
  console.error('This target is for members whose subscription has ENDED. For a live one:');
  console.error(`  make extend-trial EMAIL=${user.email} EXTEND_DAYS=14 YES=1      (lengthen a trial)`);
  console.error(`  make set-cancellation EMAIL=${user.email} OFF=1 YES=1           (stop a scheduled cancel)`);
  process.exit(1);
}
if (!user.stripe_customer_id) {
  console.error(`Error: ${user.email} has no Stripe customer, so there is no card to bill.`);
  console.error('They have to enter one at checkout. To make sure they get a trial when they do:');
  console.error(`  make reset-user-for-testing EMAIL=${user.email} KEEP_CUSTOMER=1 APPLY=1`);
  process.exit(1);
}

// Pinned to the SAME API version the app itself runs on (core/stripe.ts), which
// matters here in a way it does not for a read-only script: the account's default
// version is newer, and a subscription created on it comes out with
// billing_mode=flexible, while every subscription Checkout creates is classic.
// Reactivating someone has to produce the same subscription they would have got
// by checking out themselves — a member's billing shape should not depend on
// which door they came back through. (The invoice-preview reads that a flexible
// sub used to break are handled either way now: core/stripeInvoicePreview.ts.)
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
const customerId = user.stripe_customer_id;

let customer: Stripe.Customer | Stripe.DeletedCustomer;
try {
  customer = await stripe.customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method'],
  });
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Error: could not retrieve Stripe customer ${customerId}: ${message}`);
  process.exit(1);
}
if (customer.deleted) {
  console.error(`Error: Stripe customer ${customerId} is deleted. Clear it and have them check out:`);
  console.error(`  make clear-zombie-customers APPLY=1`);
  process.exit(1);
}

// Live Stripe is the source of truth for "are they really churned" — the DB
// mirror can lag a webhook, and a second sub on a live customer double-bills.
let allSubs: Stripe.Subscription[] = [];
try {
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
    expand: ['data.items.data.price'],
  });
  allSubs = [...list.data].sort((a, b) => b.created - a.created);
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Error: could not list subscriptions for ${customerId}: ${message}`);
  process.exit(1);
}

const liveSub = allSubs.find((sub) => LIVE_STATUSES.has(sub.status));
if (liveSub) {
  console.error(
    `Error: ${user.email} already has a '${liveSub.status}' subscription in Stripe (${liveSub.id}).`,
  );
  console.error('Creating a second one would bill them twice. Run `make diagnose-user EMAIL=' + user.email + '` first.');
  process.exit(1);
}

const previousSub = allSubs[0] ?? null;
const previousPriceId = previousSub ? expandedId(previousSub.items?.data?.[0]?.price) : null;

// Plan resolution: an explicit price wins, then tier/cadence off the configured
// env, then whatever they were last paying for. Anything else is a guess, and a
// guess here charges the wrong amount.
let priceId: string | null = cliArgs.priceId;
let priceSource = 'the --price you passed';
if (!priceId && (cliArgs.tier || cliArgs.cadence)) {
  const tier = cliArgs.tier ?? 'pro';
  const cadence = cliArgs.cadence ?? 'monthly';
  const envKey = `STRIPE_PRICE_${tier.toUpperCase()}_${cadence.toUpperCase()}`;
  priceId = envOrLocal(envKey) ?? null;
  priceSource = `${envKey} (${tier}/${cadence})`;
  if (!priceId) {
    console.error(`Error: ${envKey} is not set in env or .env.local.`);
    process.exit(1);
  }
}
if (!priceId && previousPriceId) {
  priceId = previousPriceId;
  priceSource = `their previous subscription (${previousSub?.id})`;
}
if (!priceId) {
  console.error(`Error: cannot tell which plan to put ${user.email} on — they have no prior`);
  console.error('subscription to copy. Pass --tier/--cadence (Makefile: TIER=/CADENCE=) or --price.');
  process.exit(1);
}

let price: Stripe.Price;
try {
  price = await stripe.prices.retrieve(priceId);
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Error: could not retrieve price ${priceId}: ${message}`);
  process.exit(1);
}
if (!price.active) {
  console.error(`Error: price ${priceId} is archived in Stripe. Pass a current one with --price,`);
  console.error('or TIER=/CADENCE= to use the configured plan.');
  process.exit(1);
}
if (!price.recurring) {
  console.error(`Error: price ${priceId} is not a recurring price.`);
  process.exit(1);
}

// Payment method: without one the trial cannot convert — trial_settings below
// would just cancel the sub at trial end, i.e. a silent non-reactivation.
let attachedPms: Stripe.PaymentMethod[] = [];
try {
  const list = await stripe.customers.listPaymentMethods(customerId, { limit: 100 });
  attachedPms = list.data;
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Error: could not list payment methods for ${customerId}: ${message}`);
  process.exit(1);
}

const customerDefaultPm = expandedId(customer.invoice_settings?.default_payment_method);
const previousSubPm = previousSub ? expandedId(previousSub.default_payment_method) : null;

let paymentMethodId: string | null = null;
let pmSource = '';
if (cliArgs.paymentMethodId) {
  paymentMethodId = cliArgs.paymentMethodId;
  pmSource = 'the --payment-method you passed';
} else if (customerDefaultPm) {
  paymentMethodId = customerDefaultPm;
  pmSource = "the customer's default";
} else if (previousSubPm && attachedPms.some((pm) => pm.id === previousSubPm)) {
  paymentMethodId = previousSubPm;
  pmSource = `their previous subscription's default`;
} else if (attachedPms.length === 1) {
  paymentMethodId = attachedPms[0].id;
  pmSource = 'the only card attached';
}

if (!paymentMethodId) {
  if (attachedPms.length === 0) {
    console.error(`Error: ${user.email} has no payment method on file, so a trial could never`);
    console.error('convert. They have to enter a card at checkout — to make sure they get a trial:');
    console.error(`  make reset-user-for-testing EMAIL=${user.email} KEEP_CUSTOMER=1 APPLY=1`);
  } else {
    console.error(`Error: ${user.email} has ${attachedPms.length} payment methods and no default.`);
    console.error('Pick one with PAYMENT_METHOD=pm_...:');
    for (const pm of attachedPms) console.error(`  ${pm.id}  ${describeCard(pm)}`);
  }
  process.exit(1);
}

// An id we were handed (or that a stale customer default points at) may not
// actually be attached to this customer; Stripe would reject the create, but
// only after we had printed a confident plan.
let paymentMethod: Stripe.PaymentMethod;
try {
  paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Error: could not retrieve payment method ${paymentMethodId}: ${message}`);
  process.exit(1);
}
if (expandedId(paymentMethod.customer) !== customerId) {
  console.error(`Error: payment method ${paymentMethodId} is not attached to ${customerId}.`);
  process.exit(1);
}

const welcomeVariant =
  user.paid_welcome_email_sent_at == null
    ? 'first-time paid welcome (API-key onboarding)'
    : 'welcome-back';

console.log(`Auth DB:            ${dbPath}`);
console.log(`Member:             ${user.email} (id=${user.id})`);
console.log(`Tier (DB):          ${user.tier ?? '—'}  →  ${price.metadata?.tier ?? 'granted by the webhook from the price'}`);
console.log(`Stripe customer:    ${customerId}`);
console.log(`Last subscription:  ${previousSub ? `${previousSub.id} (${previousSub.status})` : '— none on record'}`);
console.log('');
console.log(`Plan:               ${priceId}`);
console.log(`                    ${describePrice(price)}`);
console.log(`                    from ${priceSource}`);
console.log(`Card:               ${describeCard(paymentMethod)} (${paymentMethodId})`);
console.log(`                    from ${pmSource}`);
console.log(`Trial:              ${trialDaysActual} days, ending ${trialEndIso}`);
console.log(`First charge:       ${formatAmount(price.unit_amount, price.currency)} on ${trialEndIso}`);
console.log('');
console.log('Automatic follow-ups (no action needed):');
console.log(`  welcome email     now — ${welcomeVariant}`);
console.log(
  `  value nudge       ${new Date(trialEndMs - VALUE_NUDGE_LEAD_MS).toISOString()} (120h before trial end)`,
);
console.log(
  `  trial reminder    ${new Date(trialEndMs - REMINDER_LEAD_MS).toISOString()} (~48h before, quotes the charge + card)`,
);
console.log('');
console.log(
  'The mid-trial value nudge is anchored to trial END, not start, so on a long trial it lands',
);
console.log('late rather than on day 2. Suppress it with a stamp if you would rather write your own:');
console.log(
  `  sqlite3 ${dbPath} "UPDATE users SET trial_midpoint_email_sent_at = datetime('now') WHERE id = '${user.id}';"`,
);

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No Stripe or DB writes.');
  process.exit(0);
}

if (!cliArgs.yes) {
  console.log('\nRefusing to write without --yes. Re-run with --yes to apply, or --dry-run to preview.');
  process.exit(1);
}

// --- Apply -----------------------------------------------------------------

// One Stripe call does the whole reactivation. metadata.manual_reactivation is
// inert to the webhook (only metadata.founding is special-cased) and is there so
// the sub is identifiable later as a comp'd return rather than a self-serve one.
let subscription: Stripe.Subscription;
try {
  subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_end: trialEndUnix,
    default_payment_method: paymentMethodId,
    trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
    metadata: {
      manual_reactivation: '1',
      reactivation_trial_days: String(trialDaysActual),
    },
    expand: ['pending_setup_intent'],
  });
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: Stripe subscription create failed: ${message}`);
  console.error('Nothing was written. The member is unchanged.');
  process.exit(1);
}

const stamp = nowIso();
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
     '${escapeSqlLiteral(
       `Reactivated on ${priceId} (${formatAmount(price.unit_amount, price.currency)}) with a ${trialDaysActual}-day trial; sub ${subscription.id} trial_end=${trialEndIso}, card ${paymentMethodId}`,
     )}',
     '${escapeSqlLiteral(stamp)}'
   );`,
);

console.log(`\nCreated ${subscription.id} — status '${subscription.status}', trial ends ${trialEndIso}.`);

// A trialing sub with an unresolved SetupIntent is deliberately NOT granted the
// tier by the webhook (the trial-access correctness gate). Passing an attached,
// already-validated card normally means there is no SetupIntent at all — but say
// so plainly when there is, because access will be withheld until it succeeds.
const pendingSetupIntent = subscription.pending_setup_intent;
if (pendingSetupIntent) {
  const psiStatus =
    typeof pendingSetupIntent === 'string' ? 'unresolved' : pendingSetupIntent.status;
  console.log(
    `\nNOTE: the subscription carries a pending SetupIntent (${psiStatus}). The webhook withholds`,
  );
  console.log('the tier until that SetupIntent succeeds, so the member may not have access yet.');
}

// Wait for the webhook rather than writing the users row ourselves: the price ->
// tier mapping is recomputed on every sync, so a hand-written tier is the one
// thing guaranteed not to survive.
const deadline = Date.now() + cliArgs.waitSeconds * 1000;
let mirrored: UserRow | undefined;
process.stdout.write(`Waiting up to ${cliArgs.waitSeconds}s for the subscription webhook`);
while (Date.now() < deadline) {
  const after = querySqlite<UserRow>(
    dbPath,
    `SELECT id, email, tier, subscription_status, stripe_customer_id, stripe_subscription_id,
            subscription_lapsed, paid_welcome_email_sent_at, deleted_at
     FROM users WHERE id = '${escapeSqlLiteral(user.id)}' LIMIT 1;`,
  );
  if (after[0]?.stripe_subscription_id === subscription.id) {
    mirrored = after[0];
    break;
  }
  process.stdout.write('.');
  await sleep(POLL_INTERVAL_MS);
}
process.stdout.write('\n');

if (!mirrored) {
  console.error(`\nThe webhook has not mirrored ${subscription.id} onto the users row yet.`);
  console.error('The subscription IS live in Stripe — the member is on a trial and will not be');
  console.error('charged before it ends — but their tier has not been granted locally. Check:');
  console.error('  make webhook-health');
  console.error(`  make diagnose-user EMAIL=${user.email}`);
  process.exit(1);
}

console.log(
  `Webhook landed: tier=${mirrored.tier ?? '—'}, status=${mirrored.subscription_status ?? '—'}, lapsed=${mirrored.subscription_lapsed ? 'yes' : 'no'}.`,
);
console.log(`\nDone. ${user.email} is back on ${price.nickname ?? priceId} with ${trialDaysActual} days free.`);
console.log('They do not need to do anything — no checkout, no card re-entry.');
console.log(`Verify anytime with: make diagnose-user EMAIL=${user.email}`);
