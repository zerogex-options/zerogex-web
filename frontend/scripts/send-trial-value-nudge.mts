#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/send-trial-value-nudge.mts \
//     [--dry-run | --yes] [--window-hours N] [--preview-to <email>]
//
// The mid-trial VALUE nudge: a founder-voice activation email sent ~day 2 of a
// 7-day trial — EARLY, before the day 3–7 cancel wave and well before the ~48h
// billing reminder (scripts/send-trial-reminders.mts). Its job is time-to-value,
// not billing: it steers a new trialer to the two or three reads that make
// ZeroGEX click, and invites a reply if it isn't landing. Analysis of the churn
// showed ~75% of trial losses are people who cancel DURING the trial (card on
// file, charge would have gone through) — an activation problem this touch is
// built to attack, while the 48h reminder arrives too late for most of them.
//
// Eligibility (one email per trial, idempotent):
//   - users.subscription_status = 'trialing'
//   - users.current_period_end in [now + T - W/2, now + T + W/2], where T =
//     ${/* TARGET_HOURS */ 120}h before trial end (~day 2 of a 7-day trial) and
//     W is --window-hours (default 6). The 6h-spaced timer lands each trial in
//     exactly one run.
//   - users.trial_midpoint_email_sent_at IS NULL (latch; the Stripe webhook
//     clears it on every fresh transition into 'trialing').
//   - users.cancel_at_period_end = 0 (never nudge someone who already cancelled).
//   - users.marketing_unsubscribed_at IS NULL (engagement email → honors opt-out).
//   - users.deleted_at IS NULL.
//
// Effects per user:
//   - Resend email via core/mailer.ts sendTrialValueEmail() (with a signed,
//     one-click unsubscribe footer link).
//   - Stamps users.trial_midpoint_email_sent_at = now.
//   - Writes a best-effort audit_events row (type trial_value_nudge_sent).
//
// Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL, and
// ZEROGEX_END_USER_TOKEN_SECRET (to sign the unsubscribe link) from env or
// .env.local. Set AUTH_DB_PATH to override the default DB path.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import { sendTrialValueEmail } from '../core/mailer.ts';
import { buildUnsubUrl } from '../core/unsubToken.ts';

const AUDIT_TYPE = 'trial_value_nudge_sent';
// ~day 2 of a 7-day trial = 120h before trial end. A longer (reactivation)
// trial would be hit later in its life, which is harmless — the copy is about
// getting value, not a countdown.
const TARGET_HOURS = 120;
const DEFAULT_WINDOW_HOURS = 6;

type Args = {
  dryRun: boolean;
  yes: boolean;
  windowHours: number;
  previewTo: string | null;
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
    dryRun: false,
    yes: false,
    windowHours: DEFAULT_WINDOW_HOURS,
    previewTo: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--window-hours') {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) {
        console.error(`Error: --window-hours expects a positive number, got "${argv[i]}".`);
        process.exit(1);
      }
      args.windowHours = n;
    } else if (arg === '--preview-to') args.previewTo = (argv[++i] ?? '').trim() || null;
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
  node --experimental-strip-types --no-warnings scripts/send-trial-value-nudge.mts \\
    [--dry-run | --yes] [--window-hours N] [--preview-to <email>]

Sends the mid-trial value nudge (~day 2 of a 7-day trial) to trialing members,
before the mid-trial cancel wave. One email per trial.

Eligibility:
  - subscription_status='trialing'
  - current_period_end in [now+${TARGET_HOURS}h - W/2, now+${TARGET_HOURS}h + W/2],
    where W is --window-hours (default ${DEFAULT_WINDOW_HOURS}).
  - trial_midpoint_email_sent_at IS NULL (latch; cleared on each fresh
    transition into 'trialing' by the Stripe webhook).
  - cancel_at_period_end = 0, marketing_unsubscribed_at IS NULL, deleted_at IS NULL.

