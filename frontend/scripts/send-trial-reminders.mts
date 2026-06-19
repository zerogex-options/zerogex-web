#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-trial-reminders.mts \
//     [--dry-run | --yes] [--window-hours N] [--preview-to <email>]
//
// Finds every user whose free trial converts to a paid charge in roughly the
// next 48 hours and has not yet been nudged, then sends a one-shot reminder
// email so they have time to cancel cleanly if the service isn't a fit.
// Intended to be scheduled (cron or systemd timer) every few hours.
//
// Eligibility:
//   - users.subscription_status = 'trialing'
//   - users.current_period_end falls in the trailing 48h window centred on
//     "48 hours from now", widened by +/- WINDOW_HOURS/2 on each side so a
//     run that lands a few hours late still catches the cohort exactly once.
//   - users.trial_reminder_email_sent_at IS NULL (idempotency latch; the
//     Stripe webhook clears it on every fresh transition into 'trialing').
//
// Side effects on send:
//   - Resend email via core/mailer.ts sendTrialReminderEmail().
//   - Stamps users.trial_reminder_email_sent_at = now.
//   - Writes a `trial_reminder_email_sent` row into audit_events.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import { sendTrialReminderEmail } from '../core/mailer.ts';

// 48h from now is the target; a 6h window on each side absorbs a daily cron
// landing at an arbitrary clock time without ever double- or zero-counting.
const TARGET_HOURS = 48;
const DEFAULT_WINDOW_HOURS = 6;

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  windowHours: number;
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
    // Match Next.js's dotenv loader: strip a matched pair of surrounding
    // quotes so RESEND_FROM_EMAIL="ZeroGEX <hello@zerogex.com>" stays a
    // valid From header instead of arriving at Resend with literal quotes.
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
    windowHours: DEFAULT_WINDOW_HOURS,
    previewTo: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--window-hours') {
      const value = Number(argv[++i] ?? '');
      if (!Number.isFinite(value) || value <= 0) {
        console.error(`Error: --window-hours expects a positive number, got "${argv[i]}".`);
        process.exit(1);
      }
      args.windowHours = value;
    } else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-trial-reminders.mts \\
    [--dry-run | --yes] [--window-hours N] [--preview-to <email>]

Finds users whose 'trialing' subscription ends in ~${TARGET_HOURS}h and sends a
one-time courtesy reminder email so they can cancel cleanly if they don't
want to be charged.

Eligibility:
  - subscription_status='trialing'
  - current_period_end in [now+${TARGET_HOURS}h - W/2, now+${TARGET_HOURS}h + W/2],
    where W is --window-hours (default ${DEFAULT_WINDOW_HOURS}).
  - trial_reminder_email_sent_at IS NULL (latch; cleared on each fresh
    transition into 'trialing' by the Stripe webhook).

Options:
      --dry-run             Print eligible users; no email, no DB writes.
  -y, --yes                 Send emails and stamp users.
      --window-hours N      Override the +/- N/2 hour window (default ${DEFAULT_WINDOW_HOURS}).
      --preview-to <email>  Render the email and send ONE copy to <email>
                            with a sample trial-end date. No DB writes.
  -h, --help                Show this help.

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

// mailer.ts reads these lazily inside getClient()/getFromAddress(), so
// stuffing them into process.env after the static import is correct.
if (RESEND_API_KEY) process.env.RESEND_API_KEY = RESEND_API_KEY;
if (RESEND_FROM_EMAIL) process.env.RESEND_FROM_EMAIL = RESEND_FROM_EMAIL;
if (NEXT_PUBLIC_APP_URL) process.env.NEXT_PUBLIC_APP_URL = NEXT_PUBLIC_APP_URL;

if (cliArgs.previewTo) {
  const sample = new Date(Date.now() + TARGET_HOURS * 3600_000).toISOString();
  console.log(`Sending preview to ${cliArgs.previewTo} (sample trial end ${sample})...`);
  await sendTrialReminderEmail(cliArgs.previewTo, { trialEndIso: sample });
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

// Compute the inclusive [low, high] ISO bounds bracketing now+48h. SQLite
// compares ISO strings lexicographically, which works because Stripe writes
// strict ISO-8601 with the 'Z' suffix into current_period_end.
const nowMs = Date.now();
const halfWindowMs = (cliArgs.windowHours * 3600_000) / 2;
const targetMs = nowMs + TARGET_HOURS * 3600_000;
const lowIso = new Date(targetMs - halfWindowMs).toISOString();
const highIso = new Date(targetMs + halfWindowMs).toISOString();

type UserRow = {
  id: string;
  email: string;
  current_period_end: string;
};

const eligible = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, current_period_end
   FROM users
   WHERE subscription_status = 'trialing'
     AND trial_reminder_email_sent_at IS NULL
     AND current_period_end IS NOT NULL
     AND current_period_end >= '${escapeSqlLiteral(lowIso)}'
     AND current_period_end <= '${escapeSqlLiteral(highIso)}'
   ORDER BY current_period_end ASC;`,
);

console.log(`Auth DB:          ${dbPath}`);
console.log(`Window:           ${lowIso}  →  ${highIso}`);
console.log(`Eligible users:   ${eligible.length}`);

if (eligible.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

const sample = eligible.slice(0, 10);
for (const u of sample) {
  console.log(`  - ${u.email}: trial ends ${u.current_period_end}`);
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
    await sendTrialReminderEmail(user.email, { trialEndIso: user.current_period_end });
    const nowIso = new Date().toISOString();
    // Stamp the latch FIRST so a partial run that crashes after some sends
    // doesn't re-send to anyone who already received. The audit row is
    // best-effort; the latch is the source of truth for idempotency.
    execSqlite(
      dbPath,
      `UPDATE users
       SET trial_reminder_email_sent_at = '${escapeSqlLiteral(nowIso)}',
           updated_at = '${escapeSqlLiteral(nowIso)}'
       WHERE id = '${escapeSqlLiteral(user.id)}';`,
    );

    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    execSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         'trial_reminder_email_sent',
         '${escapeSqlLiteral(user.id)}',
         NULL,
         '${escapeSqlLiteral(user.email)}',
         'cron-script',
         '${escapeSqlLiteral(`Trial-end reminder sent; current_period_end=${user.current_period_end}`)}',
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
