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
//   1. Cancel the subscription immediately (stripe.subscriptions.cancel). This
//      takes it out of 'past_due' and ends billing; Stripe emits
//      customer.subscription.deleted. Done FIRST on purpose: canceling a
//      past_due sub transitions it straight to 'canceled', whereas voiding its
//      open invoice first would remove the only unpaid invoice and flip the sub
//      back to 'active' — tripping the webhook's "payment recovered" email
//      (maybeHandlePaymentRecovery fires on past_due -> active) to a customer we
//      are about to downgrade. The deleted path disarms that latch silently.
//   2. (--void-invoice) Void every still-OPEN invoice on the subscription. This
//      stops any lingering collection on the failed charge (canceling does not
//      itself void an already-finalized open invoice). Safe after the cancel: a
//      void on a canceled sub can no longer reactivate it. Voiding is final and
//      un-collectible by design; use it when you never intend to collect (a trial
//      that never converted). Omit the flag to leave invoices as-is.
//   3. Mirror the downgrade onto the users row for immediacy — tier='public',
//      subscription mirror + grace/recovery latches cleared, subscription_lapsed=1
//      — the SAME columns clearSubscriptionFromUser writes in the webhook
//      (app/api/webhooks/stripe/route.ts). The webhook reconciles to identical
//      values when the deleted event lands (idempotent).
//   4. Record an audit_events row (type billing_subscription_canceled).
//   5. Revoke the member's personal API keys. The webhook cannot be relied on for
//      this: it revokes only on a drop OUT of an API tier, judged against the
//      row as it finds it, and step 3 often lands before
//      customer.subscription.deleted does. It then sees public -> public and
//      leaves the key live. Revoking here closes that race; the webhook's later
//      check is a harmless no-op. Same audit types as the webhook
//      (api_key_auto_revoked / api_key_auto_revoke_error /
//      api_key_revoke_skipped_unconfigured), so diagnose-user reads alike.
//
// With the subscription already gone (no id on file), a --yes run still revokes
// any key left on an account whose tier has no API access, so re-running this
// finishes a cancel whose keys survived. An account whose tier still includes the
// API (a partner or founding grant) is never touched.
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

import { decideStaleInvoice } from '../core/staleInvoice.ts';
import { readInvoicePeriodEndUnix } from '../core/stripeInvoice.ts';

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
  -y, --yes           Apply: cancel in Stripe, mirror the row, write an audit row,
                      and revoke the member's API keys.
  -h, --help          Show this help.

The account itself is kept. Sends NO email. Reads STRIPE_SECRET_KEY and the key
service credentials (ZEROGEX_API_TOKEN, ZEROGEX_ADMIN_TOKEN) from env or
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

