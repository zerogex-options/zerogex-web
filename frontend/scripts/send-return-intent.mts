#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-return-intent.mts \
//     [--dry-run | --yes | --digest [email] | --preview-to <email>] \
//     [--cooldown-days N] [--quiet-hours N] [--max-login-age-days N] [--limit N]
//
// Answers a churned member who came back to the site on their own.
//
// WHY THIS EXISTS. Every other churn touch fires on a calendar. The cancellation
// acknowledgment goes out the moment they click Cancel; the win-back goes out
// ~30 days after access ends (scripts/send-winback.mts). Both are guesses about
// when someone might be receptive, and both are spent — latched once per account
// and never cleared. Meanwhile a churned member who logs back in is not a guess:
// they are standing in the doorway of a product they no longer have access to,
// which is the highest-intent signal the system produces, and nothing reads it.
// Their win-back fired months ago, when they were cold.
//
// THE COOLDOWN, NOT A LATCH. users.return_intent_email_sent_at records when we
// last answered a member, and core/returnIntent.ts requires BOTH that the
// cooldown has lapsed AND that the visit is newer than that timestamp. So this
// sweep works on today's churned book and on every future churn indefinitely,
// instead of spending the whole cohort on one run. See core/db.ts for the
// column's rationale and core/returnIntent.ts for the full eligibility matrix.
//
// NO DISCOUNT. Deliberate; see the note above renderReturnIntentEmail in
// core/mailer.ts. The 25% save (core/retentionOffer.ts) stays unspent for a
// later touch.
//
// Intended to be scheduled (systemd timer) once a day. The unit
// (zerogex-web-return-intent.timer) fires on the :50 minute so it does not
// collide with the hourly auth backup at :00, the trial reminders at :15, the
// verify reminders at :20, verified-never-paid at :30, win-back at :35, or
// checkout recovery at :45. Daily is plenty: the quiet window below means the
// earliest a visit can be answered is the next day anyway.
//
// Side effects on send:
//   - Resend email via core/mailer.ts sendReturnIntentEmail().
//   - Stamps users.return_intent_email_sent_at = now (the cooldown anchor).
//   - Writes a `return_intent_email_sent` row into audit_events.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import {
  renderReturnIntentEmail,
  sendReturnIntentDigestEmail,
  sendReturnIntentEmail,
} from '../core/mailer.ts';
import {
  DEFAULT_COOLDOWN_DAYS,
  DEFAULT_MAX_LOGIN_AGE_DAYS,
  DEFAULT_QUIET_HOURS,
  decideReturnIntent,
  returnIntentAngle,
  type SkipReason,
} from '../core/returnIntent.ts';
import { parseCancellationReasonFromMessage } from '../core/cancellationReason.ts';
import { parseHighlightsJson, selectHighlightsSince } from '../core/winbackHighlights.ts';
import { buildUnsubUrl } from '../core/unsubToken.ts';

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  digest: boolean;
  digestTo: string | null;
  previewTo: string | null;
  cooldownDays: number;
  quietHours: number;
  maxLoginAgeDays: number;
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
  const args: Args = {
    dryRun: false,
    yes: false,
    help: false,
    digest: false,
    digestTo: null,
    previewTo: null,
    cooldownDays: DEFAULT_COOLDOWN_DAYS,
    quietHours: DEFAULT_QUIET_HOURS,
    maxLoginAgeDays: DEFAULT_MAX_LOGIN_AGE_DAYS,
    limit: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--cooldown-days') args.cooldownDays = positiveNumber(argv[++i], '--cooldown-days');
    else if (arg === '--quiet-hours') args.quietHours = positiveNumber(argv[++i], '--quiet-hours');
    else if (arg === '--max-login-age-days')
      args.maxLoginAgeDays = positiveNumber(argv[++i], '--max-login-age-days');
    else if (arg === '--limit') args.limit = positiveNumber(argv[++i], '--limit');
    else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--digest') {
      args.digest = true;
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
  node --experimental-strip-types scripts/send-return-intent.mts \\
    [--dry-run | --yes | --digest [email] | --preview-to <email>] \\
    [--cooldown-days N] [--quiet-hours N] [--max-login-age-days N] [--limit N]

Finds churned members who have logged back in since they left and have not been
answered, and sends one founder-voice note: your account is still here, here's
what shipped since, and — where they told us why they left — one paragraph that
answers that specific reason. No discount, no trial claim.

Eligibility (core/returnIntent.ts owns the matrix; --dry-run reports why each
member was skipped):
  - users.subscription_lapsed = 1 and no stripe_subscription_id  (really churned)
  - users.email_verified_at IS NOT NULL                           (won't bounce)
  - users.deleted_at IS NULL                                      (forgotten accounts)
  - users.marketing_unsubscribed_at IS NULL                       (this is marketing)
  - users.tier != 'admin'
  - a login_success AFTER their most recent stripe_subscription_deleted
  - that visit is at least --quiet-hours old (default ${DEFAULT_QUIET_HOURS}) and at most
    --max-login-age-days old (default ${DEFAULT_MAX_LOGIN_AGE_DAYS})
  - users.return_intent_email_sent_at is null, or older than --cooldown-days
    (default ${DEFAULT_COOLDOWN_DAYS}) AND older than the visit itself

That last clause is what makes this a reply rather than a newsletter: an
expiring cooldown alone can never re-fire on a stale login.

Options:
      --dry-run              Print who qualifies and why everyone else didn't.
                             No email, no DB writes.
  -y, --yes                  Send emails and stamp the cooldown.
      --digest [email]       Review mode: email the eligible list + a rendered
                             draft to <email> (or RETURN_INTENT_DIGEST_TO) and
                             send NOTHING to members. This is the cron default;
                             approve by re-running with --yes. No DB writes.
      --preview-to <email>   Render one sample email to <email>. No DB writes.
      --cooldown-days N      Minimum days between two notes to one member.
      --quiet-hours N        How long after a visit before we'll write.
      --max-login-age-days N Oldest visit still worth answering.
      --limit N              Cap the number of sends this run (first N by
                             visit date, oldest first). Useful for a staged
                             first run against a backlog.
  -h, --help                 Show this help.

Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL,
ZEROGEX_END_USER_TOKEN_SECRET (to sign the unsubscribe link) and the optional
RETURN_INTENT_DIGEST_TO from env or .env.local. Set AUTH_DB_PATH to override
the default DB path.`);
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

const exclusiveFlags = [
  cliArgs.dryRun,
  cliArgs.yes,
  cliArgs.digest,
  !!cliArgs.previewTo,
].filter(Boolean).length;
if (exclusiveFlags > 1) {
  console.error('Error: --dry-run, --yes, --digest, and --preview-to are mutually exclusive.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));

const RESEND_API_KEY = process.env.RESEND_API_KEY || envLocal.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || envLocal.RESEND_FROM_EMAIL;
const NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const sendsAnything = cliArgs.yes || cliArgs.digest || !!cliArgs.previewTo;
if (sendsAnything && (!RESEND_API_KEY || !RESEND_FROM_EMAIL)) {
  console.error('Error: RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send emails.');
  process.exit(1);
}

if (RESEND_API_KEY) process.env.RESEND_API_KEY = RESEND_API_KEY;
if (RESEND_FROM_EMAIL) process.env.RESEND_FROM_EMAIL = RESEND_FROM_EMAIL;
process.env.NEXT_PUBLIC_APP_URL = NEXT_PUBLIC_APP_URL;

// buildUnsubUrl() signs with this secret; a cron run only has the shell env, so
// pull it out of .env.local the same way scripts/send-reactivation.mts does.
if (!process.env.ZEROGEX_END_USER_TOKEN_SECRET && envLocal.ZEROGEX_END_USER_TOKEN_SECRET) {
  process.env.ZEROGEX_END_USER_TOKEN_SECRET = envLocal.ZEROGEX_END_USER_TOKEN_SECRET;
}
if ((cliArgs.yes || cliArgs.previewTo) && !process.env.ZEROGEX_END_USER_TOKEN_SECRET) {
  console.error('Error: ZEROGEX_END_USER_TOKEN_SECRET must be set to sign the unsubscribe link.');
  process.exit(1);
}

const digestTo =
  cliArgs.digestTo || (process.env.RETURN_INTENT_DIGEST_TO || envLocal.RETURN_INTENT_DIGEST_TO || '').trim() || null;

// "What's new" bullets, dated in content/winback-highlights.json so each member
// is shown only what shipped after THEY left (core/winbackHighlights.ts). Any
// problem reading the file leaves this null and the run falls back to the
// mailer's built-in defaults — a send never breaks over editable content.
function readHighlights() {
  const file = path.join(cwd, 'content', 'winback-highlights.json');
  try {
    if (!fs.existsSync(file)) return null;
    return parseHighlightsJson(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Warning: could not read content/winback-highlights.json (${message}); using defaults.`);
    return null;
  }
}
const allHighlights = readHighlights();

