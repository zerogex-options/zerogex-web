#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-reactivation.mts \
//     [--dry-run | --yes] [--lag-days N] [--lookback-days N] [--limit N] \
//     [--preview-to <email>]
//
// The SECOND-touch reactivation email for the verified-never-paid cohort — the
// inactive-signup analogue of the churned win-back (scripts/send-winback.mts).
// The first touch (scripts/send-verified-never-paid.mts, ~2h after signup)
// pitched the standard 7-day trial and, for this cohort, didn't convert. This
// one reaches back out ~3 weeks after signup and CHANGES the offer: an extended
// free trial (REACTIVATION_TRIAL_DAYS, default 30), granted server-side at
// app/api/billing/checkout/route.ts when the user returns through the email's
// /pricing?trial=1&reactivate=1 link. The longer trial IS the incentive, so
// there is deliberately no discount.
//
// Cohort — deliberately BROADER than "got the first nudge". The 400+ backlog we
// most want to reach signed up before the 2h verified-never-paid automation
// could catch them (it only fires for accounts 2h–7d old), so keying off the
// first-nudge latch would strand exactly the people this campaign exists for.
// Instead we sweep every user who is STILL a verified-never-paid signup and has
// gone cold — signed up at least LAG_DAYS ago — regardless of whether the first
// nudge ever reached them. For anyone who did get it, the ~2h-then-~3-week
// spacing reads as a natural sequence; for the rest, this is simply their
// extended-trial offer.
//
// Eligibility (mirrors list-public-cohort.mjs's verified-never-paid bucket, plus
// the marketing opt-out that every re-engagement send must honor):
//   - users.tier = 'public'
//   - users.email_verified_at IS NOT NULL      (proved ownership; won't bounce)
//   - NOT founding-eligible-not-redeemed *while the founding lock-in window is
//     open* (send-founding-final-call owns them then; the carve-out lifts
//     automatically once FOUNDING_LOCKIN_DEADLINE_ISO passes — same rule as the
//     first nudge)
//   - NOT churned (subscription_lapsed=1 → the win-back discount pitch owns them)
//   - users.stripe_subscription_id IS NULL     (belt-and-suspenders for public)
//   - users.reactivation_email_sent_at IS NULL (one-shot dedupe for THIS touch)
//   - users.marketing_unsubscribed_at IS NULL  (respect the opt-out — this is a
//     marketing re-engagement, not a transactional nudge)
//   - users.created_at in [now - LOOKBACK_DAYS, now - LAG_DAYS]
//
// Deliverability: a re-engagement blast to people who already passed once is the
// riskiest kind of send for a domain's reputation, and hurting it would degrade
// the revenue-critical mail (trial reminders, payment-failed dunning). Two
// guards: every message carries a one-click List-Unsubscribe (handled in
// core/mailer.ts sendReactivationEmail) + a footer opt-out link, and the run is
// capped at --limit recipients (default 50). The daily timer therefore DRIPS the
// backlog — ~50/day — rather than firing hundreds at once. Pass --limit 0 to
// lift the cap.
//
// Side effects on send:
//   - Resend email via core/mailer.ts sendReactivationEmail().
//   - Stamps users.reactivation_email_sent_at = now (permanent latch).
//   - Writes a `reactivation_email_sent` row into audit_events.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import {
  renderReactivationEmail,
  sendReactivationEmail,
  sendReactivationDigestEmail,
} from '../core/mailer.ts';
import { buildUnsubUrl } from '../core/unsubToken.ts';
import { isFoundingLockinOpen } from '../core/foundingLockin.ts';

// 21d lag = "give the ~2h first nudge three weeks to work before we change the
// offer." 3650d (~10y) lookback is effectively "all history" on purpose: the
// whole point is to sweep the aged backlog, so we do NOT bound it the way the
// win-back script does — the --limit drip is what protects deliverability
// instead. LIMIT 50 keeps each run gentle on the sending domain.
const DEFAULT_LAG_DAYS = 21;
const DEFAULT_LOOKBACK_DAYS = 3650;
const DEFAULT_LIMIT = 50;

