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
// Discount variant is resolved per run (ranked auto > promo > manual):
//   - auto:   STRIPE_COUPON_WINBACK_* fully configured → the email's one-click
//     coupon that auto-applies at /pricing?winback=1 (the checkout route attaches
//     it for this eligible churner, verified server-side). No code, no reply.
//   - promo:  no win-back coupon, but PROMO_END_AT is live → the time-boxed
//     public-promo copy (also auto-applies at /pricing).
//   - manual: neither → the evergreen "reply 'discount'" offer, set up by hand.
//
// Side effects on send:
//   - Resend email via core/mailer.ts sendWinbackEmail() in the resolved variant.
//   - Stamps users.winback_email_sent_at = now (dedupe latch).
//   - Writes a `winback_email_sent` row into audit_events.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import {
  renderWinbackEmail,
  sendWinbackDigestEmail,
  sendWinbackEmail,
  type WinbackHighlight,
} from '../core/mailer.ts';

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
// Effectively unbounded: the weekly job should "catch ALL users who cancelled
// 30+ days ago and haven't been contacted yet", not just a rolling 30–60 day
// slice. The winback_email_sent_at latch already prevents re-contacting anyone,
// so a wide ceiling just lets the very first run sweep the whole backlog; steady
// state is only ever the handful who newly cross the 30-day line each week. Pass
// --lookback-days to narrow it (e.g. bounding a first-run blast).
const DEFAULT_LOOKBACK_DAYS = 3650;

