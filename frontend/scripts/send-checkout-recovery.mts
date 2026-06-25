#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-checkout-recovery.mts \
//     [--dry-run | --yes] [--lag-hours N] [--lookback-hours N] [--preview-to <email>] [--preview-founding]
//
// Finds every user who initiated a Stripe Checkout session (logged as a
// `billing_checkout_started` audit event by app/api/billing/checkout/route.ts)
// in the past LOOKBACK_HOURS but hasn't ended up with a stripe_subscription_id,
// then sends a single recovery nudge so they can finish.
//
// Intended to be scheduled (cron or systemd timer) every few hours; the
// systemd unit (zerogex-web-checkout-recovery.timer) fires every 6h on the :45
// minute so it doesn't collide with the hourly auth backup at :00 or the
// trial-reminder timer at :15.
//
// Eligibility:
//   - audit_events row with type='billing_checkout_started' whose created_at
//     falls in [now - LOOKBACK_HOURS, now - LAG_HOURS]. The LAG_HOURS lower
//     gap gives a user who's still actively in checkout time to finish on
//     their own without us emailing them in parallel. The LOOKBACK_HOURS
//     upper bound prevents back-emailing every long-ago abandoned session
//     when this cron first deploys.
//   - users.stripe_subscription_id IS NULL (they haven't completed).
//   - users.checkout_recovery_email_sent_at IS NULL (one-shot dedupe).
//   - users.email_verified_at IS NOT NULL (don't email addresses that
//     never proved ownership — bounce rate hurts the domain).
//   - users.tier != 'admin'.
//
// Side effects on send:
//   - Resend email via core/mailer.ts sendCheckoutRecoveryEmail().
//   - Stamps users.checkout_recovery_email_sent_at = now (permanent latch).
//   - Writes a `checkout_recovery_email_sent` row into audit_events.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import { sendCheckoutRecoveryEmail } from '../core/mailer.ts';
import {
  FOUNDING_LOCKIN_DEADLINE_ISO,
  FOUNDING_LOCKIN_DEADLINE_LABEL,
} from '../core/foundingLockin.ts';

// 24h lag: the user just bailed; give them time to come back on their own.
// 7d lookback: enough to cover a multi-day timer outage without flooding old
// sessions, and >> the 6h cron cadence so nobody slips through a tick.
const DEFAULT_LAG_HOURS = 24;
const DEFAULT_LOOKBACK_HOURS = 24 * 7;

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  lagHours: number;
  lookbackHours: number;
  previewTo: string | null;
  previewFounding: boolean;
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
    previewFounding: false,
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
    else if (arg === '--preview-founding') args.previewFounding = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-checkout-recovery.mts \\
    [--dry-run | --yes] [--lag-hours N] [--lookback-hours N] \\
    [--preview-to <email>] [--preview-founding]

Finds users who started a Stripe Checkout session but never landed a
subscription, and sends a one-shot recovery nudge with a link back to
/pricing. Founding-eligible users (while the lock-in deadline is still
in the future) get founding-deadline copy; everyone else gets a generic
"pick up where you left off" nudge.

Eligibility:
  - audit_events.type='billing_checkout_started'
  - created_at in [now - LOOKBACK, now - LAG] (defaults ${DEFAULT_LOOKBACK_HOURS}h / ${DEFAULT_LAG_HOURS}h)
  - users.stripe_subscription_id IS NULL
  - users.checkout_recovery_email_sent_at IS NULL
  - users.email_verified_at IS NOT NULL
  - users.tier != 'admin'

Options:
      --dry-run                Print eligible users; no email, no DB writes.
  -y, --yes                    Send emails and stamp users.
      --lag-hours N            Hours to wait after the start event before
                               we'll email (default ${DEFAULT_LAG_HOURS}).
      --lookback-hours N       Oldest start event we'll act on (default ${DEFAULT_LOOKBACK_HOURS}).
      --preview-to <email>     Render the email and send ONE copy to <email>.
                               No DB writes. Defaults to the generic copy;
                               pass --preview-founding to preview the
                               founding-deadline variant instead.
      --preview-founding       Use the founding-deadline copy when previewing.
  -h, --help                   Show this help.

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

