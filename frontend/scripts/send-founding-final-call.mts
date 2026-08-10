#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-founding-final-call.mts \
//     [--dry-run | --yes] [--preview-to <email>]
//
// One-shot final-call blast to every founding-eligible user who has not yet
// redeemed the founding rate. Designed to fire ONCE, ~24-36h before
// FOUNDING_LOCKIN_DEADLINE_ISO crosses — after that the modal stops showing,
// the /founding page 404s, and the checkout API rejects the founding code,
// so the email would just be advertising a thing the user can no longer
// activate.
//
// Eligibility (all must be true):
//   - users.founding_eligible = 1                  (on the launch cohort)
//   - users.founding_member_started_at IS NULL     (hasn't redeemed yet)
//   - users.stripe_subscription_id IS NULL         (no active sub on any plan)
//   - users.email_verified_at IS NOT NULL          (don't burn the domain)
//   - users.tier != 'admin'                         (admin accounts can't sub)
//   - users.founding_final_call_email_sent_at IS NULL  (one-shot dedupe)
//
// Hard refusal: if FOUNDING_LOCKIN_DEADLINE_ISO is already in the past, the
// script exits without sending — the offer it would advertise no longer
// exists, and pointing people at /founding would land them on a 404.
//
// Side effects on send:
//   - Resend email via core/mailer.ts sendFoundingFinalCallEmail().
//   - Stamps users.founding_final_call_email_sent_at = now (permanent latch).
//   - Writes a `founding_final_call_email_sent` row into audit_events.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';
import { sendFoundingFinalCallEmail } from '../core/mailer.ts';
import { resolveFoundingDisplayPricing, type FoundingDisplayPricing } from '../core/offerPricing.ts';
import {
  FOUNDING_BILLING_START_LABEL,
  FOUNDING_LOCKIN_DEADLINE_ISO,
  FOUNDING_LOCKIN_DEADLINE_LABEL,
  isFoundingLockinOpen,
} from '../core/foundingLockin.ts';

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
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
  const args: Args = { dryRun: false, yes: false, help: false, previewTo: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-founding-final-call.mts \\
    [--dry-run | --yes] [--preview-to <email>]

Sends one final urgency email to every founding-eligible user who hasn't
yet activated their founding rate, in the final hours before
FOUNDING_LOCKIN_DEADLINE_ISO. Idempotent per-user via
users.founding_final_call_email_sent_at.

Options:
      --dry-run             Print eligible users; no email, no DB writes.
  -y, --yes                 Send emails and stamp the latch column.
      --preview-to <email>  Render the email and send ONE copy to <email>.
                            No DB writes; ignores all eligibility filters.
  -h, --help                Show this help.

Refuses to send (with exit 0) when the founding deadline has already
passed — the email points at /founding, which 404s after the cutoff.

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

// Hydrate .env.local into process.env (without overriding the live shell env)
// so core modules that read process.env directly — e.g. core/offerPricing.ts's
// STRIPE_PRICE_*/STRIPE_COUPON_* lookups — see the app config under systemd,
// where only HOME/PATH are set. Mirrors how Next.js loads .env.local server-side.
for (const [key, value] of Object.entries(envLocal)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

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

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const foundingHref = `${appUrl}/founding`;

if (!isFoundingLockinOpen()) {
  console.log(
    `Founding deadline (${FOUNDING_LOCKIN_DEADLINE_LABEL}) has already passed. ` +
      'Refusing to send — the email points at /founding, which now 404s.',
  );
  process.exit(0);
}

// Optional Stripe client — used only to resolve the live founding prices the
// email quotes (first-year intro rate, the standard rate it's discounted from,
// and the lifetime %). Best-effort: without STRIPE_SECRET_KEY, or on a Stripe
// error, foundingPricing stays null and the offer copy falls back to price-free
// wording, so the email still sends. Prices are the same for everyone, so
// resolve once up front rather than per user.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || envLocal.STRIPE_SECRET_KEY;
const stripe: Stripe | null = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

let foundingPricing: FoundingDisplayPricing | null = null;
if (stripe) {
  try {
    foundingPricing = await resolveFoundingDisplayPricing(stripe);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.warn(
      `Warning: could not resolve live founding pricing (${message}); emails will use price-free copy.`,
    );
  }
}

if (cliArgs.previewTo) {
  console.log(`Sending preview to ${cliArgs.previewTo}...`);
  await sendFoundingFinalCallEmail(cliArgs.previewTo, {
    deadlineLabel: FOUNDING_LOCKIN_DEADLINE_LABEL,
    foundingHref,
    billingStartLabel: FOUNDING_BILLING_START_LABEL,
    pricing: foundingPricing,
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

type UserRow = {
  id: string;
  email: string;
};

// Founding-eligible non-redeemers, verified, no active sub, never previously
// emailed by this script. Sorted by created_at so the run order is stable
// and a partial-failure rerun resumes from a predictable point.
const eligible = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email
   FROM users
   WHERE founding_eligible = 1
     AND founding_member_started_at IS NULL
     AND stripe_subscription_id IS NULL
     AND email_verified_at IS NOT NULL
     AND tier != 'admin'
     AND founding_final_call_email_sent_at IS NULL
   ORDER BY created_at ASC;`,
);

console.log(`Auth DB:                ${dbPath}`);
console.log(`Founding deadline:      ${FOUNDING_LOCKIN_DEADLINE_LABEL}`);
console.log(`Founding URL:           ${foundingHref}`);
console.log(`Eligible recipients:    ${eligible.length}`);

if (eligible.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

const sample = eligible.slice(0, 10);
for (const u of sample) {
  console.log(`  - ${u.email}`);
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

// Resend's per-second limit on the Pro tier is 10 req/sec. Pace below the
// ceiling so we don't trip 429s on borderline iterations — 120ms ≈ 8.3
// req/sec leaves a margin without materially slowing a 282-user blast (an
// extra ~34s wall-clock for the full cohort). Sleep AFTER each iteration,
// not before — that way the first send isn't delayed, and a 429 doesn't
// immediately retry the next call inside the same rolling-second window.
const SEND_INTERVAL_MS = 120;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let successCount = 0;
let failCount = 0;

for (let i = 0; i < eligible.length; i++) {
  const user = eligible[i];
  try {
    await sendFoundingFinalCallEmail(user.email, {
      deadlineLabel: FOUNDING_LOCKIN_DEADLINE_LABEL,
      foundingHref,
      billingStartLabel: FOUNDING_BILLING_START_LABEL,
      pricing: foundingPricing,
    });
    const nowIso = new Date().toISOString();
    // Stamp the latch FIRST so a partial run that crashes after some sends
    // doesn't re-send to anyone who already received. Audit row is best-
    // effort; the column on `users` is the source of truth for idempotency.
    execSqlite(
      dbPath,
      `UPDATE users
       SET founding_final_call_email_sent_at = '${escapeSqlLiteral(nowIso)}',
           updated_at = '${escapeSqlLiteral(nowIso)}'
       WHERE id = '${escapeSqlLiteral(user.id)}';`,
    );

    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    execSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         'founding_final_call_email_sent',
         '${escapeSqlLiteral(user.id)}',
         NULL,
         '${escapeSqlLiteral(user.email)}',
         'cron-script',
         '${escapeSqlLiteral(`Founding final-call sent; deadline=${FOUNDING_LOCKIN_DEADLINE_ISO}`)}',
         '${escapeSqlLiteral(nowIso)}'
       );`,
    );
    successCount++;
  } catch (err) {
    failCount++;
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  FAIL ${user.email}: ${message}`);
  }
  // Throttle every iteration except the last (no point sleeping before exit).
  if (i < eligible.length - 1) {
    await sleep(SEND_INTERVAL_MS);
  }
}

console.log(`\nDone. ${successCount} sent, ${failCount} failed.`);
process.exit(failCount > 0 ? 1 : 0);
