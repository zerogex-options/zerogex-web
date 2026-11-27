#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/set-cancellation.mts \
//     --email <addr> (--off | --on) [--dry-run | --yes]
//
// Flip ONE customer's cancel_at_period_end flag on their Stripe subscription:
//   --off  Stop a scheduled cancellation. The subscription will renew (or, if
//          she's still on a trial, convert to paid and charge at trial_end)
//          instead of ending. Use this to let a customer who had canceled
//          convert after all.
//   --on   Schedule cancellation at period end. She keeps access until then,
//          then the subscription ends with no further charge. A paused
//          subscription has its pause ended in the same update, exactly as the
//          Account page's Cancel does (core/subscriptionPause.ts
//          scheduleCancelParams), so it is never paused and canceling at once.
//          A plan change the billing portal is holding until period end (a
//          downgrade) is released first, also as the Account page's Cancel
//          does: Stripe won't set the cancel while a schedule governs the
//          subscription, and the plan ends as it is now
//          (core/pendingPlanChange.ts). The preview shows it. The row is then
//          left for the webhook to write, with the cancellation email held
//          (below).
//
// This only sets a flag; Stripe does the rest at period end. Clearing it on a
// trialing sub is what turns "trial then cancel" into "trial then convert".
//
// Everything downstream stays automatic. Stripe emits
// customer.subscription.updated, and the webhook (app/api/webhooks/stripe/
// route.ts) mirrors cancel_at_period_end onto the users row and — on the 1→0
// (reactivation) transition — clears cancel_ack_email_sent_at so a future
// re-cancel can re-send the acknowledgment. This script writes those same
// values straight to the row too, so state is correct immediately; the webhook
// reconciles to the same values later (idempotent). For --on, that write is
// also what keeps the cancellation email ("Sorry to see you go") from going
// out: the webhook sends it on a 0→1 change it reads off the row, and with the
// row already at 1, as it almost always is by then, it sees none.
//
// Except after releasing a waiting plan change. The release sends its own
// customer.subscription.updated, still not canceling, and Stripe can deliver it
// late. Landing after the row was set to 1, it would read as an un-cancel (1→0)
// and clear cancel_ack_email_sent_at, and the cancel's own event would then
// send the email. So after a release, the script leaves the flag for the
// webhook to write and, just before asking Stripe for the cancel, sets
// cancel_ack_email_sent_at itself: the latch the webhook must claim before it
// sends (core/cancelAck.ts). A late release event then finds the row still at
// 0 and changes nothing, or, landing after the cancel's event, is dropped as
// stale (RELEASE_SETTLE_MS in core/pendingPlanChange.ts). The cancel's event
// records the cancel the way an in-app cancel's does, a
// stripe_cancellation_requested row that the cancel reports and the Growth tab
// count, minus the email. The row shows the cancel once that event lands,
// usually within seconds. If the cancel fails, the latch is cleared again, so
// a later cancel is acknowledged as usual.
//
// Only operates on a subscription Stripe reports as 'trialing' or 'active'.
// Idempotent: if the flag is already in the requested state, it no-ops.
// Records an audit_events row (type billing_cancellation_set) per change.
//
// NOTE: clearing the flag on someone who deliberately canceled means she will
// be charged at period end unless she cancels again — make sure she's been told
// (a surprise charge invites a dispute). This script sends NO email; use your
// own note to set expectations.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

import { derivePauseState, scheduleCancelParams } from '../core/subscriptionPause.ts';
import { pendingScheduleId, releasePendingPlanChange } from '../core/pendingPlanChange.ts';

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
              ending. Use to let a customer who had canceled convert after all.
      --on    Schedule cancellation at period end — she keeps access until then,
              then it ends with no further charge. A paused subscription has
              its pause ended too, and a plan change the billing portal is
              holding until period end is dropped, as the Account page's
              Cancel does.

Other:
      --dry-run   Print the plan; no Stripe or DB writes.
  -y, --yes       Apply: update Stripe, mirror the row, write an audit row.
                  After dropping a waiting plan change, the webhook mirrors
                  the row instead, with the cancellation email held.
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

