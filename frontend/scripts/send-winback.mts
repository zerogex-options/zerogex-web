#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-winback.mts \
//     [--dry-run | --yes] [--lag-days N] [--lookback-days N] [--preview-to <email>] [--preview-promo]
//
// Finds every churned user (subscription actually lapsed, not just clicked
// Cancel) whose subscription ended roughly a month ago, and sends a single
// founder-voice win-back: "here's what you've missed, you're missing out, come
// back at a discount — no pressure." This is the "churned" cohort in
// scripts/list-public-cohort.mjs, and the natural follow-up to the cancellation
// acknowledgement email (core/mailer.ts sendCancellationEmail) fired the moment
// they clicked Cancel — this one lands ~30 days after access actually ended.
//
// Intended to be scheduled (systemd timer) once a day; the unit
// (zerogex-web-winback.timer) fires daily on the :35 minute so it doesn't
// collide with the hourly auth backup at :00, the trial-reminder timer at :15,
// the verify-reminder timer at :20, the verified-never-paid timer at :30, or
// the checkout-recovery timer at :45. A daily cadence is plenty for a cohort
// that only turns over on a ~monthly clock.
//
// Timing anchor: the user's MOST RECENT `stripe_subscription_deleted` audit
// event (written by app/api/webhooks/stripe/route.ts clearSubscriptionFromUser
// on every customer.subscription.deleted). We key off MAX(created_at) via a
// HAVING clause — not a per-row WHERE — so a user who churned, came back, and
// churned again is measured from their LATEST departure, and a stale 40-day-old
// event never fires for someone who actually left 3 days ago.
//
// Eligibility:
//   - users.subscription_lapsed = 1              (currently churned)
//   - users.stripe_subscription_id IS NULL       (belt-and-suspenders for churn)
//   - users.email_verified_at IS NOT NULL        (proved ownership; won't bounce)
//   - users.tier != 'admin'                       (never win-back an operator)
//   - users.winback_email_sent_at IS NULL         (one-shot dedupe; the webhook
//     clears this on re-subscribe so a future re-churn re-qualifies)
//   - a stripe_subscription_deleted audit event exists AND its MAX(created_at)
//     falls in [now - LOOKBACK_DAYS, now - LAG_DAYS] (defaults 60d / 30d).
//     LAG_DAYS is the "wait about a month" floor; LOOKBACK_DAYS is the ceiling
//     that stops a first deploy from mass-emailing every ancient churn — only
//     departures in the last two months ever qualify.
//
// Side effects on send:
//   - Resend email via core/mailer.ts sendWinbackEmail(). When the public
//     limited-time promo (PROMO_END_AT) is live the email uses the promo-
//     deadline variant (auto-applied discount at /pricing); otherwise it makes
//     the evergreen "reply 'discount' for 25% off your first year" offer.
//   - Stamps users.winback_email_sent_at = now (dedupe latch).
//   - Writes a `winback_email_sent` row into audit_events.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import { sendWinbackEmail } from '../core/mailer.ts';

// Public limited-time promo deadline. Resolved at script-load from
// PROMO_END_AT — kept local to this script so it doesn't import the
// Next.js-tied @/core/stripe path (which is server-only). Returns a human
// label like "August 15, 2026" when the promo window is still open, otherwise
// null. ET-bound to match how we describe deadlines elsewhere. Mirrors the
// same helper in scripts/send-checkout-recovery.mts.
function getActivePromoDeadlineLabelLocal(): string | null {
  const endAt = process.env.PROMO_END_AT;
  if (!endAt) return null;
  const endTs = Date.parse(endAt);
  if (!Number.isFinite(endTs) || endTs <= Date.now()) return null;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(endTs));
}

// ~1 month after churn. 30d lag = "give them about a month to settle before we
// reach back out." 60d lookback = a 30-day catch window (>> the daily cadence,
// so nobody slips through a tick) that also bounds the first-deploy blast to
// only the last two months of churn instead of the entire back catalogue.
const DEFAULT_LAG_DAYS = 30;
const DEFAULT_LOOKBACK_DAYS = 60;

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  lagDays: number;
  lookbackDays: number;
  previewTo: string | null;
  previewPromo: boolean;
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
    lagDays: DEFAULT_LAG_DAYS,
    lookbackDays: DEFAULT_LOOKBACK_DAYS,
    previewTo: null,
    previewPromo: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--lag-days') {
      const value = Number(argv[++i] ?? '');
      if (!Number.isFinite(value) || value < 0) {
        console.error(`Error: --lag-days expects a non-negative number, got "${argv[i]}".`);
        process.exit(1);
      }
      args.lagDays = value;
    } else if (arg === '--lookback-days') {
      const value = Number(argv[++i] ?? '');
      if (!Number.isFinite(value) || value <= 0) {
        console.error(`Error: --lookback-days expects a positive number, got "${argv[i]}".`);
        process.exit(1);
      }
      args.lookbackDays = value;
    } else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--preview-promo') args.previewPromo = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-winback.mts \\
    [--dry-run | --yes] [--lag-days N] [--lookback-days N] \\
    [--preview-to <email>] [--preview-promo]

Finds churned users (subscription actually lapsed) whose most-recent departure
was roughly a month ago, and sends a one-shot founder-voice win-back with a
link back to /pricing. When the public limited-time promo (PROMO_END_AT) is
live the email uses the promo-deadline copy; otherwise it makes the evergreen
"reply 'discount' for 25% off your first year" offer. Idempotent via
users.winback_email_sent_at (cleared by the Stripe webhook on re-subscribe so a
future re-churn re-qualifies).

