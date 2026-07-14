#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/set-cancellation.mts \
//     --email <addr> (--off | --on) [--dry-run | --yes]
//
// Flip ONE customer's cancel_at_period_end flag on their Stripe subscription:
//   --off  Stop a scheduled cancellation. The subscription will renew (or, if
//          she's still on a trial, convert to paid and charge at trial_end)
//          instead of ending. Use this to let a customer who had cancelled
//          convert after all.
//   --on   Schedule cancellation at period end. She keeps access until then,
//          then the subscription ends with no further charge.
//
// This only sets a flag; Stripe does the rest at period end. Clearing it on a
// trialing sub is what turns "trial then cancel" into "trial then convert".
//
// Everything downstream stays automatic. Stripe emits
// customer.subscription.updated, and the webhook (app/api/webhooks/stripe/
// route.ts) mirrors cancel_at_period_end onto the users row and — on the 1→0
// (reactivation) transition — clears cancel_ack_email_sent_at so a future
// re-cancel can re-send the acknowledgement. This script writes those same
// values straight to the row too, so state is correct immediately; the webhook
// reconciles to the same values later (idempotent).
//
// Only operates on a subscription Stripe reports as 'trialing' or 'active'.
// Idempotent: if the flag is already in the requested state, it no-ops.
// Records an audit_events row (type billing_cancellation_set) per change.
//
// NOTE: clearing the flag on someone who deliberately cancelled means she will
// be charged at period end unless she cancels again — make sure she's been told
// (a surprise charge invites a dispute). This script sends NO email; use your
// own note to set expectations.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

const AUDIT_TYPE = 'billing_cancellation_set';

type Args = {
  email: string | null;
  on: boolean;
  off: boolean;
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
  const args: Args = { email: null, on: false, off: false, dryRun: false, yes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--on') args.on = true;
    else if (arg === '--off') args.off = true;
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
  node --experimental-strip-types --no-warnings scripts/set-cancellation.mts \\
    --email <addr> (--off | --on) [--dry-run | --yes]

Sets one customer's cancel_at_period_end flag on their Stripe subscription.

Direction (exactly one required):
      --off   Stop a scheduled cancellation — the subscription renews, or (on a
              trial) converts to paid and charges at trial_end, instead of
              ending. Use to let a customer who had cancelled convert after all.
      --on    Schedule cancellation at period end — she keeps access until then,
              then it ends with no further charge.

Other:
      --dry-run   Print the plan; no Stripe or DB writes.
  -y, --yes       Apply: update Stripe, mirror the row, write an audit row.
  -h, --help      Show this help.

Only operates on a subscription Stripe reports as 'trialing' or 'active'.
No-ops if the flag is already where you asked. Sends NO email.

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

function execSqlite(dbPath: string, sql: string) {
  runSqlite(dbPath, sql);
}

function nowIso() {
  return new Date().toISOString();
}

// Mirror core/stripe.ts getCurrentPeriodEndUnix without importing it (that
// module pulls the '@/core/auth' path alias a raw strip-types run can't
// resolve). On a trial this equals trial_end. Item-level first (2024+ API),
// then the legacy sub-level.
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

if (cliArgs.on === cliArgs.off) {
  console.error('Error: pass exactly one of --off or --on. See --help.');
  process.exit(1);
}
const desired = cliArgs.on; // true => schedule cancel; false => stop cancel

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
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  cancel_at_period_end: number | null;
};

const rows = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, subscription_status, stripe_customer_id, stripe_subscription_id,
          cancel_at_period_end
   FROM users WHERE lower(email) = '${escapeSqlLiteral(cliArgs.email)}' LIMIT 1;`,
);
const user = rows[0];
if (!user) {
  console.error(`Error: no user found with email ${cliArgs.email}.`);
  process.exit(1);
}
if (!user.stripe_subscription_id) {
  console.error(
    `Error: ${user.email} has no Stripe subscription (status=${user.subscription_status ?? 'none'}). Nothing to set.`,
  );
  process.exit(1);
}
// cancel_at_period_end only means anything on a live sub.
if (user.subscription_status !== 'trialing' && user.subscription_status !== 'active') {
  console.error(
    `Error: ${user.email} subscription is '${user.subscription_status ?? 'none'}', not trialing/active. Nothing to set.`,
  );
  process.exit(1);
}

// Live Stripe read is the source of truth for the current flag and status; the
// DB mirror can lag a webhook. Eligibility checks above ran offline.
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

if (subscription.status !== 'trialing' && subscription.status !== 'active') {
  console.error(
    `Error: Stripe reports subscription ${subscription.id} as '${subscription.status}', not trialing/active. Aborting.`,
  );
  process.exit(1);
}

const periodEndUnix = currentPeriodEndUnix(subscription);
const periodEndIso = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;
const isTrial = subscription.status === 'trialing';
const endLabel = isTrial ? 'trial ends' : 'renews';

// Plain-English consequence of the requested state.
const consequence = (() => {
  const at = periodEndIso ?? 'period end';
  if (desired) {
    return isTrial
      ? `At ${at} the trial will END and the subscription will cancel — she will NOT be charged.`
      : `The subscription stays active until ${at}, then CANCELS — no further charge.`;
  }
  return isTrial
    ? `At ${at} Stripe will CHARGE her and convert the trial to a paid subscription (unless she cancels before then).`
    : `The subscription will RENEW at ${at} as normal.`;
})();

console.log(`Auth DB:            ${dbPath}`);
console.log(`Customer:           ${user.email} (id=${user.id})`);
console.log(`Subscription:       ${subscription.id}`);
console.log(`Status:             ${subscription.status} (${endLabel} ${periodEndIso ?? '—'})`);
console.log(`cancel_at_period_end: ${subscription.cancel_at_period_end ? 'true' : 'false'}  →  ${desired ? 'true' : 'false'}`);

if (subscription.cancel_at_period_end === desired) {
  console.log(`\nAlready ${desired ? 'scheduled to cancel' : 'not cancelling'}. Nothing to do.`);
  process.exit(0);
}

console.log('');
console.log(`Effect: ${consequence}`);
if (!desired) {
  console.log(
    'Reminder: this converts a would-be cancellation into a charge. Make sure she knows.',
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

try {
  await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: desired });
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: Stripe subscription update failed: ${message}`);
  console.error('No DB changes were made.');
  process.exit(1);
}

const stamp = nowIso();
// Mirror the flag. On stopping a cancellation (→ false), also clear
// cancel_ack_email_sent_at, matching the webhook's reactivation branch so a
// future re-cancel can re-fire the acknowledgement email.
const clearAckClause = desired ? '' : ", cancel_ack_email_sent_at = NULL";
execSqlite(
  dbPath,
  `UPDATE users SET
     cancel_at_period_end = ${desired ? 1 : 0}${clearAckClause},
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
     '${escapeSqlLiteral(`cancel_at_period_end ${subscription.cancel_at_period_end ? 'true' : 'false'} → ${desired ? 'true' : 'false'} for sub ${subscription.id} (status=${subscription.status})`)}',
     '${escapeSqlLiteral(stamp)}'
   );`,
);

console.log(
  `\nDone. ${user.email}: cancel_at_period_end is now ${desired ? 'true (will cancel at period end)' : 'false (will renew/convert)'}.`,
);
console.log(consequence);
