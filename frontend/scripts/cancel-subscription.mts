#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/cancel-subscription.mts \
//     --email <addr> [--void-invoice] [--force] [--dry-run | --yes]
//
// IMMEDIATELY cancel ONE customer's Stripe subscription — the path
// set-cancellation.mts can't take. set-cancellation only flips
// cancel_at_period_end and only on a 'trialing'/'active' sub; it refuses a
// 'past_due' (or 'unpaid') sub outright. This script fills that gap: it ends the
// subscription NOW, which is what you want for a trial that failed to convert
// and is sitting in the payment-recovery grace / Stripe dunning cycle.
//
// What it does, in order:
//   1. (--void-invoice) Void every still-OPEN invoice on the subscription. This
//      is the step that actually STOPS Stripe's Smart-Retries — canceling a
//      subscription does not itself void an already-finalized open invoice, so a
//      declined renewal invoice can otherwise keep retrying. Voiding is final and
//      un-collectible by design; use it when you never intend to collect (a trial
//      that never converted). Omit the flag to leave invoices as-is.
//   2. Cancel the subscription immediately (stripe.subscriptions.cancel). This
//      takes it out of 'past_due' and ends billing. Stripe emits
//      customer.subscription.deleted.
//   3. Mirror the downgrade onto the users row for immediacy — tier='public',
//      subscription mirror + grace/recovery latches cleared, subscription_lapsed=1
//      — the SAME columns clearSubscriptionFromUser writes in the webhook
//      (app/api/webhooks/stripe/route.ts). The webhook reconciles to identical
//      values when the deleted event lands (idempotent), and it — not this script
//      — is what revokes any personal API keys on the pro->public drop.
//   4. Record an audit_events row (type billing_subscription_canceled).
//
// The account is KEPT (login, email, Stripe customer, history all survive). To
// remove the account entirely, cancel here first, then `make delete-user`.
//
// SAFETY: refuses to immediately cancel an 'active' or 'trialing' subscription
// without --force, because that ends paid access on the spot with no refund. For
// those, the kinder path is a graceful cancel at period end:
//   make set-cancellation EMAIL=<addr> ON=1 YES=1
// Pass --force (Makefile: FORCE=1) only when you truly mean "end access now".
//
// Sends NO email. Reads STRIPE_SECRET_KEY from env or .env.local. Set
// AUTH_DB_PATH to override the default DB path (data/auth.db).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

const AUDIT_TYPE = 'billing_subscription_canceled';

type Args = {
  email: string | null;
  voidInvoice: boolean;
  force: boolean;
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
    voidInvoice: false,
    force: false,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--void-invoice') args.voidInvoice = true;
    else if (arg === '--force') args.force = true;
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
  node --experimental-strip-types --no-warnings scripts/cancel-subscription.mts \\
    --email <addr> [--void-invoice] [--force] [--dry-run | --yes]

Immediately cancels one customer's Stripe subscription and downgrades them to
the public tier. Use for a past_due / unpaid sub (e.g. a trial that failed to
convert) — set-cancellation only handles trialing/active at period end.

Options:
      --void-invoice  Void every still-open invoice on the subscription first.
                      This is what actually stops Stripe's retry attempts on a
                      failed charge. Voiding is final (never collected).
      --force         Allow immediate cancel of an 'active'/'trialing' sub too.
                      Without it, those are refused (use set-cancellation for a
                      graceful at-period-end cancel that keeps access).
      --dry-run       Print the plan; no Stripe or DB writes.
  -y, --yes           Apply: cancel in Stripe, mirror the row, write an audit row.
  -h, --help          Show this help.

The account itself is kept. Sends NO email. Reads STRIPE_SECRET_KEY from env or
.env.local; set AUTH_DB_PATH to override the default DB path (data/auth.db).`);
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
if (!user.stripe_subscription_id) {
  console.error(
    `Error: ${user.email} has no Stripe subscription (status=${user.subscription_status ?? 'none'}). Nothing to cancel.`,
  );
  console.error('If you want to remove the account itself, use: make delete-user EMAIL=' + user.email);
  process.exit(1);
}

// Live Stripe read is the source of truth for the current status; the DB mirror
// can lag a webhook.
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

const status = subscription.status;
// Nothing left to cancel on these — but we may still void a stray open invoice
// and reconcile the DB mirror to public.
const alreadyTerminal = status === 'canceled' || status === 'incomplete_expired';

// Guard: immediate cancel of a live paid/trial sub ends access with no refund.
if (!alreadyTerminal && (status === 'active' || status === 'trialing') && !cliArgs.force) {
  console.error(
    `Refusing to immediately cancel ${user.email}'s '${status}' subscription without --force.`,
  );
  console.error('For a graceful cancel at period end (keeps access; no charge on a trial), use:');
  console.error(`  make set-cancellation EMAIL=${user.email} ON=1 YES=1`);
  console.error('Or re-run with FORCE=1 to cancel immediately and end access now.');
  process.exit(1);
}