type WinbackMode = 'auto' | 'promo' | 'manual';

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  lagDays: number;
  lookbackDays: number;
  previewTo: string | null;
  previewMode: WinbackMode | null;
  // Review mode: email the eligible list + rendered draft to this address and
  // send nothing to users. Falls back to WINBACK_DIGEST_TO env when the flag is
  // passed with no value.
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
    previewTo: null,
    previewMode: null,
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
    } else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--preview-mode') {
      const value = argv[++i] ?? '';
      if (value !== 'auto' && value !== 'promo' && value !== 'manual') {
        console.error(`Error: --preview-mode expects auto|promo|manual, got "${value}".`);
        process.exit(1);
      }
      args.previewMode = value;
    } else if (arg === '--digest') {
      args.digest = true;
      // Optional recipient right after the flag; otherwise WINBACK_DIGEST_TO env.
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
  node --experimental-strip-types scripts/send-winback.mts \\
    [--dry-run | --yes | --digest [email]] [--lag-days N] [--lookback-days N] \\
    [--preview-to <email>] [--preview-mode auto|promo|manual]

Finds churned users (subscription actually lapsed) whose most-recent departure
was roughly a month ago, and sends a one-shot founder-voice win-back with a
link back to /pricing. The discount copy is chosen automatically:
  auto   - STRIPE_COUPON_WINBACK_* all configured → one-click coupon that
           auto-applies at /pricing?winback=1 (no code, no reply).
  promo  - no win-back coupon, but the public promo (PROMO_END_AT) is live →
           the time-boxed promo copy.
  manual - neither → the evergreen "reply 'discount'" offer, fulfilled by hand.
Idempotent via users.winback_email_sent_at (cleared by the Stripe webhook on
re-subscribe so a future re-churn re-qualifies).

Eligibility mirrors list-public-cohort.mjs's churned bucket:
  - users.subscription_lapsed = 1
  - users.stripe_subscription_id IS NULL
  - users.email_verified_at IS NOT NULL
  - users.tier != 'admin'
  - users.winback_email_sent_at IS NULL
  - users.deleted_at IS NULL          (self-deleted accounts opt out of all mail)
  - MAX(stripe_subscription_deleted audit event) in
    [now - LOOKBACK_DAYS, now - LAG_DAYS] (defaults ${DEFAULT_LOOKBACK_DAYS}d / ${DEFAULT_LAG_DAYS}d).
    The wide default lookback means the weekly job catches EVERY 30+-day churner
    who hasn't been emailed, not just a rolling window.

Options:
      --dry-run                Print eligible users; no email, no DB writes.
  -y, --yes                    Send emails and stamp users.
      --digest [email]         Review mode: email the eligible list + rendered
                               draft to <email> (or WINBACK_DIGEST_TO) and send
                               NOTHING to users. This is the weekly cron default;
                               approve by running with --yes. No DB writes.
      --lag-days N             Days to wait after churn before we'll email
                               (default ${DEFAULT_LAG_DAYS}).
      --lookback-days N        Oldest churn we'll act on (default ${DEFAULT_LOOKBACK_DAYS}).
      --preview-to <email>     Render the email and send ONE copy to <email>.
                               No DB writes. Defaults to the env-resolved mode;
                               override with --preview-mode.
      --preview-mode <mode>    Force the preview variant: auto | promo | manual.
  -h, --help                   Show this help.

Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL, PROMO_END_AT,
STRIPE_COUPON_WINBACK_* and WINBACK_DISCOUNT_LABEL from env or .env.local. Set
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
// PROMO_END_AT is read directly by getActivePromoDeadlineLabelLocal() — pull it
// out of .env.local so cron runs (which only have the shell env) still see it.
if (envLocal.PROMO_END_AT && !process.env.PROMO_END_AT) {
  process.env.PROMO_END_AT = envLocal.PROMO_END_AT;
}

const envValue = (key: string): string =>
  (process.env[key] || envLocal[key] || '').trim();

// Copy label for the discount, shown in the auto + manual email variants. MUST
// match the actual STRIPE_COUPON_WINBACK_* value the checkout route applies.
const WINBACK_DISCOUNT_LABEL = envValue('WINBACK_DISCOUNT_LABEL') || '25% off your first year';

// Review-digest recipient (the founder). --digest <email> wins, else the
// WINBACK_DIGEST_TO env. Validated at the digest branch below.
const digestTo = cliArgs.digestTo || envValue('WINBACK_DIGEST_TO') || null;

// Evergreen "what's new" bullets, read from content/winback-highlights.json so
// the copy can be refreshed without a code change. Any problem (missing file,
// bad JSON, wrong shape) logs a warning and returns null, and the mailer falls
// back to its built-in DEFAULT_WINBACK_HIGHLIGHTS — the send never breaks over
// editable content.
function readHighlights(): WinbackHighlight[] | undefined {
  const file = path.join(cwd, 'content', 'winback-highlights.json');
  if (!fs.existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      highlights?: Array<{ title?: unknown; body?: unknown }>;
    };
    const list = (parsed.highlights ?? [])
      .filter(
        (h): h is WinbackHighlight =>
          typeof h?.title === 'string' &&
          h.title.trim().length > 0 &&
          typeof h?.body === 'string' &&
          h.body.trim().length > 0,
      )
      .map((h) => ({ title: h.title.trim(), body: h.body.trim() }));
    if (list.length === 0) {
      console.warn('Warning: content/winback-highlights.json has no valid highlights; using defaults.');
      return undefined;
    }
    return list;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Warning: could not read content/winback-highlights.json (${message}); using defaults.`);
    return undefined;
  }
}

const winbackHighlights = readHighlights();

// The automated one-click path is "available" only when ALL FOUR win-back
// coupons are configured — the churner can pick any (tier, cadence), so the
// email's "it's already applied" promise must hold whatever they choose. If any
// is missing we fall back to promo/manual rather than risk promising a coupon
// the checkout route can't attach for their pick.
const winbackAutoAvailable =
  !!envValue('STRIPE_COUPON_WINBACK_BASIC_MONTHLY') &&
  !!envValue('STRIPE_COUPON_WINBACK_PRO_MONTHLY') &&
  !!envValue('STRIPE_COUPON_WINBACK_BASIC_ANNUAL') &&
  !!envValue('STRIPE_COUPON_WINBACK_PRO_ANNUAL');

// Public limited-time promo, used only as a fallback when the automated
// win-back coupon isn't configured.
const promoDeadlineLabel = getActivePromoDeadlineLabelLocal();

// Ranked auto > promo > manual.
const resolvedMode: WinbackMode = winbackAutoAvailable
  ? 'auto'
  : promoDeadlineLabel
    ? 'promo'
    : 'manual';

// Map a mode to the sendWinbackEmail opts. Promo mode needs a live deadline
// label; if it's somehow requested without one (a forced preview), the mailer
// degrades to the manual copy on its own.
function optsForMode(mode: WinbackMode) {
  if (mode === 'auto') {
    return {
      winbackAutoApply: true,
      discountLabel: WINBACK_DISCOUNT_LABEL,
      highlights: winbackHighlights,
    };
  }
  if (mode === 'promo') {
    return { promoDeadlineLabel, discountLabel: WINBACK_DISCOUNT_LABEL, highlights: winbackHighlights };
  }
  return { discountLabel: WINBACK_DISCOUNT_LABEL, highlights: winbackHighlights };
}

if (cliArgs.previewTo) {
  const mode = cliArgs.previewMode ?? resolvedMode;
  if (mode === 'promo' && !promoDeadlineLabel) {
    console.log(
      'Note: promo preview requested but PROMO_END_AT is unset or past; the email will render the manual copy.',
    );
  }
  console.log(`Sending preview to ${cliArgs.previewTo} (variant: ${mode})...`);
  await sendWinbackEmail(cliArgs.previewTo, optsForMode(mode));
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
     AND u.deleted_at IS NULL
   GROUP BY u.id, u.email
   HAVING MAX(a.created_at) >= '${escapeSqlLiteral(lowIso)}'
      AND MAX(a.created_at) <= '${escapeSqlLiteral(highIso)}'
   ORDER BY churned_at ASC;`,
);

const modeDescription =
  resolvedMode === 'auto'
    ? `auto (one-click ${WINBACK_DISCOUNT_LABEL} via /pricing?winback=1)`
    : resolvedMode === 'promo'
      ? `promo (public promo open until ${promoDeadlineLabel})`
      : `manual (evergreen reply-for-discount, ${WINBACK_DISCOUNT_LABEL})`;

console.log(`Auth DB:          ${dbPath}`);
console.log(`Churn window:     ${lowIso}  →  ${highIso}`);
console.log(`Discount variant: ${modeDescription}`);
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

// Review digest: email the founder the full recipient list + the rendered draft
// (in the mode the real send would use) and stop. Nothing goes to users, no DB
// writes — the actual send is a separate, deliberate `make winback YES=1`.
if (cliArgs.digest) {
  if (!digestTo) {
    console.error(
      'Error: --digest needs a recipient. Pass --digest <email> or set WINBACK_DIGEST_TO in .env.local.',
    );
    process.exit(1);
  }
  const draft = renderWinbackEmail(optsForMode(resolvedMode));
  const sendCommand = 'make winback YES=1';
  await sendWinbackDigestEmail(digestTo, {
    recipients: eligible.map((u) => u.email),
    mode: resolvedMode,
    sendCommand,
    draft,
  });
  console.log(
    `\n[digest] Review email sent to ${digestTo}: ${eligible.length} recipient(s) listed, draft embedded. No user emails sent — run \`${sendCommand}\` to deliver.`,
  );
  process.exit(0);
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

const sendOpts = optsForMode(resolvedMode);

for (const user of eligible) {
  try {
    await sendWinbackEmail(user.email, sendOpts);
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
    const variant = resolvedMode;
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
