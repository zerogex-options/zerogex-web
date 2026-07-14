#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/extend-trial.mts \
//     --email <addr> (--extend-days N | --trial-end <ISO>) [--dry-run | --yes]
//
// Manually lengthen ONE customer's free trial — e.g. to thank a helpful early
// user with extra time — while leaving every downstream automation to run on
// its own, exactly as it does for an ordinary trial.
//
// How trials work here (why this is all it takes):
//   The trial lives on the Stripe subscription as `trial_end`. Stripe itself
//   is what charges the card and flips 'trialing' → 'active' the instant
//   `trial_end` passes (the "cutover" — no app cron drives it). The webhook
//   (app/api/webhooks/stripe/route.ts) only MIRRORS Stripe state into the
//   users row: subscription_status, current_period_end (= trial_end during a
//   trial), etc. The ~48h reminder (scripts/send-trial-reminders.mts) keys off
//   users.current_period_end plus the trial_reminder_email_sent_at latch.
//
// So extending a trial is: push `trial_end` out on the Stripe subscription.
// Stripe then re-schedules the cutover to the new date for free, and emits
// customer.subscription.updated so the webhook re-mirrors current_period_end.
//
// The ONE thing the webhook won't do on its own: it only clears the reminder
// latch on a *fresh* transition INTO 'trialing' (route.ts ~L319). A same-
// status trialing→trialing extension leaves trial_reminder_email_sent_at as-is,
// so a customer who was already inside the old 48h window (and got nudged)
// would never be re-nudged before the NEW charge date. This script therefore
// re-arms the latch itself — the surgical equivalent of what the webhook does
// for a brand-new trial — so the ~48h reminder fires again for the new window.
//
// It also writes current_period_end + the re-armed latch straight to the DB so
// the row is correct immediately, not only once the webhook lands. The webhook
// reconciles to the same values later; the writes are idempotent.
//
// This does NOT email the customer that their trial was extended — there is no
// such template, and the request is only to keep the existing automations
// running. Add a note by hand if you want to tell her.
//
// Records an audit_events row (type billing_trial_extended) per run.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

const AUDIT_TYPE = 'billing_trial_extended';
// Stripe rejects a trial_end < ~48h out, and the ~48h reminder can only fire if
// the new end is at least that far away. Match the live checkout route's guard.
const MIN_TRIAL_END_BUFFER_MS = 48 * 60 * 60 * 1000;
// The reminder cron sweeps a 48h target with a +/-3h window; a new end inside
// ~54h of now risks landing past that window, so the nudge may not fire.
const REMINDER_COMFORT_MS = 54 * 60 * 60 * 1000;

type Args = {
  email: string | null;
  extendDays: number | null;
  trialEndIso: string | null;
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
    extendDays: null,
    trialEndIso: null,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--extend-days') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) {
        console.error('Error: --extend-days must be an integer >= 1.');
        process.exit(1);
      }
      args.extendDays = n;
    } else if (arg === '--trial-end') {
      args.trialEndIso = argv[++i] ?? null;
    } else if (arg === '--dry-run') args.dryRun = true;
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
  node --experimental-strip-types --no-warnings scripts/extend-trial.mts \\
    --email <addr> (--extend-days N | --trial-end <ISO>) [--dry-run | --yes]

Lengthens one trialing customer's free trial by pushing out the Stripe
subscription's trial_end, then re-arms the local ~48h reminder latch. Every
other mechanism is unchanged and automatic: Stripe re-schedules the trial→paid
cutover to the new date, the webhook re-mirrors current_period_end, and the
reminder email fires ~48h before the new end (unless she cancels first).

New trial end (exactly one required):
      --extend-days N     Add N days to the CURRENT (live Stripe) trial end.
                          Use this for "give her one more week." N >= 1.
      --trial-end <ISO>   Set an absolute new trial end, e.g.
                          2026-08-01T13:30:00Z. Use this for "until Aug 1."
                          Mutually exclusive with --extend-days.