// The live site writes to this same database whenever a member is active
// (session refreshes, last-seen stamps), and the sqlite3 CLI's default busy
// timeout is ZERO: a statement that lands while the site holds the write lock
// fails on the spot with "database is locked (5)" and stops the run partway.
// `.timeout` makes the CLI wait for the lock the way the site does (core/db.ts
// sets busy_timeout too). Passed via -cmd so it applies before the SQL and adds
// nothing to the -json output. Same fix as the scheduled jobs.
const SQLITE_BUSY_TIMEOUT_MS = 15_000;

function isLockError(message: string): boolean {
  return /database is locked|database table is locked|busy/i.test(message);
}

// Synchronous pause between retries; execSqlite is synchronous.
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runSqlite(dbPath: string, sql: string): string {
  try {
    return execFileSync('sqlite3', ['-cmd', `.timeout ${SQLITE_BUSY_TIMEOUT_MS}`, '-json', dbPath, sql], {
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

// Retries on top of the busy timeout: the timeout covers a write that holds the
// lock briefly, the retries a burst of writes that outlasts it. Anything that is
// not a lock error fails on the first try, since a bad statement won't fix
// itself. Safe to repeat: every write here is a single statement or a whole
// BEGIN ... COMMIT, the CLI stops at the first failing statement, and it rolls
// back an open transaction when it exits, so a failed attempt wrote nothing.
// Returns the CLI's -json output, for a write that reads its result back.
function execSqlite(dbPath: string, sql: string, attempts = 3): string {
  for (let attempt = 1; ; attempt++) {
    try {
      return runSqlite(dbPath, sql);
    } catch (err) {
      if (attempt >= attempts || !isLockError((err as Error).message)) throw err;
      sleepSync(attempt * 500);
    }
  }
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

// The cancellation email ("Sorry to see you go", core/cancelAck.ts) is latched
// on users.cancel_ack_email_sent_at: the webhook sends it only if it can set
// that from empty. Setting it here first, the way the webhook does, holds the
// email back. Returns the stamp when this run set it, or null when it was
// already set: held all the same, but not this run's to clear. Throws when the
// email is not held, so the caller doesn't go on to the cancel.
function holdCancelEmail(dbPath: string, userId: string): string | null {
  const stamp = nowIso();
  const output = execSqlite(
    dbPath,
    `UPDATE users SET cancel_ack_email_sent_at = '${escapeSqlLiteral(stamp)}', updated_at = '${escapeSqlLiteral(stamp)}'
     WHERE id = '${escapeSqlLiteral(userId)}' AND cancel_ack_email_sent_at IS NULL;
     SELECT cancel_ack_email_sent_at AS held FROM users WHERE id = '${escapeSqlLiteral(userId)}';`,
  ).trim();
  const held = output ? (JSON.parse(output) as Array<{ held: string | null }>)[0]?.held ?? null : null;
  if (!held) throw new Error('cancel_ack_email_sent_at is still empty after setting it');
  return held === stamp ? stamp : null;
}

// Undoes holdCancelEmail's stamp, and only that stamp, so a cancel that didn't
// go through leaves the member's next cancel acknowledged as usual.
function clearHeldCancelEmailSql(userId: string, stamp: string): string {
  return `UPDATE users SET cancel_ack_email_sent_at = NULL, updated_at = '${escapeSqlLiteral(nowIso())}'
   WHERE id = '${escapeSqlLiteral(userId)}' AND cancel_ack_email_sent_at = '${escapeSqlLiteral(stamp)}';`;
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
// A paused plan has no access and skips its bills until the pause ends.
const pause = derivePauseState(
  subscription.pause_collection
    ? {
        behavior: subscription.pause_collection.behavior ?? null,
        resumesAt: subscription.pause_collection.resumes_at ?? null,
      }
    : null,
);
const pausedUntil = pause.resumesAtIso ?? 'no resume date';
// --on ends a pause in the same update (scheduleCancelParams).
const endsPause = desired && pause.paused;

// A plan change the billing portal is holding until period end keeps the
// subscription on a schedule, and Stripe won't set the cancel while one is
// attached. --on releases it first (core/pendingPlanChange.ts).
const pendingSchedule = pendingScheduleId(subscription);
const dropsPlanChange = desired && pendingSchedule !== null;

// Plain-English consequence of the requested state.
const consequence = (() => {
  const at = periodEndIso ?? 'period end';
  if (desired) {
    const ending = isTrial
      ? `At ${at} the trial will END and the subscription will cancel — she will NOT be charged.`
      : `The subscription stays active until ${at}, then CANCELS — no further charge.`;
    const afterPause = endsPause ? `The pause ENDS now, so access comes back. ${ending}` : ending;
    return dropsPlanChange
      ? `The waiting plan change is DROPPED, so the plan stays as it is now. ${afterPause}`
      : afterPause;
  }
  if (pause.paused) {
    // Taking the cancel off a paused plan leaves the pause in place.
    return `It stays PAUSED until ${pausedUntil}: no access and no charge until then, and billing restarts after it.`;
  }
  return isTrial
    ? `At ${at} Stripe will CHARGE her and convert the trial to a paid subscription (unless she cancels before then).`
    : `The subscription will RENEW at ${at} as normal.`;
})();

console.log(`Auth DB:            ${dbPath}`);
console.log(`Customer:           ${user.email} (id=${user.id})`);
console.log(`Subscription:       ${subscription.id}`);
console.log(`Status:             ${subscription.status} (${endLabel} ${periodEndIso ?? '—'})`);
console.log(`Paused:             ${pause.paused ? `yes, until ${pausedUntil}` : 'no'}`);
console.log(
  `Plan change:        ${pendingSchedule ? `waiting until period end (schedule ${pendingSchedule})` : 'none waiting'}`,
);
console.log(`cancel_at_period_end: ${subscription.cancel_at_period_end ? 'true' : 'false'}  →  ${desired ? 'true' : 'false'}`);

if (subscription.cancel_at_period_end === desired) {
  console.log(`\nAlready ${desired ? 'scheduled to cancel' : 'not canceling'}. Nothing to do.`);
  if (desired && pause.paused) {
    // Paused and canceling at once, from before Cancel ended a pause (or a
    // Dashboard edit): no access, though every message says otherwise.
    console.log('It is also PAUSED, so it has no access until the cancel. To give that access back,');
    console.log(`end the pause and keep the cancel: make resume-subscription EMAIL=${user.email}`);
  }
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

// --on releases a waiting plan change first, or Stripe refuses the cancel.
let releasedSchedule: string | null = null;
if (desired) {
  try {
    releasedSchedule = await releasePendingPlanChange(stripe, subscription);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`\nError: releasing the waiting plan change (schedule ${pendingSchedule}) failed: ${message}`);
    console.error('Nothing was changed, in Stripe or the DB.');
    process.exit(1);
  }
}

const releasedFirst = (schedule: string) =>
  `The waiting plan change (schedule ${schedule}) WAS released first, so the plan stays as it is. ` +
  'Run the same command again: with no schedule left, it goes straight to the cancel.';

// After a release, the cancellation email is held before the cancel is asked
// for, and the flag is left for the webhook to write (see the header). Held
// last thing before the cancel, so an interrupted run has almost no chance to
// leave it held with no cancel behind it.
let heldEmailStamp: string | null = null;
if (releasedSchedule) {
  try {
    heldEmailStamp = holdCancelEmail(dbPath, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`\nError: holding the cancellation email failed, so the cancel was NOT sent: ${message}`);
    console.error(releasedFirst(releasedSchedule));
    console.error('No DB changes were made.');
    process.exit(1);
  }
}

try {
  await stripe.subscriptions.update(
    subscription.id,
    // --on is the Account page's Cancel: it ends a pause too.
    desired
      ? (scheduleCancelParams({ pauseCollection: subscription.pause_collection }) as Stripe.SubscriptionUpdateParams)
      : { cancel_at_period_end: false },
  );
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: Stripe subscription update failed: ${message}`);
  if (releasedSchedule) console.error(releasedFirst(releasedSchedule));
  if (heldEmailStamp) {
    // Held for a cancel that didn't happen. Left held, the member's next
    // cancel would go unacknowledged. If Stripe did apply it and only the reply
    // was lost, clearing it lets the usual email go out: the harmless way to be
    // wrong.
    const clearSql = clearHeldCancelEmailSql(user.id, heldEmailStamp);
    try {
      execSqlite(dbPath, clearSql);
    } catch (clearErr) {
      const clearMessage = clearErr instanceof Error ? clearErr.message : 'unknown error';
      console.error(`The cancellation email is still held: clearing it failed: ${clearMessage}`);
      console.error(
        'Until it is cleared, the member\'s next cancel gets no "Sorry to see you go" email and no save offer. Clear it now:',
      );
      console.error(`sqlite3 -bail -cmd ".timeout ${SQLITE_BUSY_TIMEOUT_MS}" '${dbPath}' <<'SQL'\n${clearSql}\nSQL`);
      process.exit(1);
    }
    console.error('Nothing is left changed in the DB: the cancellation email it held is cleared again.');
    process.exit(1);
  }
  console.error('No DB changes were made.');
  process.exit(1);
}

const stamp = nowIso();
// Mirror the flag. On stopping a cancellation (→ false), also clear
// cancel_ack_email_sent_at, matching the webhook's reactivation branch so a
// future re-cancel can re-fire the acknowledgment email. After a release the
// flag is the webhook's to write (see the header): only the audit row is here.
const clearAckClause = desired ? '' : ", cancel_ack_email_sent_at = NULL";
const mirrorSql = releasedSchedule
  ? ''
  : `UPDATE users SET
     cancel_at_period_end = ${desired ? 1 : 0}${clearAckClause},
     updated_at = '${escapeSqlLiteral(stamp)}'
   WHERE id = '${escapeSqlLiteral(user.id)}';
`;
const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
// The mirrored flag and the audit row go in one transaction: one lock to wait
// for instead of two, and never one without the other.
const recordSql = `${mirrorSql}INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
   VALUES (
     '${escapeSqlLiteral(auditId)}',
     '${escapeSqlLiteral(AUDIT_TYPE)}',
     '${escapeSqlLiteral(user.id)}',
     NULL,
     '${escapeSqlLiteral(user.email)}',
     'manual-script',
     '${escapeSqlLiteral(`cancel_at_period_end ${subscription.cancel_at_period_end ? 'true' : 'false'} → ${desired ? 'true' : 'false'} for sub ${subscription.id} (status=${subscription.status})${endsPause ? `; ended its pause (was paused until ${pausedUntil})` : ''}${releasedSchedule ? `; released its waiting plan change (schedule ${releasedSchedule}) first, so left the flag for the webhook to record, with the cancellation email held (cancel_ack_email_sent_at)` : ''}`)}',
     '${escapeSqlLiteral(stamp)}'
   );`;
try {
  execSqlite(dbPath, `BEGIN IMMEDIATE;\n${recordSql}\nCOMMIT;`);
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(
    `\ncancel_at_period_end is now ${desired ? 'true' : 'false'} on ${subscription.id} in Stripe, but not recorded here: ${message}`,
  );
  console.error(
    releasedSchedule
      ? 'The webhook still records the cancel, with no email, but nothing here shows it was set by hand: a re-run finds Stripe already set and records nothing. Record it now:'
      : "Unrecorded, the site goes by the old setting until Stripe's webhook catches up, and nothing here shows it was changed by hand: a re-run finds Stripe already set and records nothing. Record it now:",
  );
  // A quoted heredoc, so the shell passes the SQL through untouched, and
  // -bail, so a statement that fails stops the rest and nothing is half-written.
  console.error(`sqlite3 -bail -cmd ".timeout ${SQLITE_BUSY_TIMEOUT_MS}" '${dbPath}' <<'SQL'\nBEGIN;\n${recordSql}\nCOMMIT;\nSQL`);
  process.exit(1);
}

console.log(
  `\nDone. ${user.email}: cancel_at_period_end is now ${desired ? 'true (will cancel at period end)' : 'false (will renew/convert)'}.`,
);
console.log(consequence);
if (endsPause) {
  console.log('Access comes back as soon as the webhook lands. Check with make diagnose-user if in doubt.');
}
if (releasedSchedule) {
  console.log(
    "The site records the cancel when Stripe's webhook lands, usually within seconds (make diagnose-user shows it then). The cancellation email was held, so the member gets none.",
  );
}
