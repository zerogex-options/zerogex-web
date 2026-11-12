#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-verified-never-paid.mts \
//     [--dry-run | --yes] [--lag-hours N] [--lookback-hours N] [--preview-to <email>]
//
// Finds every user in the "verified-never-paid" reactivation cohort (see
// scripts/list-public-cohort.mjs) whose account is at least LAG_HOURS old but
// no older than LOOKBACK_HOURS, and sends a one-shot founder-voice nudge
// pitching the 7-day free trial.
//
// Intended to be scheduled (cron or systemd timer) every 2 hours; the
// systemd unit (zerogex-web-verified-never-paid.timer) fires every 2h on the
// :30 minute so it doesn't collide with the hourly auth backup at :00, the
// trial-reminder timer at :15, or the checkout-recovery timer at :45.
//
// Eligibility mirrors list-public-cohort.mjs's `verified-never-paid` bucket
// exactly, so a user only ever falls into this queue if none of the higher-
// priority cohorts already own them (unverified / founding-eligible /
// churned all get their own targeted messages):
//   - users.tier = 'public'
//   - users.email_verified_at IS NOT NULL (proved ownership; won't bounce)
//   - NOT founding-eligible-not-redeemed *while the founding lock-in window is
//     still open* (send-founding-final-call owns them then). Once
//     FOUNDING_LOCKIN_DEADLINE_ISO passes, that campaign hard-refuses to send
//     and this carve-out LIFTS: a founding-eligible-never-redeemed user is now
//     just a verified-never-paid signup (the founding rate is gone, so the
//     trial is the only ask). Keeping the carve-out post-deadline is what
//     stranded the launch cohort with zero automated email.
//   - NOT churned (subscription_lapsed=1 would want a discount pitch instead)
//   - users.stripe_subscription_id IS NULL (belt-and-suspenders for tier=public)
//   - users.verified_never_paid_email_sent_at IS NULL (one-shot dedupe)
//   - users.created_at in [now - LOOKBACK_HOURS, now - LAG_HOURS]
//   - users.marketing_unsubscribed_at IS NULL (a sales pitch, so the marketing
//     opt-out holds). Checked after the query and before --limit cuts the
//     batch, so every run counts them, a dry run names them, and they never
//     take a slot in a capped batch.
//
// Side effects on send:
//   - Resend email via core/mailer.ts sendVerifiedNeverPaidEmail(), carrying
//     the member's signed one-click unsubscribe link (core/unsubToken.ts
//     buildUnsubUrl) in the footer and the List-Unsubscribe header.
//   - Stamps users.verified_never_paid_email_sent_at = now (permanent latch).
//   - Writes a `verified_never_paid_email_sent` row into audit_events.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import { sendVerifiedNeverPaidEmail } from '../core/mailer.ts';
import { isFoundingLockinOpen } from '../core/foundingLockin.ts';
import { buildUnsubUrl } from '../core/unsubToken.ts';
import { isNoCardTrialEnabled } from '../core/noCardTrial.ts';

// 2h lag matches the user-facing intent: give someone a chance to click
// through the verification link, browse a bit, and either bounce or start
// checkout on their own before we interrupt with a founder email. 7d
// lookback bounds the mass-email risk on first deploy (only accounts
// signed up in the last week ever qualify), and >> the 2h cron cadence
// so nobody slips through a tick.
// Both default to OFF so the every-2h systemd unit behaves exactly as before.
// They exist for draining a BACKLOG by hand: the lookback window means anyone
// who verified longer ago than it never became eligible and, because the latch
// is one-shot, never will. Re-running with a wide --lookback-hours reaches them,
// but that turns a trickle into hundreds of emails at once, to addresses months
// old, from a domain that normally sends a handful an hour. Spam complaints
// there cost deliverability on the mail that actually must arrive — receipts,
// trial reminders, payment failures. So a backlog drain goes out in bounded,
// spaced batches.
const DEFAULT_LIMIT: number | null = null;
const DEFAULT_THROTTLE_MS = 0;

