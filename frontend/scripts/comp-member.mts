#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/comp-member.mts \
//     --email <addr> [--tier pro] [--refund] [--finalize] [--dry-run | --yes]
//
// Comp ONE member onto a paid tier permanently, for free — the "thanks for the
// bug report, here's Pro on the house" path. Handles both shapes of account:
// a member with no subscription (a bare tier flip is enough) and a PAYING
// member (whose live subscription has to be retired first, in a specific
// order).
//
// WHY THIS SCRIPT EXISTS -- the ordering is not obvious and both orderings that
// feel natural are wrong:
//
//   * Flipping tier alone on a paying member does NOT hold. Every subscription
//     sync recomputes the tier from the Stripe price
//     (app/api/webhooks/stripe/route.ts, `nextTier`), so the member's next
//     renewal -- or any customer.subscription.updated at all -- silently
//     rewrites the comp back to their paid tier. It also leaves them being
//     charged, which is the opposite of a comp.
//
//   * Cancelling AFTER granting the comp destroys it. customer.subscription
//     .deleted hard-sets tier='public' (clearSubscriptionFromUser), so the
//     member lands BELOW where they started.
//
// So the order is: cancel first, wait for the deleted webhook to actually land,
// and only then write the comped tier. Step 3 below is the whole point of this
// script -- it is the step an operator doing this by hand forgets.
//
// What it does, in order:
//   1. (paying members) Cancel the subscription immediately in Stripe and
//      mirror the downgrade onto the users row -- the same columns
//      clearSubscriptionFromUser writes, so the webhook reconciles to identical
//      values. Mirroring BEFORE the webhook lands also means the webhook sees a
//      public->public transition, so it does not revoke the member's API keys
//      on the way through.
//   2. (--refund) Refund the most recent PAID invoice on that subscription.
//      Cancelling is not a refund: a member mid-period has already paid for time
//      you are about to give away for free.
//   3. WAIT for the webhook's stripe_subscription_deleted audit row before
//      writing anything else. This is the race the manual runbook loses.
//   4. Set the comped tier and write a billing_member_comped audit row.
//   5. Re-read after a settle delay and verify the tier actually stuck.
//
// If step 3 times out (webhook backed up / Stripe retrying), NOTHING is comped
// and the script exits non-zero telling you to re-run with --finalize once the
// event lands. --finalize skips straight to steps 4-5 and is safe to re-run.
//
// The subscription is ended, so Stripe cannot charge the member again -- there
// is no sub left to renew. The comped tier has no expiry: the only sweep that
// demotes a Pro-without-a-sub account is scripts/expire-partner-grants.mjs,
// which is scoped to partner_tier='creator' and will not touch a comped member.
//
// Sends NO email -- tell the member yourself. Reads STRIPE_SECRET_KEY from env
// or .env.local. Set AUTH_DB_PATH to override the default DB path.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

const AUDIT_TYPE = 'billing_member_comped';
// Written by clearSubscriptionFromUser in the Stripe webhook. Its appearance is
// our proof the deleted event has been processed and can no longer clobber the
// tier we are about to write.
const WEBHOOK_DELETED_AUDIT_TYPE = 'stripe_subscription_deleted';
const VALID_TIERS = ['basic', 'pro'];
const DEFAULT_WAIT_SECONDS = 180;
const POLL_INTERVAL_MS = 3000;
// Grace after the tier write before re-reading, so a webhook that was already
// in flight has time to show itself in the verification read.
const SETTLE_MS = 5000;

