#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/gift-month.mts \
//     --email <addr> [--months N] [--note <text>] [--dry-run | --yes]
//
// Give ONE paying member free months as goodwill, e.g. after a bad session.
//
// How it works (and why this is all it takes):
//   The gift is a CREDIT on the member's Stripe customer balance worth N months
//   of their own plan (core/giftMonth.ts). Stripe applies the balance to the
//   next invoice before charging the card: a $59 credit makes the next $59
//   renewal $0, and the card is charged again a month later. Status, plan and
//   billing date are untouched, so no other automation needs a nudge. It is
//   the mechanism the referral reward already uses, and the webhook already
//   treats a renewal settled at zero by credit as paid.
//
// Use extend-trial for someone still in their free trial; this is for members
// who already pay.
//
// One gift per member per New York calendar day: the balance transaction
// carries a tag in its metadata, and a second run the same day finds it on
// Stripe and stops, so a repeated --yes never credits twice.
//
// This does NOT email the member. Tell them yourself.
//
// Records an audit_events row (type billing_goodwill_credit) per gift.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

import {
  GIFT_REF_METADATA_KEY,
  MAX_GIFT_MONTHS,
  giftBalanceTransaction,
  giftRef,
  oneMonthOf,
} from '../core/giftMonth.ts';
import { previewNextInvoice } from '../core/stripeInvoicePreview.ts';

const AUDIT_TYPE = 'billing_goodwill_credit';

type Args = {
  email: string | null;
  months: number;
  note: string | null;
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
  const args: Args = { email: null, months: 1, note: null, dryRun: false, yes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--months') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1 || n > MAX_GIFT_MONTHS) {
        console.error(`Error: --months must be a whole number from 1 to ${MAX_GIFT_MONTHS}.`);
        process.exit(1);
      }
      args.months = n;
    } else if (arg === '--note') args.note = (argv[++i] ?? '').trim() || null;
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
  node --experimental-strip-types --no-warnings scripts/gift-month.mts \\
    --email <addr> [--months N] [--note <text>] [--dry-run | --yes]

Credits N months of the member's own plan to their Stripe balance. Stripe
applies it to their next invoice(s), so the next N renewals cost nothing and
billing resumes after. Status, plan and billing date are unchanged.

      --months N          Months to give, 1 to ${MAX_GIFT_MONTHS}. Default 1.
      --note <text>       Shown on the Stripe credit, e.g. "chart lag".
      --dry-run           Print the plan; no Stripe or DB writes.
  -y, --yes               Apply: post the credit and write an audit row.
  -h, --help              Show this help.

Only for a subscription Stripe reports as 'active' or 'trialing'. Refuses a
second gift to the same member on the same New York day. Sends no email.

Reads STRIPE_SECRET_KEY from env or .env.local. Set AUTH_DB_PATH to override
the default DB path (data/auth.db).`);
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

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
      amount / 100,
    );
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

// Mirror core/stripe.ts getCurrentPeriodEndUnix without importing it (the same
// '@/' alias reason as extend-trial.mts): item-level first, then the legacy
// sub-level field.
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

async function nextInvoiceDue(stripe: Stripe, customer: string, subscription: string): Promise<string> {
  try {
    const upcoming = await previewNextInvoice(stripe, { customer, subscription });
    return fmtMoney(upcoming.amount_due, upcoming.currency);
  } catch (err) {
    return `unavailable (${err instanceof Error ? err.message : 'unknown error'})`;
  }
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
if (!user.stripe_customer_id || !user.stripe_subscription_id) {
  console.error(
    `Error: ${user.email} has no Stripe subscription (status=${user.subscription_status ?? 'none'}). There is no invoice to credit.`,
  );
  process.exit(1);
}

// Live Stripe reads are the source of truth; the DB mirror can lag a webhook.
const stripe = new Stripe(STRIPE_SECRET_KEY);

let subscription: Stripe.Subscription;
try {
  subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id, {
    expand: ['items.data.price'],
  });
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Error: could not retrieve subscription ${user.stripe_subscription_id}: ${message}`);
  process.exit(1);
}

if (subscription.status !== 'active' && subscription.status !== 'trialing') {
  console.error(
    `Error: Stripe reports subscription ${subscription.id} as '${subscription.status}', not active or trialing.`,
  );
  console.error('       A credit only helps a subscription that will invoice again. Aborting.');
  process.exit(1);
}
if (subscription.cancel_at_period_end) {
  console.error(
    `Error: subscription ${subscription.id} is set to cancel at period end, so there is no next invoice for a credit to pay.`,
  );
  console.error('       Extend their access another way, or gift after they keep the subscription.');
  process.exit(1);
}
const subCustomer =
  typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
