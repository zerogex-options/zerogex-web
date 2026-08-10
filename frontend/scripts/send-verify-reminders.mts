#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-verify-reminders.mts \
//     [--dry-run | --yes] [--lag-hours N] [--lookback-hours N] [--preview-to <email>]
//
// Finds every user who registered but never confirmed their email — the
// "unverified" cohort in scripts/list-public-cohort.mjs — whose account is at
// least LAG_HOURS old but no older than LOOKBACK_HOURS, mints a FRESH 24h
// single-use verification link, and sends a one-shot founder-voice nudge
// asking them to finish verifying (which is what unlocks checkout + the free
// trial). This is the unverified-cohort counterpart to
// send-verified-never-paid.mts: that script pitches the trial to people who
// already verified; this one gets people TO verify in the first place.
//
// Intended to be scheduled (systemd timer) every 2 hours; the unit
// (zerogex-web-verify-reminders.timer) fires every 2h on the :20 minute so it
// doesn't collide with the hourly auth backup at :00, the trial-reminder timer
// at :15, the verified-never-paid timer at :30, or checkout-recovery at :45.
//
// Eligibility (unverified users can't be churned — churn requires a past
// subscription, which requires verification first — and pitching the founding
// rate to someone who can't reach checkout is pointless, so there is no
// founding/churned carve-out here; verification is the single gate):
//   - users.tier = 'public'
//   - users.email_verified_at IS NULL            (never confirmed)
//   - users.stripe_subscription_id IS NULL       (belt-and-suspenders)
//   - users.verify_reminder_email_sent_at IS NULL (one-shot dedupe)
//   - users.created_at in [now - LOOKBACK_HOURS, now - LAG_HOURS]
//
// Side effects on send (per user, in this order):
//   - INSERT a fresh row into email_verifications (same shape as
//     core/serverAuth.ts issueEmailVerification) so GET /api/auth/verify-email
//     consumes it identically.
//   - Resend email via core/mailer.ts sendVerifyReminderEmail().
//   - Stamps users.verify_reminder_email_sent_at = now (permanent latch).
//   - Writes a `verify_reminder_email_sent` row into audit_events.
//
// Deliberately ONE reminder per account: these addresses never confirmed, so a
// second nag risks bouncing into a cold or mistyped mailbox and hurting the
// sending domain's reputation. The 7-day lookback also keeps us from ever
// nagging a long-dead signup.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import { sendVerifyReminderEmail } from '../core/mailer.ts';

// 2h lag mirrors send-verified-never-paid.mts: give someone a chance to click
// the original signup verification link on their own before we interrupt with
// a second email. 7d lookback bounds the mass-email risk on first deploy (only
// accounts signed up in the last week ever qualify) and is >> the 2h cadence
// so nobody slips through a tick.
const DEFAULT_LAG_HOURS = 2;
const DEFAULT_LOOKBACK_HOURS = 24 * 7;

// Matches AUTH_EMAIL_VERIFICATION_TTL_SECONDS' default in core/serverAuth.ts
// (24h). The freshly-minted token has to outlive the time it takes the user to
// open the email, so we re-derive the same window rather than reuse whatever
// the expired signup token had.
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

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
  node --experimental-strip-types scripts/send-verify-reminders.mts \\
    [--dry-run | --yes] [--lag-hours N] [--lookback-hours N] \\
    [--preview-to <email>]

Finds users who registered but never confirmed their email (public tier,
email_verified_at NULL, no subscription) whose account is between LAG_HOURS
and LOOKBACK_HOURS old, mints a fresh 24h verification link, and sends a
one-shot founder-voice nudge to finish verifying. Idempotent via
users.verify_reminder_email_sent_at.

Eligibility mirrors list-public-cohort.mjs's unverified bucket:
  - users.tier='public'
  - users.email_verified_at IS NULL
  - users.stripe_subscription_id IS NULL
  - users.verify_reminder_email_sent_at IS NULL
  - users.created_at in [now - LOOKBACK, now - LAG] (defaults ${DEFAULT_LOOKBACK_HOURS}h / ${DEFAULT_LAG_HOURS}h)