const DEFAULT_LAG_HOURS = 2;
const DEFAULT_LOOKBACK_HOURS = 24 * 7;

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  lagHours: number;
  lookbackHours: number;
  previewTo: string | null;
  limit: number | null;
  throttleMs: number;
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
    dryRun: false,
    yes: false,
    help: false,
    lagHours: DEFAULT_LAG_HOURS,
    lookbackHours: DEFAULT_LOOKBACK_HOURS,
    limit: DEFAULT_LIMIT,
    throttleMs: DEFAULT_THROTTLE_MS,
    previewTo: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--lag-hours') {
      const value = Number(argv[++i] ?? '');
      if (!Number.isFinite(value) || value < 0) {
        console.error(`Error: --lag-hours expects a non-negative number, got "${argv[i]}".`);
        process.exit(1);
      }
      args.lagHours = value;
    } else if (arg === '--lookback-hours') {
      const value = Number(argv[++i] ?? '');
      if (!Number.isFinite(value) || value <= 0) {
        console.error(`Error: --lookback-hours expects a positive number, got "${argv[i]}".`);
        process.exit(1);
      }
      args.lookbackHours = value;
    } else if (arg === '--limit') {
      const value = Number(argv[++i] ?? '');
      if (!Number.isInteger(value) || value < 1) {
        console.error(`Error: --limit expects a positive integer, got "${argv[i]}".`);
        process.exit(1);
      }
      args.limit = value;
    } else if (arg === '--throttle-ms') {
      const value = Number(argv[++i] ?? '');
      if (!Number.isFinite(value) || value < 0) {
        console.error(`Error: --throttle-ms expects a non-negative number, got "${argv[i]}".`);
        process.exit(1);
      }
      args.throttleMs = value;
    } else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-verified-never-paid.mts \\
    [--dry-run | --yes] [--lag-hours N] [--lookback-hours N] \\
    [--preview-to <email>]

Finds users in the verified-never-paid reactivation cohort (public tier,
verified email, no subscription, not founding-eligible, not churned) whose
account is between LAG_HOURS and LOOKBACK_HOURS old, and sends a one-shot
founder-voice nudge pitching the 7-day free trial. Idempotent via
users.verified_never_paid_email_sent_at.

Eligibility mirrors list-public-cohort.mjs's verified-never-paid bucket:
  - users.tier='public'
  - users.email_verified_at IS NOT NULL
  - NOT (founding_eligible=1 AND founding_member_started_at IS NULL)
    — only while the founding lock-in window is open; the carve-out lifts
    automatically once FOUNDING_LOCKIN_DEADLINE_ISO passes
  - NOT subscription_lapsed=1
  - users.stripe_subscription_id IS NULL
  - users.verified_never_paid_email_sent_at IS NULL
  - users.created_at in [now - LOOKBACK, now - LAG] (defaults ${DEFAULT_LOOKBACK_HOURS}h / ${DEFAULT_LAG_HOURS}h)
  - users.marketing_unsubscribed_at IS NULL

Every send carries a signed one-click unsubscribe: a footer link and the
List-Unsubscribe header.