// The trial length this email PROMISES must equal what the checkout route
// actually grants, so both read the same env with the same default + clamp.
// Mirror of getReactivationTrialDays() in
// app/api/billing/checkout/route.ts — keep the default and [7, 90] band in sync.
function getReactivationTrialDays(): number {
  const raw = Number(process.env.REACTIVATION_TRIAL_DAYS);
  if (!Number.isFinite(raw)) return 30;
  return Math.max(7, Math.min(90, Math.floor(raw)));
}

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  lagDays: number;
  lookbackDays: number;
  limit: number;
  previewTo: string | null;
  // Review mode: email the eligible list + rendered draft to this address and
  // send nothing to users. Falls back to REACTIVATION_DIGEST_TO env when the
  // flag is passed with no value.
  digest: boolean;
  digestTo: string | null;
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
    limit: DEFAULT_LIMIT,
    previewTo: null,
    digest: false,
    digestTo: null,
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
    } else if (arg === '--limit') {
      const value = Number(argv[++i] ?? '');
      if (!Number.isInteger(value) || value < 0) {
        console.error(`Error: --limit expects a non-negative integer (0 = unlimited), got "${argv[i]}".`);
        process.exit(1);
      }
      args.limit = value;
    } else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--digest') {
      args.digest = true;
      // Optional recipient right after the flag; otherwise REACTIVATION_DIGEST_TO env.
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        args.digestTo = next;
        i++;
      }
    } else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-reactivation.mts \\
    [--dry-run | --yes | --digest [email]] [--lag-days N] [--lookback-days N] \\
    [--limit N] [--preview-to <email>]

Sends the second-touch reactivation email to cold verified-never-paid signups
(public tier, verified email, no subscription, not founding-eligible, not
churned, not unsubscribed) who signed up at least LAG_DAYS ago and haven't
received it yet. Pitches an EXTENDED free trial (REACTIVATION_TRIAL_DAYS,
default ${getReactivationTrialDays()}) that the checkout route grants server-side
for the ?reactivate=1 link. Idempotent via users.reactivation_email_sent_at.

Every send carries a one-click List-Unsubscribe header + footer opt-out link,
and honors users.marketing_unsubscribed_at. Runs are capped at --limit
recipients (default ${DEFAULT_LIMIT}) so the daily timer drips the backlog
instead of blasting it; --limit 0 lifts the cap.

