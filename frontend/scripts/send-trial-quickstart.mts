#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-trial-quickstart.mts \
//     [--dry-run | --yes] [--preview-to <email>] [--sleep-ms N]
//
// ONE-TIME bridge send. When the activation-focused trial welcome email
// shipped (sendPaidWelcomeEmail's trial copy: subject "Your ZeroGEX trial is
// active", with a "start here" dashboard walkthrough), users who were ALREADY
// mid-trial had received the OLDER welcome — a plain thank-you note with no
// onboarding. They will never get the new automated welcome, because that only
// fires on the Stripe transition INTO 'trialing', which already happened for
// them. This script closes that gap by sending them the new start-here
// guidance once, as a standalone founder note (sendTrialQuickstartEmail).
//
// It is deliberately non-redundant with the old welcome: no repeat thank-you,
// no full billing/cancel walkthrough — just the onboarding they missed.
//
// Eligibility:
//   - users.subscription_status = 'trialing'  (on a free trial right now)
//   - users.email present
//   - NO prior audit_events row of type 'trial_quickstart_email_sent' for the
//     user. The audit row IS the idempotency latch (no dedicated column, since
//     this is a one-shot), so a re-run never double-sends to anyone already
//     mailed. Safe to re-run if the first pass is interrupted partway.
//
// Side effects on send:
//   - Resend email via core/mailer.ts sendTrialQuickstartEmail().
//   - Writes a `trial_quickstart_email_sent` row into audit_events.
//
// This is a manual one-off — it is NOT wired into cron or any webhook.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import { sendTrialQuickstartEmail } from '../core/mailer.ts';

// Marker written to audit_events on a successful send; also the NOT-EXISTS
// idempotency key in the eligibility query. Keep the two in sync.
const AUDIT_TYPE = 'trial_quickstart_email_sent';

// Gentle default pause between sends so a bulk one-off stays well under
// Resend's rate limit. Override with --sleep-ms (0 disables).
const DEFAULT_SLEEP_MS = 250;

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  previewTo: string | null;
  sleepMs: number;
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
    previewTo: null,
    sleepMs: DEFAULT_SLEEP_MS,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--sleep-ms') {
      const value = Number(argv[++i] ?? '');
      if (!Number.isFinite(value) || value < 0) {
        console.error(`Error: --sleep-ms expects a non-negative number, got "${argv[i]}".`);
        process.exit(1);
      }
      args.sleepMs = value;
    } else if (arg === '--help' || arg === '-h') args.help = true;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-trial-quickstart.mts \\
    [--dry-run | --yes] [--preview-to <email>] [--sleep-ms N]

ONE-TIME bridge send. Emails every user who is on a free trial RIGHT NOW the
new "start here" onboarding guidance they missed (they signed up before the
activation-focused welcome email existed). Non-redundant with the old welcome:
no repeat thank-you, no billing rehash.

Eligibility:
  - subscription_status='trialing'
  - email present
  - no prior '${AUDIT_TYPE}' audit row (idempotency latch; safe to re-run).

Options:
      --dry-run             Print eligible users; no email, no DB writes.
  -y, --yes                 Send emails and write audit rows.
      --preview-to <email>  Render the email and send ONE copy to <email>
                            with a sample trial-end date. No DB reads/writes.
      --sleep-ms N          Pause N ms between sends (default ${DEFAULT_SLEEP_MS}; 0 disables).
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  // Sample a ~5-day-out trial end so the preview shows the dynamic date line.
  const sample = new Date(Date.now() + 5 * 24 * 3600_000).toISOString();
  console.log(`Sending preview to ${cliArgs.previewTo} (sample trial end ${sample})...`);
  await sendTrialQuickstartEmail(cliArgs.previewTo, { trialEndIso: sample });
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

type UserRow = {
  id: string;
  email: string;
  current_period_end: string | null;
};

// Current free-trial cohort that hasn't already received this bridge email.
// The NOT EXISTS against audit_events is the idempotency latch.
const eligible = querySqlite<UserRow>(
  dbPath,
  `SELECT u.id, u.email, u.current_period_end
   FROM users u
   WHERE u.subscription_status = 'trialing'
     AND u.email IS NOT NULL
     AND TRIM(u.email) <> ''
     AND NOT EXISTS (
       SELECT 1 FROM audit_events a
       WHERE a.user_id = u.id
         AND a.type = '${escapeSqlLiteral(AUDIT_TYPE)}'
     )
   ORDER BY u.current_period_end ASC;`,
);

console.log(`Auth DB:          ${dbPath}`);
console.log(`Eligible users:   ${eligible.length}  (subscription_status='trialing', not yet sent)`);

if (eligible.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

const sample = eligible.slice(0, 10);
for (const u of sample) {
  console.log(`  - ${u.email}: trial ends ${u.current_period_end ?? '(unknown)'}`);
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

for (let i = 0; i < eligible.length; i++) {
  const user = eligible[i];
  try {
    await sendTrialQuickstartEmail(user.email, { trialEndIso: user.current_period_end });

    // The audit row is the idempotency latch, so it can only be written AFTER
    // a confirmed send (stamping before would wrongly latch a user who never
    // got the email if the send threw). If the send succeeds but this insert
    // fails, that single user could receive a duplicate on a re-run — we log
    // it loudly so it can be reconciled by hand; it does not abort the batch.
    const nowIso = new Date().toISOString();
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
           'manual-script',
           '${escapeSqlLiteral(`Trial quickstart bridge email sent; current_period_end=${user.current_period_end ?? 'null'}`)}',
           '${escapeSqlLiteral(nowIso)}'
         );`,
      );
    } catch (auditErr) {
      const message = auditErr instanceof Error ? auditErr.message : 'unknown error';
      console.error(
        `  WARN ${user.email}: email SENT but audit write failed (${message}). ` +
          'A re-run may resend to this user — reconcile manually if needed.',
      );
    }

    successCount++;
    console.log(`  sent ${user.email}  (${successCount}/${eligible.length})`);

    if (cliArgs.sleepMs > 0 && i < eligible.length - 1) {
      await sleep(cliArgs.sleepMs);
    }
  } catch (err) {
    failCount++;
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  FAIL ${user.email}: ${message}`);
  }
}

console.log(`\nDone. ${successCount} sent, ${failCount} failed.`);
process.exit(failCount > 0 ? 1 : 0);