type Args = {
  email: string | null;
  tier: string;
  refund: boolean;
  finalize: boolean;
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
    tier: 'pro',
    refund: false,
    finalize: false,
    waitSeconds: DEFAULT_WAIT_SECONDS,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--tier') args.tier = (argv[++i] ?? '').trim().toLowerCase();
    else if (arg === '--refund') args.refund = true;
    else if (arg === '--finalize') args.finalize = true;
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
  node --experimental-strip-types --no-warnings scripts/comp-member.mts \\
    --email <addr> [--tier pro] [--refund] [--finalize] [--dry-run | --yes]

Permanently comps one member onto a paid tier for free. Retires any live
subscription first, in the order that survives the Stripe webhook.

Options:
      --email <addr>       Member to comp (required).
      --tier <tier>        Comped tier: ${VALID_TIERS.join(' | ')} (default: pro).
      --refund             Also refund the most recent PAID invoice on the
                           subscription. Cancelling alone is not a refund.
      --finalize           Skip the cancel; just write the comped tier and
                           verify. Use after a --wait-seconds timeout. Safe to
                           re-run.
      --wait-seconds <n>   How long to wait for the deleted webhook to land
                           (default: ${DEFAULT_WAIT_SECONDS}).
      --dry-run            Print the plan; no Stripe or DB writes.
  -y, --yes                Apply.
  -h, --help               Show this help.

Sends NO email. Reads STRIPE_SECRET_KEY from env or .env.local; set
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function auditInsert(dbPath: string, userId: string, email: string, type: string, message: string) {
  const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
  execSqlite(
    dbPath,
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (
       '${escapeSqlLiteral(auditId)}',
       '${escapeSqlLiteral(type)}',
       '${escapeSqlLiteral(userId)}',
       NULL,
       '${escapeSqlLiteral(email)}',
       'manual-script',
       '${escapeSqlLiteral(message)}',
       '${escapeSqlLiteral(nowIso())}'
     );`,
  );
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

if (!VALID_TIERS.includes(cliArgs.tier)) {
  console.error(`Error: invalid --tier "${cliArgs.tier}". Expected one of: ${VALID_TIERS.join(', ')}.`);
  process.exit(1);
}

if (cliArgs.dryRun && cliArgs.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}

if (!Number.isFinite(cliArgs.waitSeconds) || cliArgs.waitSeconds < 0) {
  console.error('Error: --wait-seconds must be a non-negative number.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
function envOrLocal(key: string): string | undefined {
  return process.env[key] || envLocal[key] || undefined;
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

function loadUser(): UserRow {
  const rows = querySqlite<UserRow>(
    dbPath,
    `SELECT id, email, tier, subscription_status, stripe_customer_id, stripe_subscription_id
     FROM users WHERE lower(email) = '${escapeSqlLiteral(cliArgs.email as string)}' LIMIT 1;`,
  );
  const found = rows[0];
  if (!found) {
    console.error(`Error: no user found with email ${cliArgs.email}.`);
    process.exit(1);
  }
  return found;
}

const user = loadUser();

// --finalize is the "the cancel already happened, just land the comp" path. If
// the row still carries a subscription id, the cancel did NOT happen (or has not
// been mirrored), and comping now would be overwritten by the next subscription
// sync — the exact failure this script exists to prevent. Refuse rather than
// write a comp that quietly evaporates.
if (cliArgs.finalize && user.stripe_subscription_id) {
  console.error(
    `Error: ${user.email} still has subscription ${user.stripe_subscription_id} on their row.`,
  );
  console.error('--finalize is only for finishing a comp whose cancel already landed.');
  console.error('Run the full comp instead (it cancels, waits, then comps):');
  console.error(`  make comp-member EMAIL=${user.email} TIER=${cliArgs.tier} YES=1`);
  process.exit(1);
}

// Stripe is only needed when there is a subscription to retire.
const needsStripe = !cliArgs.finalize && Boolean(user.stripe_subscription_id);
let stripe: Stripe | null = null;
if (needsStripe) {
  const STRIPE_SECRET_KEY = envOrLocal('STRIPE_SECRET_KEY');
  if (!STRIPE_SECRET_KEY) {
    console.error('Error: STRIPE_SECRET_KEY not set in env or .env.local.');
    process.exit(1);
  }
  stripe = new Stripe(STRIPE_SECRET_KEY);
}

let subscription: Stripe.Subscription | null = null;
if (stripe && user.stripe_subscription_id) {
  try {
    subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id, {
      expand: ['items.data.price'],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`Error: could not retrieve subscription ${user.stripe_subscription_id}: ${message}`);
    process.exit(1);
  }
}

const subStatus = subscription?.status ?? null;
const subIsLive = subStatus !== null && subStatus !== 'canceled' && subStatus !== 'incomplete_expired';

// The most recent PAID invoice is what --refund targets: the member has already
// paid for period time we are about to hand over for free.
let refundTarget: Stripe.Invoice | null = null;
if (stripe && subscription && cliArgs.refund) {
  try {
    const list = await stripe.invoices.list({ subscription: subscription.id, status: 'paid', limit: 10 });
    refundTarget = list.data.find((inv) => (inv.amount_paid ?? 0) > 0) ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`Warning: could not list paid invoices: ${message}`);
  }
}

console.log(`Auth DB:            ${dbPath}`);
console.log(`Member:             ${user.email} (id=${user.id})`);
console.log(`Tier (DB):          ${user.tier ?? '—'}  →  ${cliArgs.tier} (comped, no expiry)`);
if (cliArgs.finalize) {
  console.log('Mode:               --finalize (no cancel; write the comped tier and verify)');
} else if (subscription) {
  console.log(`Subscription:       ${subscription.id} (${subStatus})`);
  const price = subscription.items?.data?.[0]?.price;
  if (price) {
    console.log(
      `Plan:               ${formatAmount(price.unit_amount, price.currency)} / ${price.recurring?.interval ?? '—'}`,
    );
  }
  console.log(`Effect:             CANCEL immediately, wait for the deleted webhook, then comp to ${cliArgs.tier}.`);
} else {
  console.log('Subscription:       none — a bare tier flip is enough.');
}
if (cliArgs.refund) {
  console.log(
    `Refund:             ${
      refundTarget
        ? `${refundTarget.id} ${formatAmount(refundTarget.amount_paid, refundTarget.currency)}`
        : 'no paid invoice found — nothing to refund'
    }`,
  );
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

let canceledSubId: string | null = null;

if (!cliArgs.finalize && stripe && subscription && subIsLive) {
  // 1. Cancel in Stripe. After this there is no subscription left to renew, so
  //    the member cannot be charged again.
  let finalStatus = subStatus as string;
  try {
    const canceled = await stripe.subscriptions.cancel(subscription.id);
    finalStatus = canceled.status;
    canceledSubId = subscription.id;
    console.log(`\nCanceled ${subscription.id} (was '${subStatus}', now '${finalStatus}').`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`\nError: Stripe subscription cancel failed: ${message}`);
    console.error('No DB changes were made.');
    process.exit(1);
  }

  // 2. Mirror the downgrade onto the row — the same columns
  //    clearSubscriptionFromUser writes, so the webhook reconciles to identical
  //    values. Doing it now also means the webhook observes public->public and
  //    leaves the member's API keys alone.
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
       updated_at = '${escapeSqlLiteral(nowIso())}'
     WHERE id = '${escapeSqlLiteral(user.id)}';`,
  );

  // 3. Refund, if asked. Done after the cancel so a refund failure cannot leave
  //    a live subscription behind; surfaced as a warning because the comp is
  //    still the right end state either way.
  if (cliArgs.refund && refundTarget) {
    const paymentIntent =
      typeof (refundTarget as unknown as { payment_intent?: string | { id: string } }).payment_intent === 'string'
        ? ((refundTarget as unknown as { payment_intent?: string }).payment_intent as string)
        : ((refundTarget as unknown as { payment_intent?: { id: string } }).payment_intent?.id ?? null);
    if (!paymentIntent) {
      console.error(`Warning: invoice ${refundTarget.id} has no payment_intent — refund it by hand in Stripe.`);
    } else {
      try {
        const refund = await stripe.refunds.create({ payment_intent: paymentIntent });
        console.log(
          `Refunded ${formatAmount(refund.amount, refund.currency)} against ${refundTarget.id} (${refund.id}).`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        console.error(`Warning: refund failed for ${refundTarget.id}: ${message}`);
        console.error('Refund it by hand in the Stripe Dashboard; the comp below still applies.');
      }
    }
  }

  // 4. WAIT for the deleted webhook. Writing the comped tier before this lands
  //    would have clearSubscriptionFromUser overwrite it with 'public'.
  const deadline = Date.now() + cliArgs.waitSeconds * 1000;
  let landed = false;
  process.stdout.write(`Waiting up to ${cliArgs.waitSeconds}s for the ${WEBHOOK_DELETED_AUDIT_TYPE} webhook`);
  while (Date.now() < deadline) {
    const hit = querySqlite<{ n: number }>(
      dbPath,
      `SELECT COUNT(*) AS n FROM audit_events
       WHERE user_id = '${escapeSqlLiteral(user.id)}'
         AND type = '${escapeSqlLiteral(WEBHOOK_DELETED_AUDIT_TYPE)}'
         AND created_at >= '${escapeSqlLiteral(new Date(Date.now() - cliArgs.waitSeconds * 1000 - 60000).toISOString())}';`,
    );
    if ((hit[0]?.n ?? 0) > 0) {
      landed = true;
      break;
    }
    process.stdout.write('.');
    await sleep(POLL_INTERVAL_MS);
  }
  process.stdout.write('\n');

  if (!landed) {
    console.error(`\nThe ${WEBHOOK_DELETED_AUDIT_TYPE} event has not landed yet.`);
    console.error('The subscription IS canceled — the member is not being charged. But the comp was');
    console.error('NOT written, because the pending webhook would overwrite it with public.');
    console.error('Once the event shows up, finish with:');
    console.error(`  make comp-member EMAIL=${user.email} TIER=${cliArgs.tier} FINALIZE=1 YES=1`);
    process.exit(1);
  }
  console.log('Webhook landed — safe to comp.');
}

// 5. Write the comped tier.
execSqlite(
  dbPath,
  `UPDATE users SET tier = '${escapeSqlLiteral(cliArgs.tier)}', updated_at = '${escapeSqlLiteral(nowIso())}'
   WHERE id = '${escapeSqlLiteral(user.id)}';`,
);
auditInsert(
  dbPath,
  user.id,
  user.email,
  AUDIT_TYPE,
  `Comped to ${cliArgs.tier} (free, no expiry)${canceledSubId ? `; canceled sub ${canceledSubId}` : ''}`,
);

// 6. Settle and verify the tier actually stuck — a webhook already in flight
//    when we wrote would show up here.
await sleep(SETTLE_MS);
const after = loadUser();
if (after.tier !== cliArgs.tier) {
  console.error(`\nFAILED: tier is '${after.tier}', expected '${cliArgs.tier}'.`);
  console.error('Something reconciled the row after the write. Re-run with FINALIZE=1 once it settles.');
  process.exit(1);
}

console.log(`\nDone. ${user.email} is on '${after.tier}' — free, no subscription, nothing to cancel.`);
if (after.stripe_subscription_id) {
  console.error(`WARNING: a subscription id is still on the row (${after.stripe_subscription_id}).`);
  process.exit(1);
}
console.log('Sends no email — tell the member yourself.');