Options:
      --dry-run              Print eligible users; no email, no DB writes.
  -y, --yes                  Send emails and stamp users.
      --lag-days N           Days to wait after signup before we'll email
                             (default ${DEFAULT_LAG_DAYS}).
      --lookback-days N      Oldest signup we'll act on (default ${DEFAULT_LOOKBACK_DAYS},
                             i.e. effectively all history — the backlog is the point).
      --limit N              Max recipients this run (default ${DEFAULT_LIMIT}; 0 = unlimited).
      --preview-to <email>   Render the email and send ONE copy to <email>.
                             No DB writes.
      --digest [email]       Review mode: email the eligible list + the rendered
                             draft to <email> (or REACTIVATION_DIGEST_TO) and send
                             nothing to users. No DB writes. Respects --limit, so
                             it previews exactly the batch the next real send goes to.
  -h, --help                 Show this help.

Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL,
ZEROGEX_END_USER_TOKEN_SECRET (to sign the unsubscribe link) and the optional
REACTIVATION_TRIAL_DAYS / REACTIVATION_DIGEST_TO from env or .env.local. Set
AUTH_DB_PATH to override the default DB path.`);
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

const exclusiveFlags = [
  cliArgs.dryRun,
  cliArgs.yes,
  !!cliArgs.previewTo,
  cliArgs.digest,
].filter(Boolean).length;
if (exclusiveFlags > 1) {
  console.error('Error: --dry-run, --yes, --preview-to, and --digest are mutually exclusive.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));

const RESEND_API_KEY = process.env.RESEND_API_KEY || envLocal.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || envLocal.RESEND_FROM_EMAIL;
const NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || '';

if (
  (cliArgs.yes || cliArgs.previewTo || cliArgs.digest) &&
  (!RESEND_API_KEY || !RESEND_FROM_EMAIL)
) {
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
// REACTIVATION_TRIAL_DAYS is read by getReactivationTrialDays() straight off
// process.env; pull it through so a cron run promises the same length the web
// checkout route grants.
if (!process.env.REACTIVATION_TRIAL_DAYS && envLocal.REACTIVATION_TRIAL_DAYS) {
  process.env.REACTIVATION_TRIAL_DAYS = envLocal.REACTIVATION_TRIAL_DAYS;
}

// The unsubscribe link must be signable before we send anything, or every
// recipient would get a broken opt-out (and the mailer would throw). Fail fast.
if ((cliArgs.yes || cliArgs.previewTo) && !process.env.ZEROGEX_END_USER_TOKEN_SECRET) {
  console.error(
    'Error: ZEROGEX_END_USER_TOKEN_SECRET must be set to sign the unsubscribe link.',
  );
  process.exit(1);
}

const trialDays = getReactivationTrialDays();

// Review-digest recipient (the founder). --digest <email> wins, else the
// REACTIVATION_DIGEST_TO env. Validated at the digest branch below (after the
// eligible list is built, so the digest can embed it).
const digestTo =
  cliArgs.digestTo || process.env.REACTIVATION_DIGEST_TO || envLocal.REACTIVATION_DIGEST_TO || null;

if (cliArgs.previewTo) {
  // Preview uses a tokenless placeholder unsubscribe URL — no real user id to
  // sign, and we never want a sample to carry a working opt-out for someone
  // else. The real send builds a per-user signed link below.
  const previewUnsub = `${(NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')}/unsubscribe`;
  console.log(`Sending preview to ${cliArgs.previewTo} (trial=${trialDays}d)...`);
  await sendReactivationEmail(cliArgs.previewTo, { trialDays, unsubUrl: previewUnsub });
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

// Pre-flight schema check. Every column the eligibility query reads is added by
// the app's lazy migration in core/db.ts, which only runs when the Next.js app
// boots and first calls getDb(). If this feature was merged but the app hasn't
// been rebuilt/restarted, reactivation_email_sent_at (and friends) won't exist
// yet, and the query below would die with a raw "no such column" SQL error.
// Check explicitly and point at the one-line fix instead. Mirrors the guard in
// scripts/list-public-cohort.mjs.
const userCols = new Set(
  querySqlite<{ name: string }>(dbPath, `PRAGMA table_info(users);`).map((c) => c.name),
);
const requiredCols = [
  'reactivation_email_sent_at',
  'verified_never_paid_email_sent_at',
  'marketing_unsubscribed_at',
  'subscription_lapsed',
  'founding_eligible',
  'founding_member_started_at',
  'email_verified_at',
  'stripe_subscription_id',
];
const missingCols = requiredCols.filter((c) => !userCols.has(c));
if (missingCols.length > 0) {
  console.error(`Auth DB at ${dbPath} is missing column(s): ${missingCols.join(', ')}.`);
  console.error(
    "These are added by the app's lazy migration (core/db.ts). Run `make migrate` (or",
  );
  console.error('rebuild/restart the app) so the migration lands, then re-run this.');
  process.exit(1);
}

const nowMs = Date.now();
const DAY_MS = 86_400_000;
const highIso = new Date(nowMs - cliArgs.lagDays * DAY_MS).toISOString();
const lowIso = new Date(nowMs - cliArgs.lookbackDays * DAY_MS).toISOString();

type UserRow = {
  id: string;
  email: string;
  created_at: string;
};

// The founding-eligible carve-out is gated on the founding lock-in window, same
// as the first-nudge script: while it's open, send-founding-final-call owns
// those users; once the deadline passes it lifts so they flow here instead of
// being stranded. Empty string when lifted keeps the SQL valid.
const foundingOpen = isFoundingLockinOpen();
const foundingCarveOut = foundingOpen
  ? 'AND NOT (COALESCE(founding_eligible, 0) = 1 AND founding_member_started_at IS NULL)'
  : '';

// LIMIT clause: the DB drip that keeps a single run gentle on the sending
// domain. 0 means unlimited (operator opt-in).
const limitClause = cliArgs.limit > 0 ? `LIMIT ${cliArgs.limit}` : '';

const eligible = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, created_at
   FROM users
   WHERE tier = 'public'
     AND email_verified_at IS NOT NULL
     ${foundingCarveOut}
     AND COALESCE(subscription_lapsed, 0) != 1
     AND stripe_subscription_id IS NULL
     AND reactivation_email_sent_at IS NULL
     AND marketing_unsubscribed_at IS NULL
     AND created_at >= '${escapeSqlLiteral(lowIso)}'
     AND created_at <= '${escapeSqlLiteral(highIso)}'
   ORDER BY created_at ASC
   ${limitClause};`,
);

console.log(`Auth DB:            ${dbPath}`);
console.log(`Signup window:      ${lowIso}  →  ${highIso}`);
console.log(`Trial offered:      ${trialDays} days`);
console.log(
  `Founding carve-out: ${
    foundingOpen
      ? 'ACTIVE (founding-eligible-never-redeemed still owned by send-founding-final-call)'
      : 'LIFTED (deadline passed; founding-eligible-never-redeemed eligible here)'
  }`,
);
console.log(
  `Batch limit:        ${cliArgs.limit > 0 ? `${cliArgs.limit} (drip)` : 'unlimited'}`,
);
console.log(`Eligible this run:  ${eligible.length}`);

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

// Review digest: email the founder the full recipient list + the rendered draft
// (respecting --limit, so it shows exactly the batch the next real send would go
// to) and stop. Nothing goes to users, no DB writes — the actual send is a
// separate, deliberate `make reactivation YES=1`.
if (cliArgs.digest) {
  if (!digestTo) {
    console.error(
      'Error: --digest needs a recipient. Pass --digest <email> or set REACTIVATION_DIGEST_TO in .env.local.',
    );
    process.exit(1);
  }
  // The embedded draft uses a tokenless placeholder unsub — it's a preview to
  // the founder, so it must never carry a working opt-out for a real user.
  const previewUnsub = `${(NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')}/unsubscribe`;
  const draft = renderReactivationEmail({ trialDays, unsubUrl: previewUnsub });
  const sendCommand = `make reactivation YES=1 LIMIT=${cliArgs.limit}`;
  await sendReactivationDigestEmail(digestTo, {
    recipients: eligible.map((u) => u.email),
    sendCommand,
    trialDays,
    draft,
  });
  console.log(
    `\n[digest] Review email sent to ${digestTo}: ${eligible.length} recipient(s) listed, draft embedded. No user emails sent — run \`${sendCommand}\` to deliver.`,
  );
  process.exit(0);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No emails sent, no audit rows written.');
  if (cliArgs.limit > 0) {
    console.log(
      `Note: --limit ${cliArgs.limit} caps this run; re-run (or the daily timer) drains the rest.`,
    );
  }
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
    const unsubUrl = buildUnsubUrl(NEXT_PUBLIC_APP_URL || 'http://localhost:3000', user.id);
    await sendReactivationEmail(user.email, { trialDays, unsubUrl });
    const nowIso = new Date().toISOString();
    // Stamp the latch FIRST so a partial run that crashes after some sends
    // doesn't re-send to anyone who already received. Audit row is best-effort;
    // the column on `users` is the source of truth for idempotency.
    execSqlite(
      dbPath,
      `UPDATE users
       SET reactivation_email_sent_at = '${escapeSqlLiteral(nowIso)}',
           updated_at = '${escapeSqlLiteral(nowIso)}'
       WHERE id = '${escapeSqlLiteral(user.id)}';`,
    );

    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    execSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         'reactivation_email_sent',
         '${escapeSqlLiteral(user.id)}',
         NULL,
         '${escapeSqlLiteral(user.email)}',
         'cron-script',
         '${escapeSqlLiteral(`Reactivation email sent; trial=${trialDays}d signup=${user.created_at}`)}',
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
