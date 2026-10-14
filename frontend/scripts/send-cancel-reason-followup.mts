#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-cancel-reason-followup.mts \
//     [--dry-run | --yes | --preview-to <email>] [--days N] [--limit N]
//
// One-off follow-up to members who canceled in the last --days (default 7) and
// gave "Too expensive" or "Too complex / hard to use" as the reason, answering
// it the way the in-app cancel modal now does:
//
//   too_expensive, still has access → one-click 50% off 12 months, plan kept
//                                     (app/save?o=price, signed per member)
//   too_expensive, already ended    → 50% off coming back (/pricing?winback=1)
//   too_complex                     → My Dashboard + the Education hub
//
// core/cancelReasonFollowup.ts owns who qualifies; --dry-run says why everyone
// else was skipped. The reason is read from the member's most recent
// stripe_cancellation_requested audit row (the webhook folds the cancel survey
// into it as cancel_feedback=...).
//
// Side effects on send:
//   - Resend email via core/mailer.ts sendCancelReasonFollowupEmail().
//   - A `cancel_reason_followup_sent` audit row, which is also the dedupe: a
//     member who has one is never sent another, so a re-run is safe.
//   - For an ended "too expensive" member, stamps users.winback_email_sent_at
//     (if unset). Checkout only attaches the win-back coupon to a lapsed
//     account with that stamp, so without it the link would charge full price.
//     It also means the ~30-day win-back email (make winback) skips them: they
//     have had its offer.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import {
  buildCancelReasonFollowupEmail,
  sendCancelReasonFollowupEmail,
  type CancelReasonFollowupOptions,
} from '../core/mailer.ts';
import {
  decideCancelReasonFollowup,
  type FollowupReason,
  type FollowupSkip,
  type FollowupState,
} from '../core/cancelReasonFollowup.ts';
import { parseCancellationReasonFromMessage } from '../core/cancellationReason.ts';
import { buildSaveUrl } from '../core/retentionToken.ts';
import { buildUnsubUrl } from '../core/unsubToken.ts';

const AUDIT_TYPE = 'cancel_reason_followup_sent';

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  previewTo: string | null;
  days: number;
  limit: number | null;
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

function positiveNumber(raw: string | undefined, flag: string): number {
  const value = Number(raw ?? '');
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`Error: ${flag} expects a positive number, got "${raw}".`);
    process.exit(1);
  }
  return value;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, yes: false, help: false, previewTo: null, days: 7, limit: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--days') args.days = positiveNumber(argv[++i], '--days');
    else if (arg === '--limit') args.limit = positiveNumber(argv[++i], '--limit');
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-cancel-reason-followup.mts \\
    [--dry-run | --yes | --preview-to <email>] [--days N] [--limit N]

Emails members who canceled in the last --days (default 7) with the reason
"Too expensive" (50% off for 12 months) or "Too complex / hard to use" (My
Dashboard + the Education hub). One email per member, ever.

Options:
      --dry-run              List who would get which email, and why everyone
                             else was skipped. No email, no DB writes.
  -y, --yes                  Send, and record each send.
      --preview-to <email>   Send all four versions to <email> (sample links).
                             No DB writes.
      --days N               How far back to look (default 7).
      --limit N              Cap the number of sends this run.
  -h, --help                 Show this help.

Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL and
ZEROGEX_END_USER_TOKEN_SECRET (signs the save and unsubscribe links) from env or
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
      typeof stderr === 'string' ? stderr : stderr?.toString?.() ?? (err as Error).message;
    throw new Error(message.trim() || (err as Error).message);
  }
}

function querySqlite<T = Record<string, unknown>>(dbPath: string, sql: string): T[] {
  const output = runSqlite(dbPath, sql).trim();
  if (!output) return [];
  return JSON.parse(output) as T[];
}

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  usage();
  process.exit(0);
}