Options:
      --dry-run              Print eligible users, and who was skipped for
                             unsubscribing from marketing; no email, no DB writes.
  -y, --yes                  Send emails and stamp users.
      --lag-hours N          Hours to wait after signup before we'll email
                             (default ${DEFAULT_LAG_HOURS}).
      --lookback-hours N     Oldest signup we'll act on (default ${DEFAULT_LOOKBACK_HOURS}).
      --limit N              Send to at most N users this run, then stop and report the
                             remainder. For draining a backlog in bounded batches.
      --throttle-ms N        Pause N ms between sends, so a large batch does not arrive
                             as one burst.
      --preview-to <email>   Render the email and send ONE copy to <email>.
                             No DB writes.
  -h, --help                 Show this help.

Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL and
ZEROGEX_END_USER_TOKEN_SECRET (to sign the unsubscribe link) from env or
.env.local. Set AUTH_DB_PATH to override the default DB path.`);
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
// timeout is ZERO. So if the site held the write lock at the instant this job
// stamped a member, the stamp failed on the spot with "database is locked (5)"
// AFTER the email had gone out: the member stayed unstamped, the next tick
// emailed them a second time, and the unit failed and mailed the operator an
// alert. Runs with nobody to email never write, which is why they never failed.
// `.timeout` makes the CLI wait for the lock the way the site does (core/db.ts
// sets busy_timeout too). Passed via -cmd so it applies before the SQL and adds
// nothing to the -json output. Same fix as scripts/send-product-update.mts.
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
      typeof stderr === 'string'
        ? stderr
        : stderr?.toString?.() ?? (err as Error).message;
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
// itself. Safe to repeat: the CLI stops at the first failing statement and
// rolls back an open transaction when it exits, so a failed attempt wrote
// nothing.
function execSqlite(dbPath: string, sql: string, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      runSqlite(dbPath, sql);
      return;
    } catch (err) {
      if (attempt >= attempts || !isLockError((err as Error).message)) throw err;
      sleepSync(attempt * 500);
    }
  }
}

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  usage();
  process.exit(0);
}

const exclusiveFlags = [cliArgs.dryRun, cliArgs.yes, !!cliArgs.previewTo].filter(Boolean).length;
if (exclusiveFlags > 1) {
  console.error('Error: --dry-run, --yes, and --preview-to are mutually exclusive.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));

const RESEND_API_KEY = process.env.RESEND_API_KEY || envLocal.RESEND_API_KEY;
// New Basic trials start without a card (core/noCardTrial.ts): the email's
// trial paragraph follows the same switch checkout reads.
const NO_CARD_TRIAL = isNoCardTrialEnabled({
  BILLING_NO_CARD_TRIAL: process.env.BILLING_NO_CARD_TRIAL || envLocal.BILLING_NO_CARD_TRIAL,
});
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || envLocal.RESEND_FROM_EMAIL;
const NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || '';

if ((cliArgs.yes || cliArgs.previewTo) && (!RESEND_API_KEY || !RESEND_FROM_EMAIL)) {
  console.error('Error: RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send emails.');
  process.exit(1);
}

if (RESEND_API_KEY) process.env.RESEND_API_KEY = RESEND_API_KEY;
if (RESEND_FROM_EMAIL) process.env.RESEND_FROM_EMAIL = RESEND_FROM_EMAIL;
if (NEXT_PUBLIC_APP_URL) process.env.NEXT_PUBLIC_APP_URL = NEXT_PUBLIC_APP_URL;
// buildUnsubUrl() (core/unsubToken.ts) signs with this secret, read from
// process.env — surface it from .env.local so cron runs (shell env only) see it.
if (!process.env.ZEROGEX_END_USER_TOKEN_SECRET && envLocal.ZEROGEX_END_USER_TOKEN_SECRET) {
  process.env.ZEROGEX_END_USER_TOKEN_SECRET = envLocal.ZEROGEX_END_USER_TOKEN_SECRET;
}

// The unsubscribe link must be signable before we send anything, or every
// recipient's send would fail on it. Fail fast.
if ((cliArgs.yes || cliArgs.previewTo) && !process.env.ZEROGEX_END_USER_TOKEN_SECRET) {
  console.error('Error: ZEROGEX_END_USER_TOKEN_SECRET must be set to sign the unsubscribe link.');
  process.exit(1);
}

// Same fallback as core/mailer.ts getAppUrl(), so the unsubscribe link names
// the same host as every other link in the email.
const appUrl = NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

if (cliArgs.previewTo) {
  console.log(`Sending preview to ${cliArgs.previewTo}...`);
  // Signed for a placeholder account, as scripts/send-winback.mts previews: the
  // link works end to end, and no user has this id.
  await sendVerifiedNeverPaidEmail(cliArgs.previewTo, {
    unsubUrl: buildUnsubUrl(appUrl, 'preview-user'),
    noCardTrial: NO_CARD_TRIAL,
  });
  console.log(
    'Preview sent. Its unsubscribe link is signed for a "preview-user" account that does not exist, so clicking it shows the confirmation page and changes nothing.',
  );
  process.exit(0);
}

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

ensureSqlite3Cli();

const nowMs = Date.now();
const highIso = new Date(nowMs - cliArgs.lagHours * 3600_000).toISOString();
const lowIso = new Date(nowMs - cliArgs.lookbackHours * 3600_000).toISOString();

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  marketing_unsubscribed_at: string | null;
};

// Classification matches list-public-cohort.mjs's classify(): a user is in
// the verified-never-paid bucket iff they're NOT unverified, NOT
// founding-eligible-not-redeemed, and NOT churned. Encoded here as SQL so
// the whole segmentation runs against SQLite instead of pulling every
// public user across the boundary.
//
// The founding-eligible carve-out is gated on the founding lock-in window:
// while it's open, send-founding-final-call owns those users; once the
// deadline passes it lifts (see the header note) so they flow here instead
// of being stranded. Empty string when lifted keeps the SQL valid.
const foundingOpen = isFoundingLockinOpen();
const foundingCarveOut = foundingOpen
  ? 'AND NOT (COALESCE(founding_eligible, 0) = 1 AND founding_member_started_at IS NULL)'
  : '';
const candidates = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, created_at, marketing_unsubscribed_at
   FROM users
   WHERE tier = 'public'
     AND email_verified_at IS NOT NULL
     ${foundingCarveOut}
     AND COALESCE(subscription_lapsed, 0) != 1
     AND stripe_subscription_id IS NULL
     AND verified_never_paid_email_sent_at IS NULL
     AND deleted_at IS NULL
     AND created_at >= '${escapeSqlLiteral(lowIso)}'
     AND created_at <= '${escapeSqlLiteral(highIso)}'
   ORDER BY created_at ASC;`,
);

// Held out in code rather than in the WHERE clause so the run can say how many
// it skipped, and who. Done before --limit cuts the batch below: an opted-out
// signup is never stamped, so if it counted toward the cap it would take a
// slot on every run.
const unsubscribed = candidates.filter((u) => u.marketing_unsubscribed_at != null);
const eligible = candidates.filter((u) => u.marketing_unsubscribed_at == null);