if (cliArgs.previewTo) {
  const sample = allHighlights
    ? selectHighlightsSince(allHighlights, null, { minItems: 3 })
    : { items: [], freshCount: 0 };
  console.log(`Sending preview to ${cliArgs.previewTo}...`);
  await sendReturnIntentEmail(cliArgs.previewTo, {
    angle: 'price',
    highlights: sample.items,
    freshCount: sample.items.length,
    foundingMember: true,
    unsubUrl: buildUnsubUrl(NEXT_PUBLIC_APP_URL, 'preview-user'),
  });
  console.log('Preview sent. (Rendered with the price angle + founding note so every block shows.)');
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

type CandidateRow = {
  id: string;
  email: string;
  tier: string | null;
  subscription_lapsed: number | null;
  stripe_subscription_id: string | null;
  email_verified_at: string | null;
  deleted_at: string | null;
  marketing_unsubscribed_at: string | null;
  founding_member_started_at: string | null;
  return_intent_email_sent_at: string | null;
  churned_at: string | null;
  churn_message: string | null;
  last_login_at: string | null;
};

// Pre-filtered to the churned book (a few hundred rows), with the two audit
// facts the decision needs attached as correlated subqueries. Everything else —
// verification, opt-out, the timing windows, the cooldown — is decided by the
// pure module so it is unit-tested and so --dry-run can explain each skip.
//
// Both subqueries take the MOST RECENT row: a member who churned, returned and
// churned again is judged by their latest exit, exactly as send-winback.mts
// anchors its lag window.
const candidates = querySqlite<CandidateRow>(
  dbPath,
  `SELECT u.id,
          u.email,
          u.tier,
          u.subscription_lapsed,
          u.stripe_subscription_id,
          u.email_verified_at,
          u.deleted_at,
          u.marketing_unsubscribed_at,
          u.founding_member_started_at,
          u.return_intent_email_sent_at,
          (SELECT MAX(a.created_at) FROM audit_events a
            WHERE a.user_id = u.id AND a.type = 'stripe_subscription_deleted') AS churned_at,
          (SELECT a2.message FROM audit_events a2
            WHERE a2.user_id = u.id AND a2.type = 'stripe_subscription_deleted'
            ORDER BY a2.created_at DESC LIMIT 1) AS churn_message,
          (SELECT MAX(a3.created_at) FROM audit_events a3
            WHERE a3.user_id = u.id AND a3.type = 'login_success') AS last_login_at
     FROM users u
    WHERE COALESCE(u.subscription_lapsed, 0) = 1
    ORDER BY u.created_at ASC;`,
);

const nowMs = Date.now();

type Eligible = {
  row: CandidateRow;
  loginAt: string;
  churnedAt: string;
  angle: ReturnType<typeof returnIntentAngle>;
  feedback: string | null;
};

const eligible: Eligible[] = [];
const skips = new Map<SkipReason, number>();

for (const row of candidates) {
  const decision = decideReturnIntent({
    subscriptionLapsed: Number(row.subscription_lapsed) === 1,
    hasSubscriptionOnFile: !!row.stripe_subscription_id,
    emailVerified: !!row.email_verified_at,
    deleted: !!row.deleted_at,
    marketingUnsubscribed: !!row.marketing_unsubscribed_at,
    tier: row.tier ?? 'public',
    churnedAt: row.churned_at,
    lastLoginAt: row.last_login_at,
    lastSentAt: row.return_intent_email_sent_at,
    nowMs,
    cooldownDays: cliArgs.cooldownDays,
    quietHours: cliArgs.quietHours,
    maxLoginAgeDays: cliArgs.maxLoginAgeDays,
  });

  if (!decision.send) {
    skips.set(decision.reason, (skips.get(decision.reason) ?? 0) + 1);
    continue;
  }

  const feedback = parseCancellationReasonFromMessage(row.churn_message ?? '').feedback;
  eligible.push({
    row,
    loginAt: decision.loginAt,
    churnedAt: decision.churnedAt,
    angle: returnIntentAngle(feedback),
    feedback,
  });
}

// Oldest visit first: on a staged first run with --limit, the members who have
// been waiting longest for an answer are the ones who get it.
eligible.sort((a, b) => a.loginAt.localeCompare(b.loginAt));
const selected = cliArgs.limit != null ? eligible.slice(0, cliArgs.limit) : eligible;

console.log(`Auth DB:            ${dbPath}`);
console.log(`Churned candidates: ${candidates.length}`);
console.log(
  `Windows:            cooldown ${cliArgs.cooldownDays}d, quiet ${cliArgs.quietHours}h, max visit age ${cliArgs.maxLoginAgeDays}d`,
);
console.log(`Eligible:           ${eligible.length}${cliArgs.limit != null ? ` (sending ${selected.length}, --limit ${cliArgs.limit})` : ''}`);

if (skips.size > 0) {
  console.log('\nSkipped:');
  for (const [reason, count] of [...skips.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}  ${reason}`);
  }
}

if (selected.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

console.log('\nEligible members:');
for (const e of selected.slice(0, 20)) {
  console.log(
    `  - ${e.row.email}: left ${e.churnedAt.slice(0, 10)}, back ${e.loginAt.slice(0, 10)}, angle ${e.angle}${e.feedback ? ` (${e.feedback})` : ''}`,
  );
}
if (selected.length > 20) {
  console.log(`  ... and ${selected.length - 20} more`);
}

// Build one member's email options. Highlights are filtered against THEIR churn
// date, so the same template produces different mail for every cohort and can
// never repeat itself for a given reader.
function optsFor(e: Eligible) {
  const selection = allHighlights
    ? selectHighlightsSince(allHighlights, e.churnedAt, { minItems: 3 })
    : { items: [], freshCount: 0 };
  return {
    angle: e.angle,
    highlights: selection.items,
    freshCount: selection.freshCount,
    foundingMember: !!e.row.founding_member_started_at,
    unsubUrl: buildUnsubUrl(NEXT_PUBLIC_APP_URL, e.row.id),
  };
}

if (cliArgs.digest) {
  if (!digestTo) {
    console.error(
      'Error: --digest needs a recipient. Pass --digest <email> or set RETURN_INTENT_DIGEST_TO in .env.local.',
    );
    process.exit(1);
  }
  // The embedded draft is the FIRST recipient's real email, rendered with their
  // angle and their filtered highlights — a representative sample rather than a
  // synthetic one, so the reviewer sees what will actually go out.
  const draft = renderReturnIntentEmail(optsFor(selected[0]));
  const sendCommand = 'make return-intent YES=1';
  await sendReturnIntentDigestEmail(digestTo, {
    recipients: selected.map((e) => ({
      email: e.row.email,
      angle: e.angle,
      lastLoginAt: e.loginAt,
      churnedAt: e.churnedAt,
    })),
    sendCommand,
    draft,
  });
  console.log(
    `\n[digest] Review email sent to ${digestTo}: ${selected.length} recipient(s) listed, draft embedded. No member emails sent — run \`${sendCommand}\` to deliver.`,
  );
  process.exit(0);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No emails sent, no DB writes.');
  process.exit(0);
}

if (!cliArgs.yes) {
  console.log('\nRefusing to send without --yes. Re-run with --yes to deliver, or --dry-run to preview.');
  process.exit(1);
}

let successCount = 0;
let failCount = 0;

for (const e of selected) {
  try {
    await sendReturnIntentEmail(e.row.email, optsFor(e));
    const nowIso = new Date().toISOString();
    // Stamp the cooldown FIRST so a run that crashes mid-way can't re-send to
    // anyone already answered. The audit row below is best-effort; the column
    // on `users` is the source of truth.
    execSqlite(
      dbPath,
      `UPDATE users
          SET return_intent_email_sent_at = '${escapeSqlLiteral(nowIso)}',
              updated_at = '${escapeSqlLiteral(nowIso)}'
        WHERE id = '${escapeSqlLiteral(e.row.id)}';`,
    );

    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    execSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         'return_intent_email_sent',
         '${escapeSqlLiteral(e.row.id)}',
         NULL,
         '${escapeSqlLiteral(e.row.email)}',
         'cron-script',
         '${escapeSqlLiteral(`Return-intent email sent; angle=${e.angle} churned=${e.churnedAt} returned=${e.loginAt}`)}',
         '${escapeSqlLiteral(nowIso)}'
       );`,
    );
    successCount++;
  } catch (err) {
    failCount++;
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  FAIL ${e.row.email}: ${message}`);
  }
}

console.log(`\nDone. ${successCount} sent, ${failCount} failed.`);
process.exit(failCount > 0 ? 1 : 0);