// Founding deadline is a hard cutoff: after it passes we never use the
// founding-deadline copy regardless of the user's founding_eligible flag,
// because the offer they'd be invited back to no longer exists.
const foundingDeadlineMs = Date.parse(FOUNDING_LOCKIN_DEADLINE_ISO);
const foundingStillOpen =
  Number.isFinite(foundingDeadlineMs) && foundingDeadlineMs > Date.now();

if (cliArgs.previewTo) {
  const useFounding = cliArgs.previewFounding && foundingStillOpen;
  console.log(
    `Sending preview to ${cliArgs.previewTo} (variant: ${useFounding ? 'founding-deadline' : 'generic'})...`,
  );
  await sendCheckoutRecoveryEmail(cliArgs.previewTo, {
    foundingDeadlineLabel: useFounding ? FOUNDING_LOCKIN_DEADLINE_LABEL : null,
  });
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
  founding_eligible: number;
  last_started_at: string;
};

// One row per eligible user even if they have multiple billing_checkout_started
// events in the window — MAX(created_at) just labels the log line. The audit
// table has no per-row latch; users.checkout_recovery_email_sent_at is the
// idempotency key, so the JOIN can stay loose.
const eligible = querySqlite<UserRow>(
  dbPath,
  `SELECT u.id,
          u.email,
          COALESCE(u.founding_eligible, 0) AS founding_eligible,
          MAX(a.created_at) AS last_started_at
   FROM users AS u
   JOIN audit_events AS a ON a.user_id = u.id
   WHERE a.type = 'billing_checkout_started'
     AND a.created_at >= '${escapeSqlLiteral(lowIso)}'
     AND a.created_at <= '${escapeSqlLiteral(highIso)}'
     AND u.stripe_subscription_id IS NULL
     AND u.checkout_recovery_email_sent_at IS NULL
     AND u.email_verified_at IS NOT NULL
     AND u.tier != 'admin'
   GROUP BY u.id, u.email, u.founding_eligible
   ORDER BY last_started_at ASC;`,
);

console.log(`Auth DB:          ${dbPath}`);
console.log(`Window:           ${lowIso}  →  ${highIso}`);
console.log(`Founding offer:   ${foundingStillOpen ? `open until ${FOUNDING_LOCKIN_DEADLINE_LABEL}` : 'closed'}`);
console.log(`Eligible users:   ${eligible.length}`);

if (eligible.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

const sample = eligible.slice(0, 10);
for (const u of sample) {
  const variant = u.founding_eligible === 1 && foundingStillOpen ? 'founding' : 'generic';
  console.log(`  - ${u.email}: started ${u.last_started_at} (variant: ${variant})`);
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
  const useFounding = user.founding_eligible === 1 && foundingStillOpen;
  try {
    await sendCheckoutRecoveryEmail(user.email, {
      foundingDeadlineLabel: useFounding ? FOUNDING_LOCKIN_DEADLINE_LABEL : null,
    });
    const nowIso = new Date().toISOString();
    // Stamp the latch FIRST so a partial run that crashes after some sends
    // doesn't re-send to anyone who already received. Audit row is best-
    // effort; the column on `users` is the source of truth for idempotency.
    execSqlite(
      dbPath,
      `UPDATE users
       SET checkout_recovery_email_sent_at = '${escapeSqlLiteral(nowIso)}',
           updated_at = '${escapeSqlLiteral(nowIso)}'
       WHERE id = '${escapeSqlLiteral(user.id)}';`,
    );

    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    const variant = useFounding ? 'founding' : 'generic';
    execSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         'checkout_recovery_email_sent',
         '${escapeSqlLiteral(user.id)}',
         NULL,
         '${escapeSqlLiteral(user.email)}',
         'cron-script',
         '${escapeSqlLiteral(`Checkout recovery nudge sent; variant=${variant} last_started=${user.last_started_at}`)}',
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