Modes:
      --dry-run             Print eligible users; no email, no DB writes.
  -y, --yes                 Send and stamp the latch.
      --window-hours N      Override the +/- N/2 hour window (default ${DEFAULT_WINDOW_HOURS}).
      --preview-to <email>  Send ONE sample to this address (tokenless unsub
                            placeholder); no DB writes, ignores the window/latch.
  -h, --help                Show this help.

Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL, and
ZEROGEX_END_USER_TOKEN_SECRET from env or .env.local. Set AUTH_DB_PATH to
override the default DB path.`);
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

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
}

const exclusive = [cliArgs.dryRun, cliArgs.yes, !!cliArgs.previewTo].filter(Boolean).length;
if (exclusive > 1) {
  console.error('Error: --dry-run, --yes, and --preview-to are mutually exclusive.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));

const RESEND_API_KEY = process.env.RESEND_API_KEY || envLocal.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || envLocal.RESEND_FROM_EMAIL;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || '';
const appUrl = (NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

// The mailer (statically imported) and unsubToken() both read straight from
// process.env, but a standalone node script doesn't auto-load .env.local — so
// stuff the resolved values in before any send. Mirrors send-trial-reminders.mts
// / send-reactivation.mts; without this the timer's real YES=1 send throws
// "Missing required env var: RESEND_API_KEY".
if (RESEND_API_KEY) process.env.RESEND_API_KEY = RESEND_API_KEY;
if (RESEND_FROM_EMAIL) process.env.RESEND_FROM_EMAIL = RESEND_FROM_EMAIL;
if (NEXT_PUBLIC_APP_URL) process.env.NEXT_PUBLIC_APP_URL = NEXT_PUBLIC_APP_URL;
if (!process.env.ZEROGEX_END_USER_TOKEN_SECRET && envLocal.ZEROGEX_END_USER_TOKEN_SECRET) {
  process.env.ZEROGEX_END_USER_TOKEN_SECRET = envLocal.ZEROGEX_END_USER_TOKEN_SECRET;
}

// Sending (real or preview) needs Resend creds.
if ((cliArgs.yes || cliArgs.previewTo) && (!RESEND_API_KEY || !RESEND_FROM_EMAIL)) {
  console.error('Error: RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send emails.');
  process.exit(1);
}
// A real send signs a per-user unsubscribe link (buildUnsubUrl -> unsubToken);
// require the secret for --yes. Preview uses a tokenless placeholder, so it's
// exempt, and a dry-run neither sends nor signs.
if (cliArgs.yes && !process.env.ZEROGEX_END_USER_TOKEN_SECRET) {
  console.error('Error: ZEROGEX_END_USER_TOKEN_SECRET must be set to sign the unsubscribe link.');
  process.exit(1);
}

// --- preview-to: one sample, no DB, tokenless unsub --------------------------
if (cliArgs.previewTo) {
  const sampleTrialEnd = new Date(Date.now() + 5 * 24 * 3600_000).toISOString();
  await sendTrialValueEmail(cliArgs.previewTo, {
    trialEndIso: sampleTrialEnd,
    unsubUrl: `${appUrl}/unsubscribe`,
  });
  console.log(`Preview sent to ${cliArgs.previewTo} (sample trial end ${sampleTrialEnd}).`);
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

const userCols = new Set(
  querySqlite<{ name: string }>(dbPath, `PRAGMA table_info(users);`).map((c) => c.name),
);
const requiredCols = [
  'subscription_status',
  'current_period_end',
  'trial_midpoint_email_sent_at',
  'cancel_at_period_end',
  'marketing_unsubscribed_at',
  'deleted_at',
];
const missing = requiredCols.filter((c) => !userCols.has(c));
if (missing.length > 0) {
  console.error(`Auth DB at ${dbPath} is missing columns: ${missing.join(', ')}.`);
  console.error('Boot the app once so core/db.ts migrations run, then re-run this script.');
  process.exit(1);
}

const nowMs = Date.now();
const targetMs = nowMs + TARGET_HOURS * 3600_000;
const halfWindowMs = (cliArgs.windowHours / 2) * 3600_000;
const lowIso = new Date(targetMs - halfWindowMs).toISOString();
const highIso = new Date(targetMs + halfWindowMs).toISOString();

type UserRow = { id: string; email: string; current_period_end: string };

const eligible = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, current_period_end
   FROM users
   WHERE subscription_status = 'trialing'
     AND trial_midpoint_email_sent_at IS NULL
     AND COALESCE(cancel_at_period_end, 0) = 0
     AND marketing_unsubscribed_at IS NULL
     AND deleted_at IS NULL
     AND current_period_end IS NOT NULL
     AND current_period_end >= '${escapeSqlLiteral(lowIso)}'
     AND current_period_end <= '${escapeSqlLiteral(highIso)}'
   ORDER BY current_period_end ASC;`,
);

console.log(`Auth DB:          ${dbPath}`);
console.log(`Window:           ${lowIso}  →  ${highIso}`);
console.log(`Eligible users:   ${eligible.length}`);
for (const u of eligible.slice(0, 50)) {
  console.log(`  - ${u.email}: trial ends ${u.current_period_end}`);
}
if (eligible.length > 50) console.log(`  ... and ${eligible.length - 50} more`);

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No emails sent, no audit rows written.');
  process.exit(0);
}
if (!cliArgs.yes) {
  console.log('\nRefusing to send without --yes. Re-run with --yes to deliver, or --dry-run to preview.');
  process.exit(1);
}

let successCount = 0;
let failCount = 0;

for (const user of eligible) {
  try {
    await sendTrialValueEmail(user.email, {
      trialEndIso: user.current_period_end,
      unsubUrl: buildUnsubUrl(appUrl, user.id),
    });
    const iso = new Date().toISOString();
    // Stamp the latch FIRST so a crash mid-run never re-sends to anyone already
    // emailed; the audit row is best-effort.
    execSqlite(
      dbPath,
      `UPDATE users
       SET trial_midpoint_email_sent_at = '${escapeSqlLiteral(iso)}',
           updated_at = '${escapeSqlLiteral(iso)}'
       WHERE id = '${escapeSqlLiteral(user.id)}';`,
    );
    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    try {
      execSqlite(
        dbPath,
        `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
         VALUES (
           '${escapeSqlLiteral(auditId)}',
           '${escapeSqlLiteral(AUDIT_TYPE)}',
           '${escapeSqlLiteral(user.id)}',
           NULL,
           '${escapeSqlLiteral(user.email)}',
           'cron',
           '${escapeSqlLiteral(`Sent mid-trial value nudge (trial ends ${user.current_period_end})`)}',
           '${escapeSqlLiteral(iso)}'
         );`,
      );
    } catch {
      /* audit is best-effort; the latch is the source of truth for idempotency */
    }
    successCount += 1;
  } catch (err) {
    failCount += 1;
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  FAIL ${user.email}: ${message}`);
  }
}

console.log(`\nDone. ${successCount} sent, ${failCount} failed.`);