Guards: the new end must be later than the current one and at least 48h out
(Stripe's floor, and what the reminder needs to still fire).

Other:
      --dry-run           Print the plan; no Stripe or DB writes.
  -y, --yes               Apply: update Stripe, re-mirror the row, re-arm the
                          reminder, and write an audit row.
  -h, --help              Show this help.

Only operates on a subscription Stripe reports as 'trialing'. If she has
already converted to paid, this refuses — comp her instead (e.g.
scripts/back-credit-trial.mts or a Stripe coupon).

Reads STRIPE_SECRET_KEY and NEXT_PUBLIC_APP_URL from env or .env.local. Set
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

// Mirror core/stripe.ts getCurrentPeriodEndUnix without importing it: that
// module pulls in the '@/core/auth' path alias, which a raw `node
// --experimental-strip-types` run can't resolve. During a trial this equals
// trial_end; read item-level first (2024+ API), then the legacy sub-level.
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

function fmtDelta(fromMs: number, toMs: number): string {
  const days = (toMs - fromMs) / (24 * 60 * 60 * 1000);
  return `${days >= 0 ? '+' : ''}${days.toFixed(1)}d`;
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

const targetCount = [cliArgs.extendDays != null, cliArgs.trialEndIso != null].filter(
  Boolean,
).length;
if (targetCount === 0) {
  console.error('Error: one of --extend-days N or --trial-end <ISO> is required. See --help.');
  process.exit(1);
}
if (targetCount > 1) {
  console.error('Error: --extend-days and --trial-end are mutually exclusive.');
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

// Validate the absolute --trial-end shape early (offline) so a typo fails
// before we touch Stripe.
let absoluteTrialEndMs: number | null = null;
if (cliArgs.trialEndIso != null) {
  const ms = Date.parse(cliArgs.trialEndIso);
  if (!Number.isFinite(ms)) {
    console.error(`Error: --trial-end is not a valid date: ${cliArgs.trialEndIso}`);
    process.exit(1);
  }
  absoluteTrialEndMs = ms;
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
  current_period_end: string | null;
  cancel_at_period_end: number | null;
  trial_reminder_email_sent_at: string | null;
};

const rows = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, subscription_status, stripe_customer_id, stripe_subscription_id,
          current_period_end, cancel_at_period_end, trial_reminder_email_sent_at
   FROM users WHERE lower(email) = '${escapeSqlLiteral(cliArgs.email)}' LIMIT 1;`,
);
const user = rows[0];
if (!user) {
  console.error(`Error: no user found with email ${cliArgs.email}.`);
  process.exit(1);
}
if (!user.stripe_subscription_id) {
  console.error(
    `Error: ${user.email} has no Stripe subscription (status=${user.subscription_status ?? 'none'}). There is no trial to extend.`,
  );
  process.exit(1);
}
// Only trials can be "extended". If she has already converted to paid, pushing
// trial_end backwards on an active sub is the wrong tool — comp her instead.
if (user.subscription_status !== 'trialing') {
  console.error(
    `Error: ${user.email} is not on a trial (status=${user.subscription_status ?? 'none'}).`,
  );
  console.error(
    '       Only a trialing subscription can be extended. To thank an already-paying',
  );
  console.error(
    '       customer, credit her instead (scripts/back-credit-trial.mts or a Stripe coupon).',
  );
  process.exit(1);
}

// Live Stripe read is the source of truth for the current trial_end; the DB
// mirror can lag a webhook. All eligibility checks above ran offline, so a
// wrong email / non-trial user fails without a Stripe round-trip.
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

if (subscription.status !== 'trialing') {
  console.error(
    `Error: Stripe reports subscription ${subscription.id} as '${subscription.status}', not 'trialing'.`,
  );
  console.error('       The local row is stale or the trial already converted. Aborting.');
  process.exit(1);
}
if (typeof subscription.trial_end !== 'number') {
  console.error(
    `Error: subscription ${subscription.id} is trialing but has no trial_end set. Aborting.`,
  );
  process.exit(1);
}

const currentTrialEndMs = subscription.trial_end * 1000;

// Resolve the new trial end from whichever flag was given.
const newTrialEndMs =
  absoluteTrialEndMs != null
    ? absoluteTrialEndMs
    : currentTrialEndMs + cliArgs.extendDays! * 24 * 60 * 60 * 1000;
const newTrialEndUnix = Math.floor(newTrialEndMs / 1000);
const nowMs = Date.now();

// Guard 1: never shorten. An earlier/equal end would charge her sooner (or
// immediately) — the opposite of the intent, and easy to hit by fat-fingering
// --trial-end in the past.
if (newTrialEndMs <= currentTrialEndMs) {
  console.error(
    `Error: new trial end (${new Date(newTrialEndMs).toISOString()}) is not after the current one (${new Date(currentTrialEndMs).toISOString()}).`,
  );
  console.error('       This tool only extends. Pick a later date / more days.');
  process.exit(1);
}
// Guard 2: Stripe's ~48h floor, also what the reminder needs to still fire.
if (newTrialEndMs - nowMs < MIN_TRIAL_END_BUFFER_MS) {
  console.error(
    `Error: new trial end must be at least 48h from now. Got ${new Date(newTrialEndMs).toISOString()}.`,
  );
  process.exit(1);
}

const newTrialEndIso = new Date(newTrialEndMs).toISOString();
const reminderTight = newTrialEndMs - nowMs < REMINDER_COMFORT_MS;

console.log(`Auth DB:            ${dbPath}`);
console.log(`Customer:           ${user.email} (id=${user.id})`);
console.log(`Subscription:       ${subscription.id}`);
console.log(`Status:             trialing`);
console.log(`Cancel at end:      ${user.cancel_at_period_end ? 'YES' : 'no'}`);
console.log(
  `Current trial end:  ${new Date(currentTrialEndMs).toISOString()} (${fmtDelta(nowMs, currentTrialEndMs)} from now)`,
);
console.log(
  `New trial end:      ${newTrialEndIso} (${fmtDelta(nowMs, newTrialEndMs)} from now; ${fmtDelta(currentTrialEndMs, newTrialEndMs)} vs current)`,
);
console.log(
  `Reminder sent yet:  ${user.trial_reminder_email_sent_at ? `yes (${user.trial_reminder_email_sent_at}) — will re-arm` : 'no — already armed'}`,
);
console.log('');
console.log('On apply:');
console.log('  1. Stripe subscription.trial_end → new date (proration_behavior=none).');
console.log('  2. Stripe re-schedules the trial→paid charge/cutover to the new date.');
console.log('  3. current_period_end re-mirrored on the users row (webhook also reconciles).');
console.log('  4. trial_reminder_email_sent_at cleared → ~48h reminder re-fires for the new window.');

if (user.cancel_at_period_end) {
  console.log('');
  console.log(
    'Note: this subscription is set to CANCEL at period end. Extending moves that',
  );
  console.log(
    '      cancellation date out too — she keeps access longer but it will still end,',
  );
  console.log(
    '      not convert to paid, unless she removes the cancellation in the billing portal.',
  );
}
if (reminderTight) {
  console.log('');
  console.log(
    'Warning: new trial end is under ~54h out. The ~48h reminder sweep may miss its',
  );
  console.log('         window, so the courtesy nudge might not fire. Consider a later date.');
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

let updated: Stripe.Subscription;
try {
  updated = await stripe.subscriptions.update(subscription.id, {
    trial_end: newTrialEndUnix,
    // No invoice exists yet during a trial, but pin this so Stripe can't decide
    // to prorate/charge anything as a side effect of the edit.
    proration_behavior: 'none',
  });
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: Stripe subscription update failed: ${message}`);
  console.error('No DB changes were made.');
  process.exit(1);
}

// Prefer the value Stripe echoes back (what the webhook will also converge to);
// during a trial it equals the new trial_end anyway, so fall back to that.
const mirroredEndUnix = currentPeriodEndUnix(updated) ?? newTrialEndUnix;
const mirroredEndIso = new Date(mirroredEndUnix * 1000).toISOString();
const stamp = nowIso();

// Re-mirror current_period_end and re-arm the reminder latch in one write. The
// webhook's customer.subscription.updated handler will later set the same
// values (idempotent); doing it here makes the row correct immediately.
execSqlite(
  dbPath,
  `UPDATE users SET
     current_period_end = '${escapeSqlLiteral(mirroredEndIso)}',
     subscription_status = 'trialing',
     trial_reminder_email_sent_at = NULL,
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
     '${escapeSqlLiteral(`Trial extended for sub ${subscription.id}: ${new Date(currentTrialEndMs).toISOString()} → ${newTrialEndIso}; reminder latch re-armed`)}',
     '${escapeSqlLiteral(stamp)}'
   );`,
);

console.log(`\nDone. Trial for ${user.email} now ends ${newTrialEndIso}.`);
console.log(
  'Stripe will charge and convert her at that date unless she cancels first; the ~48h',
);
console.log('reminder email is re-armed and will fire before then, just like any other trial.');