function insertAudit(dbPath: string, row: { type: string; userId: string; email: string; message: string }) {
  execSqlite(
    dbPath,
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (
       '${escapeSqlLiteral(`audit_${crypto.randomBytes(12).toString('hex')}`)}',
       '${escapeSqlLiteral(row.type)}',
       '${escapeSqlLiteral(row.userId)}',
       NULL,
       '${escapeSqlLiteral(row.email)}',
       'manual-script',
       '${escapeSqlLiteral(row.message)}',
       '${escapeSqlLiteral(nowIso())}'
     );`,
  );
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

// core/apiKeyAdmin.ts reads its credentials from process.env only, and this
// script keeps .env.local in its own map. Seed the keys it needs BEFORE the
// dynamic import: the module captures ZEROGEX_API_BASE_URL at load time.
// (Same approach as scripts/expire-partner-grants.mjs.)
for (const key of ['ZEROGEX_API_BASE_URL', 'ZEROGEX_API_TOKEN', 'ZEROGEX_API_KEY', 'ZEROGEX_ADMIN_TOKEN']) {
  if (!process.env[key] && envLocal[key]) process.env[key] = envLocal[key];
}
const { isApiKeyAdminConfigured, revokeAllApiKeys } = await import('../core/apiKeyAdmin.ts');
const { isApiKeyEligibleTier, normalizeTier } = await import('../core/auth.ts');

type KeyRevocation =
  | { status: 'revoked'; revoked: number }
  | { status: 'unconfigured' }
  | { status: 'failed'; error: string };

// Never throws: by the time this runs the cancel is done, and a key-service
// failure must not hide that. reportKeyRevocation says what happened.
async function revokeKeys(email: string): Promise<KeyRevocation> {
  if (!isApiKeyAdminConfigured()) return { status: 'unconfigured' };
  try {
    return { status: 'revoked', revoked: await revokeAllApiKeys(email) };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}

// Prints the outcome and records it under the webhook's own audit types.
// Returns false when a key may still be live, so the run can exit non-zero.
function reportKeyRevocation(
  target: { id: string; email: string },
  context: string,
  result: KeyRevocation,
): boolean {
  if (result.status === 'revoked') {
    if (result.revoked === 0) {
      console.log('API keys:           none were active');
      return true;
    }
    console.log(`API keys:           revoked ${result.revoked}`);
    insertAudit(dbPath, {
      type: 'api_key_auto_revoked',
      userId: target.id,
      email: target.email,
      message: `Revoked ${result.revoked} API key(s): ${context}`,
    });
    return true;
  }
  const why =
    result.status === 'unconfigured'
      ? 'key administration is not configured (ZEROGEX_API_TOKEN / ZEROGEX_ADMIN_TOKEN)'
      : result.error;
  console.error(`\nWARNING: API keys NOT revoked: ${why}.`);
  console.error('Any key this member holds still works. Fix that, then re-run the same command with YES=1.');
  insertAudit(dbPath, {
    type: result.status === 'unconfigured' ? 'api_key_revoke_skipped_unconfigured' : 'api_key_auto_revoke_error',
    userId: target.id,
    email: target.email,
    message: `API keys NOT revoked (${context}): ${why}`,
  });
  return false;
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
// Live Stripe read is the source of truth for the current status; the DB mirror
// can lag a webhook.
const stripe = new Stripe(STRIPE_SECRET_KEY);

// --- The mirror is already cleared -------------------------------------------
// clearSubscriptionFromUser NULLs stripe_subscription_id the moment Stripe kills
// a subscription for nonpayment, so by the time anyone reaches for this script
// the id is gone. That made the `alreadyTerminal` branch below — "nothing left
// to cancel, but we may still void a stray open invoice" — unreachable in the
// exact situation it was written for: a dunning-cancelled member with a $29
// invoice still open and still payable, which is the whole reason --void-invoice
// exists.
//
// So handle that case here, off the subscription entirely, and leave the cancel
// machinery below untouched. Invoices are found by CUSTOMER, because there is no
// local subscription id left to find them by.
if (!user.stripe_subscription_id) {
  if (!user.stripe_customer_id) {
    console.error(
      `Error: ${user.email} has no Stripe subscription (status=${user.subscription_status ?? 'none'}) and no Stripe customer. Nothing to do.`,
    );
    console.error('If you want to remove the account itself, use: make delete-user EMAIL=' + user.email);
    process.exit(1);
  }

  let strays: Stripe.Invoice[] = [];
  try {
    const list = await stripe.invoices.list({
      customer: user.stripe_customer_id,
      status: 'open',
      limit: 100,
    });
    strays = list.data;
  } catch (err) {
    console.error(`Error: could not list open invoices: ${(err as Error).message}`);
    process.exit(1);
  }

  // A tier without API access should hold no key, and one can survive an earlier
  // cancel whose webhook saw no tier drop (step 5 in the header). A tier that
  // includes the API (a partner or founding grant) is left alone.
  const tierNow = normalizeTier(user.tier);
  const revokeHere = !isApiKeyEligibleTier(tierNow);

  console.log(`Auth DB:            ${dbPath}`);
  console.log(`User:               ${user.email} (${user.id})`);
  console.log(`Subscription:       none on file (status=${user.subscription_status ?? 'none'})`);
  console.log(`Stripe customer:    ${user.stripe_customer_id}`);
  console.log(`Open invoices:      ${strays.length}`);

  // Keys first when applying: they don't depend on the invoices, and a void that
  // fails below must not leave a live key behind.
  let keysOk = true;
  if (!revokeHere) {
    console.log(`API keys:           left alone (tier ${tierNow} includes API access)`);
  } else if (cliArgs.yes) {
    keysOk = reportKeyRevocation(
      user,
      `cancel-subscription found them on ${tierNow}, which has no API access`,
      await revokeKeys(user.email),
    );
  } else {
    console.log(`API keys:           any still active are revoked with YES=1 (tier ${tierNow} has no API access)`);
  }

  if (strays.length === 0) {
    console.log('\nNothing to cancel and no open invoice to void.');
    if (revokeHere && !cliArgs.yes) {
      console.log('Re-run with YES=1 to revoke any API key still active on this account.');
    }
    console.log('If you want to remove the account itself, use: make delete-user EMAIL=' + user.email);
    process.exit(keysOk ? 0 : 1);
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  for (const inv of strays) {
    const periodEndUnix = readInvoicePeriodEndUnix(inv);
    const decision = decideStaleInvoice({
      invoiceStatus: inv.status ?? null,
      amountDue: inv.amount_due ?? 0,
      periodEndUnix,
      subscriptionStatus: null,
      cancellationReason: 'payment_failed',
      nowUnix,
    });
    const buys =
      decision.kind === 'keep' && decision.reason === 'still_buys_access'
        ? `STILL BUYS ACCESS until ${new Date((periodEndUnix ?? 0) * 1000).toISOString()}`
        : 'can no longer buy access';
    console.log(
      `  ${inv.id}  ${formatAmount(inv.amount_due, inv.currency)}  ${buys}` +
        `${cliArgs.voidInvoice ? '  → VOID' : '  (left as-is; pass --void-invoice)'}`,
    );
  }

  if (!cliArgs.voidInvoice) {
    console.log('\nNothing to cancel — the subscription is already gone.');
    console.log('To retire the open invoice(s) above so nobody can pay for nothing:');
    console.log(`  make cancel-subscription EMAIL=${user.email} VOID_INVOICE=1 YES=1`);
    process.exit(keysOk ? 0 : 1);
  }

  if (!cliArgs.yes) {
    console.log(
      `\nDRY RUN — nothing was changed. Re-run with YES=1 to void${revokeHere ? ' and revoke any API key' : ''}. Voiding is final.`,
    );
    process.exit(0);
  }

  const strayVoided: string[] = [];
  const strayFailed: string[] = [];
  for (const inv of strays) {
    if (!inv.id) continue;
    try {
      await stripe.invoices.voidInvoice(inv.id);
      strayVoided.push(inv.id);
      console.log(`  VOIDED ${inv.id}`);
    } catch (err) {
      strayFailed.push(inv.id);
      console.error(`  FAILED ${inv.id}: ${(err as Error).message}`);
    }
  }

  if (strayVoided.length > 0) {
    const strayAuditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    execSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(strayAuditId)}',
         '${escapeSqlLiteral('billing_stale_invoice_voided')}',
         '${escapeSqlLiteral(user.id)}',
         NULL,
         '${escapeSqlLiteral(user.email)}',
         'manual-script',
         '${escapeSqlLiteral(`Voided stray open invoice(s) ${strayVoided.join(', ')} on customer ${user.stripe_customer_id}; no subscription on file`)}',
         '${escapeSqlLiteral(new Date().toISOString())}'
       );`,
    );
  }

  console.log(
    `\nDone. Voided ${strayVoided.length} invoice(s)${strayFailed.length ? `, ${strayFailed.length} failed` : ''}.`,
  );
  process.exit(strayFailed.length > 0 || !keysOk ? 1 : 0);
}

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
console.log('API keys:           any active key is revoked (public has no API access)');
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