// Open invoices on this subscription (the ones still capable of a charge attempt).
let openInvoices: Stripe.Invoice[] = [];
try {
  const list = await stripe.invoices.list({
    subscription: subscription.id,
    status: 'open',
    limit: 100,
  });
  openInvoices = list.data;
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Warning: could not list open invoices: ${message}`);
}

const periodEndUnix = currentPeriodEndUnix(subscription);
const periodEndIso = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;

console.log(`Auth DB:            ${dbPath}`);
console.log(`Customer:           ${user.email} (id=${user.id})`);
console.log(`Tier (DB):          ${user.tier ?? '—'}  →  public`);
console.log(`Subscription:       ${subscription.id}`);
console.log(`Status:             ${status}${periodEndIso ? ` (current period end ${periodEndIso})` : ''}`);
console.log(`Open invoices:      ${openInvoices.length}`);
for (const inv of openInvoices) {
  console.log(
    `  ${inv.id}  ${formatAmount(inv.amount_due, inv.currency)}  attempt=${inv.attempt_count ?? 0}` +
      `${cliArgs.voidInvoice ? '  → VOID' : '  (left as-is; pass --void-invoice to stop retries)'}`,
  );
}

console.log('');
if (alreadyTerminal) {
  console.log(`Effect: subscription is already '${status}'. Will ${cliArgs.voidInvoice ? 'void any open invoices and ' : ''}reconcile the account to public.`);
} else {
  console.log(
    `Effect: the subscription will be CANCELED immediately (was '${status}') and the account dropped to 'public'.` +
      (cliArgs.voidInvoice
        ? ' Open invoices above will be VOIDED, so Stripe makes no further charge attempts.'
        : ' NOTE: open invoices are left as-is — pass --void-invoice to guarantee no further retry attempts.'),
  );
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

// --- Apply -----------------------------------------------------------------

// 1. Void open invoices first (while everything is intact). A void failure does
//    not block the cancel below, but we surface it loudly and exit non-zero so
//    the operator knows a charge attempt may still be live.
const voided: string[] = [];
const voidFailures: string[] = [];
if (cliArgs.voidInvoice) {
  for (const inv of openInvoices) {
    if (!inv.id) continue;
    try {
      await stripe.invoices.voidInvoice(inv.id);
      voided.push(inv.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      console.error(`Warning: failed to void invoice ${inv.id}: ${message}`);
      voidFailures.push(inv.id);
    }
  }
}

// 2. Cancel the subscription immediately (unless it is already terminal).
let finalStatus = status;
if (!alreadyTerminal) {
  try {
    const canceled = await stripe.subscriptions.cancel(subscription.id);
    finalStatus = canceled.status;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`\nError: Stripe subscription cancel failed: ${message}`);
    console.error(
      voided.length
        ? `Voided invoices: ${voided.join(', ')}. No DB changes were made.`
        : 'No DB changes were made.',
    );
    process.exit(1);
  }
}

// 3. Mirror the downgrade onto the row — the same columns clearSubscriptionFromUser
//    writes on customer.subscription.deleted. The webhook reconciles to identical
//    values (idempotent) and revokes any API keys on the pro->public drop.
const stamp = nowIso();
execSqlite(
  dbPath,
  `UPDATE users SET
     tier = 'public',
     stripe_subscription_id = NULL,
     stripe_price_id = NULL,
     subscription_status = '${escapeSqlLiteral(finalStatus)}',
     current_period_end = NULL,
     cancel_at_period_end = 0,
     subscription_lapsed = 1,
     payment_recovery_pending = 0,
     payment_grace_started_at = NULL,
     updated_at = '${escapeSqlLiteral(stamp)}'
   WHERE id = '${escapeSqlLiteral(user.id)}';`,
);

// 4. Audit row.
const voidedSuffix = voided.length ? `; voided invoices ${voided.join(', ')}` : '';
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
     '${escapeSqlLiteral(`Canceled sub ${subscription.id} (was ${status}) immediately; tier reset to public${voidedSuffix}`)}',
     '${escapeSqlLiteral(stamp)}'
   );`,
);

console.log(
  `\nDone. ${user.email}: subscription ${finalStatus === status ? `is '${finalStatus}'` : `canceled (now '${finalStatus}')`}, tier reset to public.`,
);
if (cliArgs.voidInvoice) {
  console.log(
    voided.length ? `Voided invoice(s): ${voided.join(', ')} — no further charge attempts.` : 'No open invoices to void.',
  );
}
console.log('The Stripe webhook will reconcile the row and revoke any API keys on the pro→public drop.');

if (voidFailures.length) {
  console.error(`\nWARNING: these invoices could NOT be voided and may still retry: ${voidFailures.join(', ')}`);
  console.error('Void them by hand in the Stripe Dashboard to stop the attempts.');
  process.exit(1);
}