console.log(`Auth DB:          ${dbPath}`);
console.log(`Signup window:    ${lowIso}  →  ${highIso}`);
console.log(
  `Founding carve-out: ${
    foundingOpen
      ? 'ACTIVE (founding-eligible-never-redeemed still owned by send-founding-final-call)'
      : 'LIFTED (deadline passed; founding-eligible-never-redeemed now eligible here)'
  }`,
);
console.log(`Unsubscribed:     ${unsubscribed.length} (opted out of marketing email; skipped)`);
if (cliArgs.dryRun) {
  for (const u of unsubscribed) {
    console.log(`  - ${u.email}: signed up ${u.created_at}, unsubscribed ${u.marketing_unsubscribed_at}`);
  }
}
console.log(`Eligible users:   ${eligible.length}`);

if (eligible.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

const batch = cliArgs.limit ? eligible.slice(0, cliArgs.limit) : eligible;
if (batch.length < eligible.length) {
  console.log(
    `This batch:       ${batch.length} (--limit); ${eligible.length - batch.length} left for the next run`,
  );
}
if (cliArgs.throttleMs > 0) {
  console.log(`Throttle:         ${cliArgs.throttleMs}ms between sends`);
}

const sample = batch.slice(0, 10);
for (const u of sample) {
  console.log(`  - ${u.email}: signed up ${u.created_at}`);
}
if (batch.length > sample.length) {
  console.log(`  ... and ${batch.length - sample.length} more`);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No emails sent, no audit rows written.');
  process.exit(0);
}

if (!cliArgs.yes) {
  console.log(
    '\nRefusing to send without --yes. Re-run with --yes to deliver, or --dry-run to preview.',
  );
  process.exit(1);
}

let successCount = 0;
let failCount = 0;
// Delivered, but still not marked as sent after waiting out the lock and
// retrying. Unmarked means the next tick emails them again, so they are named
// at the end with the command that marks them by hand.
const unrecorded: Array<{ id: string; email: string; sentAt: string }> = [];

let sentInRun = 0;
for (const user of batch) {
  // Space the sends out. Deliberately BEFORE the send rather than after, and
  // skipped for the first, so the pause always separates two emails instead of
  // trailing uselessly after the last one.
  if (cliArgs.throttleMs > 0 && sentInRun > 0) {
    await new Promise((resolve) => setTimeout(resolve, cliArgs.throttleMs));
  }
  sentInRun += 1;
  try {
    await sendVerifiedNeverPaidEmail(user.email, { unsubUrl: buildUnsubUrl(appUrl, user.id), noCardTrial: NO_CARD_TRIAL });
  } catch (err) {
    // Not delivered: nothing to record, and the next tick tries them again.
    failCount++;
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  FAIL ${user.email}: ${message}`);
    continue;
  }

  // Delivered. The latch (users.verified_never_paid_email_sent_at, what keeps
  // the next tick from emailing them again) and the audit row go in one
  // transaction: one lock to wait for instead of two, and never one without
  // the other.
  const nowIso = new Date().toISOString();
  const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
  try {
    execSqlite(
      dbPath,
      `BEGIN IMMEDIATE;
       UPDATE users
       SET verified_never_paid_email_sent_at = '${escapeSqlLiteral(nowIso)}',
           updated_at = '${escapeSqlLiteral(nowIso)}'
       WHERE id = '${escapeSqlLiteral(user.id)}';
       INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         'verified_never_paid_email_sent',
         '${escapeSqlLiteral(user.id)}',
         NULL,
         '${escapeSqlLiteral(user.email)}',
         'cron-script',
         '${escapeSqlLiteral(`Verified-never-paid trial nudge sent; signup=${user.created_at}`)}',
         '${escapeSqlLiteral(nowIso)}'
       );
       COMMIT;`,
    );
    successCount++;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  UNRECORDED ${user.email}: delivered, but not marked as sent: ${message}`);
    unrecorded.push({ id: user.id, email: user.email, sentAt: nowIso });
  }
}

console.log(`\nDone. ${successCount + unrecorded.length} sent, ${failCount} failed.`);
if (batch.length < eligible.length) {
  // Say what is left and how to get it, so a drain does not depend on whoever
  // ran it remembering the invocation.
  console.log(
    `${eligible.length - batch.length} still eligible. Re-run the same command to send the next batch.`,
  );
}
if (unrecorded.length > 0) {
  console.error(
    `\n${unrecorded.length} email(s) were DELIVERED but not marked as sent, so the next run would email them again. Mark them now:`,
  );
  for (const u of unrecorded) {
    console.error(
      `  sqlite3 -cmd ".timeout ${SQLITE_BUSY_TIMEOUT_MS}" '${dbPath}' "UPDATE users SET verified_never_paid_email_sent_at = '${u.sentAt}' WHERE id = '${escapeSqlLiteral(u.id)}' AND verified_never_paid_email_sent_at IS NULL;"`,
    );
  }
}
process.exit(failCount > 0 || unrecorded.length > 0 ? 1 : 0);
