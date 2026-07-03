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
//   - NOT founding-eligible-not-redeemed (send-founding-final-call owns them)
//   - NOT churned (subscription_lapsed=1 would want a discount pitch instead)
//   - users.stripe_subscription_id IS NULL (belt-and-suspenders for tier=public)
//   - users.verified_never_paid_email_sent_at IS NULL (one-shot dedupe)
//   - users.created_at in [now - LOOKBACK_HOURS, now - LAG_HOURS]
//
// Side effects on send:
//   - Resend email via core/mailer.ts sendVerifiedNeverPaidEmail().
//   - Stamps users.verified_never_paid_email_sent_at = now (permanent latch).
//   - Writes a `verified_never_paid_email_sent` row into audit_events.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import { sendVerifiedNeverPaidEmail } from '../core/mailer.ts';

// 2h lag matches the user-facing intent: give someone a chance to click
// through the verification link, browse a bit, and either bounce or start
// checkout on their own before we interrupt with a founder email. 7d
// lookback bounds the mass-email risk on first deploy (only accounts
// signed up in the last week ever qualify), and >> the 2h cron cadence
// so nobody slips through a tick.
const DEFAULT_LAG_HOURS = 2;
const DEFAULT_LOOKBACK_HOURS = 24 * 7;

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  lagHours: number;
  lookbackHours: number;
  previewTo: string | null;
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
  - NOT subscription_lapsed=1
  - users.stripe_subscription_id IS NULL
  - users.verified_never_paid_email_sent_at IS NULL
  - users.created_at in [now - LOOKBACK, now - LAG] (defaults ${DEFAULT_LOOKBACK_HOURS}h / ${DEFAULT_LAG_HOURS}h)

Options:
      --dry-run              Print eligible users; no email, no DB writes.
  -y, --yes                  Send emails and stamp users.
      --lag-hours N          Hours to wait after signup before we'll email
                             (default ${DEFAULT_LAG_HOURS}).
      --lookback-hours N     Oldest signup we'll act on (default ${DEFAULT_LOOKBACK_HOURS}).
      --preview-to <email>   Render the email and send ONE copy to <email>.
                             No DB writes.
  -h, --help                 Show this help.

Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL from env or
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

function runSqlite(dbPath: string, sql: string): string {
  try {
    return execFileSync('sqlite3', ['-json', dbPath, sql], {
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

function execSqlite(dbPath: string, sql: string) {
  runSqlite(dbPath, sql);
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

if (cliArgs.previewTo) {
  console.log(`Sending preview to ${cliArgs.previewTo}...`);
  await sendVerifiedNeverPaidEmail(cliArgs.previewTo);
  console.log('Preview sent.');
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
};

// Classification matches list-public-cohort.mjs's classify(): a user is in
// the verified-never-paid bucket iff they're NOT unverified, NOT
// founding-eligible-not-redeemed, and NOT churned. Encoded here as SQL so
// the whole segmentation runs against SQLite instead of pulling every
// public user across the boundary.
const eligible = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, created_at
   FROM users
   WHERE tier = 'public'
     AND email_verified_at IS NOT NULL
     AND NOT (COALESCE(founding_eligible, 0) = 1 AND founding_member_started_at IS NULL)
     AND COALESCE(subscription_lapsed, 0) != 1
     AND stripe_subscription_id IS NULL
     AND verified_never_paid_email_sent_at IS NULL
     AND created_at >= '${escapeSqlLiteral(lowIso)}'
     AND created_at <= '${escapeSqlLiteral(highIso)}'
   ORDER BY created_at ASC;`,
);

console.log(`Auth DB:          ${dbPath}`);
console.log(`Signup window:    ${lowIso}  →  ${highIso}`);
console.log(`Eligible users:   ${eligible.length}`);

if (eligible.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

const sample = eligible.slice(0, 10);
for (const u of sample) {
  console.log(`  - ${u.email}: signed up ${u.created_at}`);
}
if (eligible.length > sample.length) {
  console.log(`  ... and ${eligible.length - sample.length} more`);
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

for (const user of eligible) {
  try {
    await sendVerifiedNeverPaidEmail(user.email);
    const nowIso = new Date().toISOString();
    // Stamp the latch FIRST so a partial run that crashes after some sends
    // doesn't re-send to anyone who already received. Audit row is best-
    // effort; the column on `users` is the source of truth for idempotency.
    execSqlite(
      dbPath,
      `UPDATE users
       SET verified_never_paid_email_sent_at = '${escapeSqlLiteral(nowIso)}',
           updated_at = '${escapeSqlLiteral(nowIso)}'
       WHERE id = '${escapeSqlLiteral(user.id)}';`,
    );

    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    execSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         'verified_never_paid_email_sent',
         '${escapeSqlLiteral(user.id)}',
         NULL,
         '${escapeSqlLiteral(user.email)}',
         'cron-script',
         '${escapeSqlLiteral(`Verified-never-paid trial nudge sent; signup=${user.created_at}`)}',
         '${escapeSqlLiteral(nowIso)}'
       );`,
    );
    successCount++;
  } catch (err) {
    failCount++;
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  FAIL ${user.email}: ${message}`);
  }
}

console.log(`\nDone. ${successCount} sent, ${failCount} failed.`);
process.exit(failCount > 0 ? 1 : 0);