Options:
      --dry-run              Print eligible users; no email, no DB writes.
  -y, --yes                  Send emails, mint tokens, and stamp users.
      --lag-hours N          Hours to wait after signup before we'll email
                             (default ${DEFAULT_LAG_HOURS}).
      --lookback-hours N     Oldest signup we'll act on (default ${DEFAULT_LOOKBACK_HOURS}).
      --preview-to <email>   Render the email with a sample link and send ONE
                             copy to <email>. No token minted, no DB writes.
  -h, --help                 Show this help.

Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL from env or
.env.local. NEXT_PUBLIC_APP_URL is REQUIRED to send (the verify link must be
absolute and point at production). Set AUTH_DB_PATH to override the DB path.`);
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

// Unlike the pricing-link emails, a verify link that falls back to localhost is
// useless — the whole email is the link. Refuse to send without an absolute
// app URL rather than mail out dead links.
if ((cliArgs.yes || cliArgs.previewTo) && !NEXT_PUBLIC_APP_URL) {
  console.error('Error: NEXT_PUBLIC_APP_URL must be set to send (the verify link must be absolute).');
  process.exit(1);
}

if (RESEND_API_KEY) process.env.RESEND_API_KEY = RESEND_API_KEY;
if (RESEND_FROM_EMAIL) process.env.RESEND_FROM_EMAIL = RESEND_FROM_EMAIL;
if (NEXT_PUBLIC_APP_URL) process.env.NEXT_PUBLIC_APP_URL = NEXT_PUBLIC_APP_URL;

const appUrl = NEXT_PUBLIC_APP_URL.replace(/\/$/, '');

if (cliArgs.previewTo) {
  // Sample (deliberately non-valid) token: preview renders copy + layout
  // without touching the DB. A real send mints a per-user token below.
  const sampleUrl = `${appUrl}/api/auth/verify-email?token=preview-sample-token-not-valid`;
  console.log(`Sending preview to ${cliArgs.previewTo}...`);
  await sendVerifyReminderEmail(cliArgs.previewTo, sampleUrl);
  console.log('Preview sent (sample link is not a working token).');
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

const eligible = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, created_at
   FROM users
   WHERE tier = 'public'
     AND email_verified_at IS NULL
     AND stripe_subscription_id IS NULL
     AND verify_reminder_email_sent_at IS NULL
     AND deleted_at IS NULL
     AND created_at >= '${escapeSqlLiteral(lowIso)}'
     AND created_at <= '${escapeSqlLiteral(highIso)}'
   ORDER BY created_at ASC;`,
);

console.log(`Auth DB:          ${dbPath}`);
console.log(`App URL:          ${appUrl || '(unset)'}`);
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
  console.log('\n[dry-run] No emails sent, no tokens minted, no audit rows written.');
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
    // Mint a fresh 24h single-use verification token, written with the same
    // shape core/serverAuth.ts issueEmailVerification uses (base64url token,
    // sha256 hex at rest) so GET /api/auth/verify-email consumes it. Done
    // BEFORE the send because the token IS the email's payload; if the send
    // then fails, the row is an unused token that self-expires in 24h.
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenId = `emailv_${crypto.randomBytes(12).toString('hex')}`;
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + VERIFY_TTL_MS).toISOString();

    execSqlite(
      dbPath,
      `INSERT INTO email_verifications (id, user_id, token_hash, created_at, expires_at, consumed_at)
       VALUES (
         '${escapeSqlLiteral(tokenId)}',
         '${escapeSqlLiteral(user.id)}',
         '${escapeSqlLiteral(tokenHash)}',
         '${escapeSqlLiteral(nowIso)}',
         '${escapeSqlLiteral(expiresIso)}',
         NULL
       );`,
    );

    const verifyUrl = `${appUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    await sendVerifyReminderEmail(user.email, verifyUrl);

    // Stamp the latch (source of truth for idempotency) before the best-effort
    // audit row, mirroring send-verified-never-paid.mts.
    const stampIso = new Date().toISOString();
    execSqlite(
      dbPath,
      `UPDATE users
       SET verify_reminder_email_sent_at = '${escapeSqlLiteral(stampIso)}',
           updated_at = '${escapeSqlLiteral(stampIso)}'
       WHERE id = '${escapeSqlLiteral(user.id)}';`,
    );

    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    execSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         'verify_reminder_email_sent',
         '${escapeSqlLiteral(user.id)}',
         NULL,
         '${escapeSqlLiteral(user.email)}',
         'cron-script',
         '${escapeSqlLiteral(`Verify-email reminder sent; signup=${user.created_at}`)}',
         '${escapeSqlLiteral(stampIso)}'
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