if (subCustomer !== user.stripe_customer_id) {
  console.error(
    `Error: subscription ${subscription.id} belongs to ${subCustomer ?? 'no customer'}, not ${user.stripe_customer_id}. Aborting.`,
  );
  process.exit(1);
}

const price = subscription.items?.data?.[0]?.price;
const month = oneMonthOf(price);
if (!month || month.amount <= 0) {
  console.error(`Error: could not read a positive plan price on ${subscription.id}. Aborting.`);
  process.exit(1);
}

const ref = giftRef(new Date());
const request = giftBalanceTransaction({
  months: cliArgs.months,
  monthAmount: month.amount,
  currency: month.currency,
  ref,
  userId: user.id,
  note: cliArgs.note,
});

// The guard against a double credit lives on Stripe, where the money is: an
// earlier gift today carries the same tag, however the audit write went.
const recent = await stripe.customers.listBalanceTransactions(user.stripe_customer_id, { limit: 100 });
const already = recent.data.find((t) => t.metadata?.[GIFT_REF_METADATA_KEY] === ref);

const customer = await stripe.customers.retrieve(user.stripe_customer_id);
const balance = !customer.deleted && typeof customer.balance === 'number' ? customer.balance : 0;
const periodEndUnix = currentPeriodEndUnix(subscription);
const nextChargeIso = periodEndUnix != null ? new Date(periodEndUnix * 1000).toISOString() : 'unknown';
const dueBefore = await nextInvoiceDue(stripe, user.stripe_customer_id, subscription.id);

console.log(`Auth DB:            ${dbPath}`);
console.log(`Member:             ${user.email} (id=${user.id}, tier=${user.tier ?? '—'})`);
console.log(`Subscription:       ${subscription.id} (${subscription.status})`);
console.log(
  `Plan:               ${fmtMoney(price?.unit_amount ?? 0, month.currency)} / ${price?.recurring?.interval ?? '?'}; one month = ${fmtMoney(month.amount, month.currency)}`,
);
console.log(`Next invoice:       ${nextChargeIso}, currently ${dueBefore} due`);
console.log(
  `Balance now:        ${fmtMoney(balance, month.currency)}${balance < 0 ? ' (a credit already)' : ''}`,
);
console.log(
  `Gift:               ${cliArgs.months} month${cliArgs.months === 1 ? '' : 's'} = ${fmtMoney(-request.amount, month.currency)} credit ("${request.description}", tag ${ref})`,
);

if (already) {
  console.log('');
  console.log(
    `Already given today: balance transaction ${already.id} (${fmtMoney(-already.amount, already.currency)}) carries tag ${ref}.`,
  );
  console.log('Nothing to do. Check it with `make diagnose-user EMAIL=...`.');
  process.exit(0);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No Stripe or DB writes.');
  process.exit(0);
}
if (!cliArgs.yes) {
  console.log('\nRefusing to write without --yes. Re-run with --yes to apply, or --dry-run to preview.');
  process.exit(1);
}

// --- Apply -----------------------------------------------------------------

let transaction: Stripe.CustomerBalanceTransaction;
try {
  transaction = await stripe.customers.createBalanceTransaction(user.stripe_customer_id, request);
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: Stripe balance credit failed: ${message}`);
  console.error('Nothing was credited and no DB changes were made.');
  process.exit(1);
}

const stamp = new Date().toISOString();
const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
try {
  runSqlite(
    dbPath,
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (
       '${escapeSqlLiteral(auditId)}',
       '${escapeSqlLiteral(AUDIT_TYPE)}',
       '${escapeSqlLiteral(user.id)}',
       NULL,
       '${escapeSqlLiteral(user.email)}',
       'manual-script',
       '${escapeSqlLiteral(`${request.description}: credited ${fmtMoney(-request.amount, month.currency)} to ${user.stripe_customer_id} (balance transaction ${transaction.id}, tag ${ref}) for sub ${subscription.id}`)}',
       '${escapeSqlLiteral(stamp)}'
     );`,
  );
} catch (err) {
  // The credit is on Stripe either way; the tag still stops a second one today.
  console.error(`Warning: credit posted but the audit row failed: ${(err as Error).message}`);
}

const dueAfter = await nextInvoiceDue(stripe, user.stripe_customer_id, subscription.id);
console.log(`\nDone. Credited ${fmtMoney(-transaction.amount, transaction.currency)} (balance transaction ${transaction.id}).`);
console.log(`Balance now ${fmtMoney(transaction.ending_balance, transaction.currency)}; next invoice ${nextChargeIso}: ${dueAfter} due.`);
console.log('No email was sent. Tell the member yourself.');