// 1. Cancel the subscription FIRST (unless it is already terminal). Order is
//    deliberate: canceling a past_due sub moves it past_due -> canceled via
//    customer.subscription.deleted, whose handler disarms the payment-recovery
//    latch WITHOUT emailing. Voiding the open invoice first would instead remove
//    the only unpaid invoice and flip the sub past_due -> active, tripping the
//    webhook's "payment recovered" email to a customer we're about to cancel.
let finalStatus = status;
if (!alreadyTerminal) {
  try {
    const canceled = await stripe.subscriptions.cancel(subscription.id);
    finalStatus = canceled.status;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`\nError: Stripe subscription cancel failed: ${message}`);
    console.error('No DB changes were made.');
    process.exit(1);
  }
}

// 2. Void the open invoices (still voidable on a canceled sub, and now unable to
//    reactivate it). This stops any lingering collection on the failed charge. A
//    void failure does not undo the cancel above; we surface it and exit non-zero
//    so the operator knows a charge attempt may still be live.
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

// 5. Revoke the member's API keys here rather than leaving it to the webhook,
//    which judges the tier drop against the row that step 3 has often already
//    set to public (see the header).
const keysOk = reportKeyRevocation(
  user,
  `cancel-subscription dropped the account from ${normalizeTier(user.tier)} to public`,
  await revokeKeys(user.email),
);
console.log('The Stripe webhook will reconcile the row to the same values.');

if (voidFailures.length) {
  console.error(`\nWARNING: these invoices could NOT be voided and may still retry: ${voidFailures.join(', ')}`);
  console.error('Void them by hand in the Stripe Dashboard to stop the attempts.');
  process.exit(1);
}
if (!keysOk) process.exit(1);