Eligibility mirrors list-public-cohort.mjs's churned bucket:
  - users.subscription_lapsed = 1
  - users.stripe_subscription_id IS NULL
  - users.email_verified_at IS NOT NULL
  - users.tier != 'admin'
  - users.winback_email_sent_at IS NULL
  - MAX(stripe_subscription_deleted audit event) in
    [now - LOOKBACK_DAYS, now - LAG_DAYS] (defaults ${DEFAULT_LOOKBACK_DAYS}d / ${DEFAULT_LAG_DAYS}d)

Options:
      --dry-run                Print eligible users; no email, no DB writes.
  -y, --yes                    Send emails and stamp users.
      --lag-days N             Days to wait after churn before we'll email
                               (default ${DEFAULT_LAG_DAYS}).
      --lookback-days N        Oldest churn we'll act on (default ${DEFAULT_LOOKBACK_DAYS}).
      --preview-to <email>     Render the email and send ONE copy to <email>.
                               No DB writes. Defaults to the evergreen copy;
                               pass --preview-promo to preview the promo-
                               deadline variant instead (needs PROMO_END_AT).
      --preview-promo          Use the promo-deadline copy when previewing.
  -h, --help                   Show this help.

Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL, PROMO_END_AT from
env or .env.local. Set AUTH_DB_PATH to override the default DB path.`);
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
// PROMO_END_AT is read directly by getActivePromoDeadlineLabelLocal() — pull it
// out of .env.local so cron runs (which only have the shell env) still see it.
if (envLocal.PROMO_END_AT && !process.env.PROMO_END_AT) {
  process.env.PROMO_END_AT = envLocal.PROMO_END_AT;
}

// Public limited-time promo. When live, the email uses the promo-deadline copy
// (auto-applied discount at /pricing) instead of the evergreen reply-for-
// discount offer.
const promoDeadlineLabel = getActivePromoDeadlineLabelLocal();

if (cliArgs.previewTo) {
  const usePromo = cliArgs.previewPromo && !!promoDeadlineLabel;
  if (cliArgs.previewPromo && !promoDeadlineLabel) {
    console.log(
      'Note: --preview-promo ignored (PROMO_END_AT is unset or in the past); previewing evergreen copy.',
    );
  }
  const variantLabel = usePromo ? 'promo-deadline' : 'evergreen';
  console.log(`Sending preview to ${cliArgs.previewTo} (variant: ${variantLabel})...`);
  await sendWinbackEmail(cliArgs.previewTo, {
    promoDeadlineLabel: usePromo ? promoDeadlineLabel : null,
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
const DAY_MS = 86_400_000;
const highIso = new Date(nowMs - cliArgs.lagDays * DAY_MS).toISOString();
const lowIso = new Date(nowMs - cliArgs.lookbackDays * DAY_MS).toISOString();

type UserRow = {
  id: string;
  email: string;
  churned_at: string;
};

// One row per eligible user, keyed off their LATEST churn. The HAVING clause
// (not a per-row WHERE on a.created_at) is deliberate: it measures the window
// against MAX(created_at) so a user with multiple past departures is judged by
// their most recent one, and the loose JOIN can't let a stale old event fire
// for someone who actually left days ago. users.winback_email_sent_at is the
// idempotency key, so the JOIN itself needs no per-row latch.
const eligible = querySqlite<UserRow>(
  dbPath,
  `SELECT u.id,
          u.email,
          MAX(a.created_at) AS churned_at
   FROM users AS u
   JOIN audit_events AS a
     ON a.user_id = u.id
    AND a.type = 'stripe_subscription_deleted'
   WHERE COALESCE(u.subscription_lapsed, 0) = 1
     AND u.stripe_subscription_id IS NULL
     AND u.email_verified_at IS NOT NULL
     AND u.tier != 'admin'
     AND u.winback_email_sent_at IS NULL
   GROUP BY u.id, u.email
   HAVING MAX(a.created_at) >= '${escapeSqlLiteral(lowIso)}'
      AND MAX(a.created_at) <= '${escapeSqlLiteral(highIso)}'
   ORDER BY churned_at ASC;`,
);

console.log(`Auth DB:          ${dbPath}`);
console.log(`Churn window:     ${lowIso}  →  ${highIso}`);
console.log(`Promo offer:      ${promoDeadlineLabel ? `open until ${promoDeadlineLabel}` : 'closed (evergreen reply-for-discount copy)'}`);
console.log(`Eligible users:   ${eligible.length}`);

if (eligible.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

const sample = eligible.slice(0, 10);
for (const u of sample) {
  console.log(`  - ${u.email}: churned ${u.churned_at}`);
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
    await sendWinbackEmail(user.email, { promoDeadlineLabel });
    const nowIso = new Date().toISOString();
    // Stamp the latch FIRST so a partial run that crashes after some sends
    // doesn't re-send to anyone who already received. Audit row is best-effort;
    // the column on `users` is the source of truth for idempotency.
    execSqlite(
      dbPath,
      `UPDATE users
       SET winback_email_sent_at = '${escapeSqlLiteral(nowIso)}',
           updated_at = '${escapeSqlLiteral(nowIso)}'
       WHERE id = '${escapeSqlLiteral(user.id)}';`,
    );

    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    const variant = promoDeadlineLabel ? 'promo' : 'evergreen';
    execSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         'winback_email_sent',
         '${escapeSqlLiteral(user.id)}',
         NULL,
         '${escapeSqlLiteral(user.email)}',
         'cron-script',
         '${escapeSqlLiteral(`Win-back email sent; variant=${variant} churned=${user.churned_at}`)}',
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