if ([cliArgs.dryRun, cliArgs.yes, !!cliArgs.previewTo].filter(Boolean).length > 1) {
  console.error('Error: --dry-run, --yes, and --preview-to are mutually exclusive.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));

const RESEND_API_KEY = process.env.RESEND_API_KEY || envLocal.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || envLocal.RESEND_FROM_EMAIL;
const NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const sendsAnything = cliArgs.yes || !!cliArgs.previewTo;
if (sendsAnything && (!RESEND_API_KEY || !RESEND_FROM_EMAIL)) {
  console.error('Error: RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send emails.');
  process.exit(1);
}
if (RESEND_API_KEY) process.env.RESEND_API_KEY = RESEND_API_KEY;
if (RESEND_FROM_EMAIL) process.env.RESEND_FROM_EMAIL = RESEND_FROM_EMAIL;
process.env.NEXT_PUBLIC_APP_URL = NEXT_PUBLIC_APP_URL;

if (!process.env.ZEROGEX_END_USER_TOKEN_SECRET && envLocal.ZEROGEX_END_USER_TOKEN_SECRET) {
  process.env.ZEROGEX_END_USER_TOKEN_SECRET = envLocal.ZEROGEX_END_USER_TOKEN_SECRET;
}
if (!process.env.ZEROGEX_END_USER_TOKEN_SECRET) {
  console.error('Error: ZEROGEX_END_USER_TOKEN_SECRET must be set to sign the save and unsubscribe links.');
  process.exit(1);
}

const winbackUrl = `${NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/pricing?winback=1`;

if (cliArgs.previewTo) {
  const versions: Array<[FollowupReason, FollowupState]> = [
    ['too_expensive', 'pending'],
    ['too_expensive', 'lapsed'],
    ['too_complex', 'pending'],
    ['too_complex', 'lapsed'],
  ];
  const sampleEnd = new Date(Date.now() + 5 * 86_400_000).toISOString();
  for (const [reason, state] of versions) {
    const opts: CancelReasonFollowupOptions = {
      reason,
      state,
      periodEndIso: state === 'pending' ? sampleEnd : null,
      offerUrl:
        reason === 'too_expensive'
          ? state === 'pending'
            ? buildSaveUrl(NEXT_PUBLIC_APP_URL, 'preview-user', 'price')
            : winbackUrl
          : null,
      unsubUrl: buildUnsubUrl(NEXT_PUBLIC_APP_URL, 'preview-user'),
    };
    const { subject } = buildCancelReasonFollowupEmail(opts);
    await sendCancelReasonFollowupEmail(cliArgs.previewTo, opts);
    console.log(`Preview sent: [${reason} / ${state === 'pending' ? 'still has access' : 'ended'}] "${subject}"`);
  }
  console.log('Sample links point at a "preview-user" account, so clicking them shows "invalid".');
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

const REQUIRED_COLUMNS = [
  'deleted_at',
  'marketing_unsubscribed_at',
  'email_verified_at',
  'subscription_lapsed',
  'retention_offer_claimed_at',
  'winback_email_sent_at',
  'cancel_at_period_end',
  'current_period_end',
];
{
  const present = new Set(
    querySqlite<{ name: string }>(dbPath, 'PRAGMA table_info(users);').map((c) => c.name),
  );
  const missing = REQUIRED_COLUMNS.filter((c) => !present.has(c));
  if (missing.length > 0) {
    console.error(`Auth DB at ${dbPath} is missing column(s): ${missing.join(', ')}.`);
    console.error('These are added by core/db.ts migrations, which run when the app boots. Run:');
    console.error('  make migrate');
    process.exit(1);
  }
}

const hasMoneyBackTable =
  querySqlite<{ n: number }>(
    dbPath,
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'money_back_refunds';",
  )[0]?.n > 0;

const sinceIso = new Date(Date.now() - cliArgs.days * 86_400_000).toISOString();

type Row = {
  id: string;
  email: string;
  tier: string | null;
  deleted_at: string | null;
  marketing_unsubscribed_at: string | null;
  email_verified_at: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  cancel_at_period_end: number | null;
  current_period_end: string | null;
  subscription_lapsed: number | null;
  retention_offer_claimed_at: string | null;
  winback_email_sent_at: string | null;
  canceled_at: string;
  cancel_message: string | null;
  sent_count: number;
  refund_count: number;
};

// Each member's MOST RECENT cancel request, when it falls inside the window.
const rows = querySqlite<Row>(
  dbPath,
  `SELECT u.id, u.email, u.tier, u.deleted_at, u.marketing_unsubscribed_at, u.email_verified_at,
          u.stripe_subscription_id, u.subscription_status, u.cancel_at_period_end,
          u.current_period_end, u.subscription_lapsed, u.retention_offer_claimed_at,
          u.winback_email_sent_at,
          c.created_at AS canceled_at,
          c.message AS cancel_message,
          (SELECT COUNT(*) FROM audit_events f
            WHERE f.user_id = u.id AND f.type = '${AUDIT_TYPE}') AS sent_count,
          ${
            hasMoneyBackTable
              ? '(SELECT COUNT(*) FROM money_back_refunds m WHERE m.user_id = u.id)'
              : '0'
          } AS refund_count
     FROM users u
     JOIN audit_events c ON c.user_id = u.id AND c.type = 'stripe_cancellation_requested'
    WHERE c.created_at >= '${escapeSqlLiteral(sinceIso)}'
      AND c.created_at = (SELECT MAX(c2.created_at) FROM audit_events c2
                           WHERE c2.user_id = u.id AND c2.type = 'stripe_cancellation_requested')
    ORDER BY c.created_at ASC;`,
);

type Eligible = { row: Row; reason: FollowupReason; state: FollowupState };
const eligible: Eligible[] = [];
const skips = new Map<FollowupSkip, number>();
const skippedReasonMatches: Array<{ email: string; feedback: string; skip: FollowupSkip }> = [];

for (const row of rows) {
  const feedback = parseCancellationReasonFromMessage(row.cancel_message ?? '').feedback;
  const decision = decideCancelReasonFollowup({
    feedback,
    tier: row.tier ?? 'public',
    deleted: !!row.deleted_at,
    marketingUnsubscribed: !!row.marketing_unsubscribed_at,
    alreadySent: Number(row.sent_count) > 0,
    moneyBackRefunded: Number(row.refund_count) > 0,
    hasSubscriptionOnFile: !!row.stripe_subscription_id,
    cancelAtPeriodEnd: Number(row.cancel_at_period_end) === 1,
    subscriptionStatus: row.subscription_status,
    subscriptionLapsed: Number(row.subscription_lapsed) === 1,
    retentionOfferClaimed: !!row.retention_offer_claimed_at,
    emailVerified: !!row.email_verified_at,
  });
  if (decision.send) {
    eligible.push({ row, reason: decision.reason, state: decision.state });
  } else {
    skips.set(decision.skip, (skips.get(decision.skip) ?? 0) + 1);
    if (decision.skip !== 'other_reason' && feedback) {
      skippedReasonMatches.push({ email: row.email, feedback, skip: decision.skip });
    }
  }
}

const selected = cliArgs.limit != null ? eligible.slice(0, cliArgs.limit) : eligible;

console.log(`Auth DB:          ${dbPath}`);
console.log(`Window:           cancels since ${sinceIso} (${cliArgs.days} days)`);
console.log(`Cancels in window: ${rows.length}`);
console.log(`Eligible:         ${eligible.length}${cliArgs.limit != null ? ` (sending ${selected.length})` : ''}`);

if (skips.size > 0) {
  console.log('\nSkipped:');
  for (const [reason, count] of [...skips.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}  ${reason}`);
  }
}
if (skippedReasonMatches.length > 0) {
  console.log('\nGave one of these reasons but skipped:');
  for (const s of skippedReasonMatches) console.log(`  - ${s.email} (${s.feedback}): ${s.skip}`);
}

if (selected.length === 0) {
  console.log('\nNothing to send.');
  process.exit(0);
}

const LABEL: Record<FollowupReason, Record<FollowupState, string>> = {
  too_expensive: { pending: '50% save link (still has access)', lapsed: '50% off to come back (ended)' },
  too_complex: { pending: 'dashboard + education (still has access)', lapsed: 'dashboard + education (ended)' },
};

console.log('\nWill email:');
for (const e of selected) {
  console.log(`  - ${e.row.email}: canceled ${e.row.canceled_at.slice(0, 10)}, ${e.reason} → ${LABEL[e.reason][e.state]}`);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No emails sent, no DB writes.');
  process.exit(0);
}
if (!cliArgs.yes) {
  console.log('\nRefusing to send without --yes. Re-run with --yes to deliver, or --dry-run to preview.');
  process.exit(1);
}

function optsFor(e: Eligible): CancelReasonFollowupOptions {
  return {
    reason: e.reason,
    state: e.state,
    periodEndIso: e.state === 'pending' ? e.row.current_period_end : null,
    offerUrl:
      e.reason === 'too_expensive'
        ? e.state === 'pending'
          ? buildSaveUrl(NEXT_PUBLIC_APP_URL, e.row.id, 'price')
          : winbackUrl
        : null,
    unsubUrl: buildUnsubUrl(NEXT_PUBLIC_APP_URL, e.row.id),
  };
}

let successCount = 0;
let failCount = 0;

for (const e of selected) {
  const nowIso = new Date().toISOString();
  try {
    await sendCancelReasonFollowupEmail(e.row.email, optsFor(e));
    // Arm the win-back coupon the email just offered. After the send, so a
    // failed send doesn't also cost the member their ~30-day win-back email.
    if (e.reason === 'too_expensive' && e.state === 'lapsed' && !e.row.winback_email_sent_at) {
      runSqlite(
        dbPath,
        `UPDATE users SET winback_email_sent_at = '${escapeSqlLiteral(nowIso)}', updated_at = '${escapeSqlLiteral(nowIso)}'
          WHERE id = '${escapeSqlLiteral(e.row.id)}' AND winback_email_sent_at IS NULL;`,
      );
    }
    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    runSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         '${AUDIT_TYPE}',
         '${escapeSqlLiteral(e.row.id)}',
         NULL,
         '${escapeSqlLiteral(e.row.email)}',
         'cron-script',
         '${escapeSqlLiteral(`Cancel-reason follow-up sent; reason=${e.reason} state=${e.state} canceled=${e.row.canceled_at}`)}',
         '${escapeSqlLiteral(nowIso)}'
       );`,
    );
    successCount++;
    console.log(`  sent ${e.row.email}`);
  } catch (err) {
    failCount++;
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  FAIL ${e.row.email}: ${message}`);
  }
}

console.log(`\nDone. ${successCount} sent, ${failCount} failed.`);
process.exit(failCount > 0 ? 1 : 0);
