#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-product-update.mts \
//     --audience subscribers|registrants|cancelled \
//     [--campaign <id>] [--dry-run] [--preview-to <email>] [--send --yes] \
//     [--limit N] [--days N] [--since <ISO date>] [--subject "..."] \
//     [--throttle-ms N] [--no-list-unsubscribe] [--csv <path>]
//
// One-shot product-update campaign, sent DIRECTLY per-recipient from the server
// via Resend (emails.send). Computes the cohort from the auth DB, sends the
// matching docs/newsletters/*.html + *.txt to each recipient, and stamps an
// audit row so re-runs resume instead of double-sending.
//
// Campaigns are registered in CAMPAIGNS below and selected with --campaign;
// DEFAULT_CAMPAIGN is what a bare invocation sends. Past campaigns stay
// registered so a finished send can still be counted or re-audited.
//
// The email body carries a per-recipient Unsubscribe link: the {{UNSUB_URL}}
// placeholder is replaced with a signed /unsubscribe link, and the same URL is
// set as a one-click List-Unsubscribe header (RFC 8058). Users who have
// unsubscribed (users.marketing_unsubscribed_at) are excluded from the cohort.
// --no-list-unsubscribe drops only the header (the body link stays).
// Requires ZEROGEX_END_USER_TOKEN_SECRET (to sign) and NEXT_PUBLIC_APP_URL.
//
// Audiences:
//   subscribers  → active + trialing customers.
//                  WHERE subscription_status IN ('active','trialing')
//   registrants  → signed up ≤N days (default 30) or since --since, verified
//                  email, logged in (proxied by authenticated page-view activity
//                  — no last_login column exists), and never subscribed.
//                  Whether this also skips anyone the automated ~2h onboarding
//                  nudge already reached is per-campaign
//                  (CampaignSpec.excludeOnboardingNudged): July did, August does
//                  not, because in steady state that nudge reaches nearly every
//                  signup within hours and excluding them empties the cohort.
//   cancelled    → churned members (subscription_lapsed=1, no live sub, verified,
//                  not an operator, not self-deleted) who have NOT already had
//                  the automated ~1-month win-back (winback_email_sent_at IS
//                  NULL), so nobody gets two win-back pitches. Mirrors the
//                  eligibility in scripts/send-winback.mts minus its churn-age
//                  window, plus the marketing opt-out every campaign honors.
//
// WIN-BACK COUPON (cancelled only): the email's CTA is /pricing?winback=1, and
// app/api/billing/checkout/route.ts only attaches the coupon when BOTH
// subscription_lapsed=1 AND users.winback_email_sent_at is set. This sender
// therefore stamps winback_email_sent_at on each successful `cancelled` send —
// which is also what stops the weekly automated win-back from double-touching
// the cohort. Because the promise is worthless without the coupon configured,
// the run refuses to start unless STRIPE_COUPON_WINBACK_* is present (override
// with --allow-missing-coupon when the offer is being honored by hand).
//
// Idempotency: a `<campaign key>_sent` row is written to audit_events on each
// successful send; already-stamped users are skipped on re-run.
//
// Env (from process.env or .env.local): RESEND_API_KEY, RESEND_FROM_EMAIL.
// AUTH_DB_PATH overrides the DB. Requires the sqlite3 CLI on PATH.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { buildUnsubUrl } from '../core/unsubToken.ts';

type Audience = 'subscribers' | 'registrants' | 'cancelled';

type AudienceContent = { subject: string; html: string; text: string };

type CampaignSpec = {
  // Idempotency key; the audit row written per send is `${key}_sent`.
  key: string;
  // Only the audiences this campaign actually has content for.
  content: Partial<Record<Audience, AudienceContent>>;
  // Whether the `registrants` cohort skips anyone the automated ~2h onboarding
  // nudge (scripts/send-verified-never-paid.mts) has already reached.
  //
  // July needed this: the nudge automation was new, the campaign existed to
  // reach the backlog that predated it, and a same-week second touch would
  // have read as a double-send. It is wrong in steady state — that timer fires
  // every 2 hours over a 2h..7d window, so it stamps essentially every verified
  // signup within hours, and excluding them leaves a cohort of near zero (a
  // live run in August returned 2 recipients against 146 skipped). A campaign
  // reporting six weeks of shipped work is not a second copy of the onboarding
  // nudge, and the two are weeks apart, so August keeps them.
  //
  // Per-campaign rather than removed outright so re-running a past campaign
  // still reproduces the cohort it actually sent to.
  excludeOnboardingNudged: boolean;
};

type Args = {
  campaign: string;
  audience: Audience | null;
  dryRun: boolean;
  send: boolean;
  yes: boolean;
  previewTo: string | null;
  csvPath: string | null;
  limit: number | null;
  days: number;
  // Explicit signup-window floor for the registrant cohort (ISO date). Takes
  // precedence over --days, which is a relative fallback.
  since: string | null;
  // Send the `cancelled` audience even when no win-back coupon is configured
  // (i.e. the discount will be honored by hand instead of at checkout).
  allowMissingCoupon: boolean;
  subject: string | null;
  throttleMs: number;
  listUnsub: boolean;
  help: boolean;
};

const REPLY_TO = 'Michael@zerogex.io';

// Every product-update campaign, newest last. A finished campaign stays
// registered so its cohort can still be counted or re-audited with --campaign.
const CAMPAIGNS: Record<string, CampaignSpec> = {
  '2026-07': {
    key: 'product_update_2026_07',
    excludeOnboardingNudged: true,
    content: {
      subscribers: {
        subject: "What's new at ZeroGEX — and what's coming next",
        html: '2026-07-product-update.html',
        text: '2026-07-product-update.txt',
      },
      registrants: {
        subject: 'Your ZeroGEX account is ready — start with the free levels',
        html: '2026-07-product-update-registrants.html',
        text: '2026-07-product-update-registrants.txt',
      },
    },
  },
  '2026-08': {
    key: 'product_update_2026_08',
    excludeOnboardingNudged: false,
    content: {
      registrants: {
        subject: "What's new at ZeroGEX since you signed up",
        html: '2026-08-product-update-registrants.html',
        text: '2026-08-product-update-registrants.txt',
      },
      cancelled: {
        subject: "What's changed at ZeroGEX since you left",
        html: '2026-08-product-update-cancelled.html',
        text: '2026-08-product-update-cancelled.txt',
      },
    },
  },
};
const DEFAULT_CAMPAIGN = '2026-08';

// The July send used a 30-day signup window. The August campaign targets only
// registrants who arrived SINCE that send, so it passes --since instead.
const DEFAULT_DAYS = 30;
const DEFAULT_THROTTLE_MS = 550; // conservative: ≈1.8 req/s, well under Resend limits

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
    campaign: DEFAULT_CAMPAIGN,
    audience: null,
    dryRun: false,
    send: false,
    yes: false,
    previewTo: null,
    csvPath: null,
    limit: null,
    days: DEFAULT_DAYS,
    since: null,
    allowMissingCoupon: false,
    subject: null,
    throttleMs: DEFAULT_THROTTLE_MS,
    listUnsub: true,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--audience') {
      const v = argv[++i];
      if (v !== 'subscribers' && v !== 'registrants' && v !== 'cancelled') {
        console.error(`Error: --audience must be "subscribers", "registrants" or "cancelled".`);
        process.exit(1);
      }
      args.audience = v;
    } else if (arg === '--campaign') {
      const v = argv[++i] ?? '';
      if (!Object.prototype.hasOwnProperty.call(CAMPAIGNS, v)) {
        console.error(
          `Error: unknown --campaign "${v}". Known: ${Object.keys(CAMPAIGNS).join(', ')}.`,
        );
        process.exit(1);
      }
      args.campaign = v;
    } else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--send') args.send = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--csv') args.csvPath = argv[++i] ?? null;
    else if (arg === '--limit') {
      const v = Number(argv[++i] ?? '');
      if (!Number.isInteger(v) || v <= 0) {
        console.error('Error: --limit expects a positive integer.');
        process.exit(1);
      }
      args.limit = v;
    } else if (arg === '--days') {
      const v = Number(argv[++i] ?? '');
      if (!Number.isFinite(v) || v <= 0) {
        console.error('Error: --days expects a positive number.');
        process.exit(1);
      }
      args.days = v;
    } else if (arg === '--since') {
      const v = argv[++i] ?? '';
      const ts = Date.parse(v);
      if (!Number.isFinite(ts)) {
        console.error('Error: --since expects a parseable date (e.g. 2026-07-20).');
        process.exit(1);
      }
      args.since = new Date(ts).toISOString();
    } else if (arg === '--allow-missing-coupon') args.allowMissingCoupon = true;
    else if (arg === '--subject') args.subject = argv[++i] ?? null;
    else if (arg === '--throttle-ms') {
      const v = Number(argv[++i] ?? '');
      if (!Number.isFinite(v) || v < 0) {
        console.error('Error: --throttle-ms expects a non-negative number.');
        process.exit(1);
      }
      args.throttleMs = v;
    } else if (arg === '--no-list-unsubscribe') args.listUnsub = false;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-product-update.mts \\
    --audience subscribers|registrants|cancelled \\
    [--campaign <id>] [--dry-run] [--preview-to <email>] [--send --yes] \\
    [--limit N] [--days N] [--since <ISO date>] [--subject "..."] \\
    [--throttle-ms N] [--no-list-unsubscribe] [--csv <path>]

Sends a product-update campaign directly, per-recipient, via Resend.
Campaigns: ${Object.keys(CAMPAIGNS)
    .map((c) => (c === DEFAULT_CAMPAIGN ? `${c} (default)` : c))
    .join(', ')}

Modes (default is dry-run — counts only, nothing sent):
      --dry-run                 Print cohort count + sample. No send, no writes.
      --preview-to <email>      Send ONE copy to a test inbox. No DB writes.
      --send --yes              Send to the whole cohort (both flags required).
      --limit N                 With --send: only the first N recipients (test batch).
      --csv <path>              Write the cohort emails to a CSV. No send.
      --days N                  Registrant signup window (default ${DEFAULT_DAYS}).
      --since <ISO date>        Registrant signup floor; overrides --days.
      --allow-missing-coupon    Send 'cancelled' with no win-back coupon set.
      --subject "..."           Override the default subject.
      --throttle-ms N           Delay between sends (default ${DEFAULT_THROTTLE_MS}).
      --no-list-unsubscribe     Omit the List-Unsubscribe header (not recommended).
  -h, --help                    Show this help.

Idempotent: successful sends stamp audit_events(type='<campaign key>_sent'); a
re-run skips anyone already stamped, so an interrupted run resumes cleanly.
The 'cancelled' audience additionally stamps users.winback_email_sent_at, which
is what makes the email's /pricing?winback=1 coupon attach at checkout.`);
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH (sudo apt-get install sqlite3).');
    process.exit(1);
  }
}

function esc(v: string): string {
  return v.replace(/'/g, "''");
}

// The live app writes to this database continuously, and the sqlite3 CLI
// defaults to a ZERO busy timeout: any overlap with the app's writer fails
// immediately with "database is locked (5)" rather than waiting. That aborted
// the August cancelled send at recipient 169 of 193 — after the email had gone
// out — and stranded the remaining 24. `.timeout` makes the CLI wait for the
// lock like every other client does. Passed via -cmd so it applies before the
// SQL, and produces no output of its own (unlike a PRAGMA, which would land a
// row in the -json result below).
const SQLITE_BUSY_TIMEOUT_MS = 15_000;

function sqliteArgs(dbPath: string, extra: string[] = []): string[] {
  return ['-cmd', `.timeout ${SQLITE_BUSY_TIMEOUT_MS}`, ...extra, dbPath];
}

function isLockError(message: string): boolean {
  return /database is locked|database table is locked|busy/i.test(message);
}

// Synchronous pause. execSqlite is sync (it runs inside the send loop's
// bookkeeping), so the async sleep() below is unusable here.
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function querySqlite<T = Record<string, unknown>>(dbPath: string, sql: string): T[] {
  try {
    const out = execFileSync('sqlite3', [...sqliteArgs(dbPath, ['-json']), sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return out ? (JSON.parse(out) as T[]) : [];
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr;
    const message =
      typeof stderr === 'string' ? stderr : stderr?.toString?.() ?? (err as Error).message;
    throw new Error(message.trim() || (err as Error).message);
  }
}

// Retries on top of the busy timeout: the timeout covers a writer that holds
// the lock briefly, the retries cover a WAL checkpoint or a burst of app writes
// that outlasts it. Anything that is not a lock error fails on the first try —
// a malformed statement will not fix itself.
function execSqlite(dbPath: string, sql: string, attempts = 3): void {
  for (let attempt = 1; ; attempt++) {
    try {
      execFileSync('sqlite3', [...sqliteArgs(dbPath), sql], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      return;
    } catch (err) {
      const stderr = (err as { stderr?: Buffer | string }).stderr;
      const message = (
        typeof stderr === 'string' ? stderr : stderr?.toString?.() ?? (err as Error).message
      ).trim();
      if (attempt >= attempts || !isLockError(message)) {
        throw new Error(message || (err as Error).message);
      }
      sleepSync(attempt * 500);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Send one email via Resend REST, retrying on 429 (rate limit) with backoff.
async function sendOne(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    if (res.status === 429 && attempt < 3) {
      await sleep(1000 * Math.pow(2, attempt));
      continue;
    }
    return { ok: false, status: res.status, body: await res.text() };
  }
  return { ok: false, status: 429, body: 'rate limited' };
}

// ---------------------------------------------------------------------------

const cli = parseArgs(process.argv.slice(2));
if (cli.help || !cli.audience) {
  usage();
  process.exit(cli.help ? 0 : 1);
}
const audience = cli.audience;
const campaignSpec = CAMPAIGNS[cli.campaign]!;
const CAMPAIGN = campaignSpec.key;
const content = campaignSpec.content[audience];
if (!content) {
  console.error(
    `Error: campaign ${cli.campaign} has no content for audience "${audience}". ` +
      `Available: ${Object.keys(campaignSpec.content).join(', ')}.`,
  );
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const RESEND_API_KEY = process.env.RESEND_API_KEY || envLocal.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || envLocal.RESEND_FROM_EMAIL || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || 'https://zerogex.io';
// unsubToken.ts reads the signing secret from process.env directly.
if (!process.env.ZEROGEX_END_USER_TOKEN_SECRET && envLocal.ZEROGEX_END_USER_TOKEN_SECRET) {
  process.env.ZEROGEX_END_USER_TOKEN_SECRET = envLocal.ZEROGEX_END_USER_TOKEN_SECRET;
}

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}. Set AUTH_DB_PATH.`);
  process.exit(1);
}
ensureSqlite3Cli();

const docsDir = path.join(cwd, '..', 'docs', 'newsletters');
const htmlPath = path.join(docsDir, content.html);
const textPath = path.join(docsDir, content.text);
for (const p of [htmlPath, textPath]) {
  if (!fs.existsSync(p)) {
    console.error(`Email file not found: ${p}`);
    process.exit(1);
  }
}
const subject = cli.subject || content.subject;

// The cancelled variant promises a discount that only materializes if a
// STRIPE_COUPON_WINBACK_* coupon exists for the plan the member picks — the
// checkout route attaches it, this script only makes them eligible. Sending
// the promise with no coupon configured would be a broken offer, so refuse.
// Mirrors getWinbackCouponId()'s env names in core/stripe.ts.
if (audience === 'cancelled' && !cli.allowMissingCoupon) {
  const couponEnvs = [
    'STRIPE_COUPON_WINBACK_BASIC_MONTHLY',
    'STRIPE_COUPON_WINBACK_BASIC_ANNUAL',
    'STRIPE_COUPON_WINBACK_PRO_MONTHLY',
    'STRIPE_COUPON_WINBACK_PRO_ANNUAL',
  ];
  const missing = couponEnvs.filter((k) => !(process.env[k] || envLocal[k]));
  if (missing.length === couponEnvs.length) {
    console.error(
      '\nError: no win-back coupon configured, but the cancelled email promises 25% off.\n' +
        `Set at least one of: ${couponEnvs.join(', ')}\n` +
        'in frontend/.env.local, or pass --allow-missing-coupon if you are honoring\n' +
        'the discount by hand (scripts/honor-winback-discount.mts).',
    );
    process.exit(1);
  }
  if (missing.length > 0) {
    console.warn(`\nWarning: win-back coupon missing for ${missing.join(', ')}.`);
    console.warn('Members who pick one of those plans will not see the discount.\n');
  }
}

// ---- Cohort selection ------------------------------------------------------

type Row = { id: string; email: string; created_at: string };

let rows: Row[];
let excludedNudged = 0;
if (audience === 'subscribers') {
  rows = querySqlite<Row>(
    dbPath,
    `SELECT id, email, created_at
       FROM users
      WHERE subscription_status IN ('active','trialing')
        AND marketing_unsubscribed_at IS NULL
        AND deleted_at IS NULL
      ORDER BY created_at ASC;`,
  );
} else if (audience === 'cancelled') {
  // Churned members who have NOT already had the automated ~1-month win-back.
  // Deliberately mirrors scripts/send-winback.mts's eligibility (lapsed, no
  // live sub, verified, not an operator, not self-deleted, never win-backed)
  // WITHOUT its churn-age window — a campaign sweeps the standing backlog
  // rather than the handful who newly crossed the 30-day line. The marketing
  // opt-out is added on top because this is a campaign, not a transactional
  // nudge. No audit-event join is needed: the winback_email_sent_at latch,
  // not a churn timestamp, is what defines "not yet reached".
  rows = querySqlite<Row>(
    dbPath,
    `SELECT id, email, created_at
       FROM users
      WHERE COALESCE(subscription_lapsed, 0) = 1
        AND stripe_subscription_id IS NULL
        AND email_verified_at IS NOT NULL
        AND tier != 'admin'
        AND winback_email_sent_at IS NULL
        AND marketing_unsubscribed_at IS NULL
        AND deleted_at IS NULL
      ORDER BY created_at ASC;`,
  );
} else {
  // --since pins the floor to a date (this campaign: the July send, so only
  // registrants who arrived after it qualify); --days is the relative fallback.
  const sinceIso = cli.since ?? new Date(Date.now() - cli.days * 86_400_000).toISOString();
  // Shared by the cohort query and the nudged-count query below, so the two can
  // never drift into reporting on different populations.
  const registrantBase = `email_verified_at IS NOT NULL
        AND tier = 'public'
        AND stripe_subscription_id IS NULL
        AND COALESCE(subscription_lapsed, 0) = 0
        AND (subscription_status IS NULL OR subscription_status NOT IN ('active','trialing'))
        AND marketing_unsubscribed_at IS NULL
        AND deleted_at IS NULL
        AND created_at >= '${esc(sinceIso)}'
        AND EXISTS (SELECT 1 FROM page_view_events pv WHERE pv.user_id = u.id)`;
  rows = querySqlite<Row>(
    dbPath,
    `SELECT id, email, created_at
       FROM users u
      WHERE ${registrantBase}
        ${campaignSpec.excludeOnboardingNudged ? 'AND verified_never_paid_email_sent_at IS NULL' : ''}
      ORDER BY created_at ASC;`,
  );
  // How many of this window already had the ~2h onboarding nudge. When the
  // campaign excludes them it's the size of what we skipped; when it doesn't,
  // it's how much of the cohort is on a second touch. Same population either
  // way, so the number is comparable across campaigns.
  excludedNudged =
    querySqlite<{ n: number }>(
      dbPath,
      `SELECT COUNT(*) AS n
         FROM users u
        WHERE ${registrantBase}
          AND verified_never_paid_email_sent_at IS NOT NULL;`,
    )[0]?.n ?? 0;
}

// Idempotency: which cohort members already received this campaign. Computed
// up front so the dry-run / preview and the actual send all report the same
// "to send" set — and we only ever list the recipients that will get an email.
const alreadySent = new Set(
  querySqlite<{ user_id: string }>(
    dbPath,
    `SELECT user_id FROM audit_events WHERE type = '${CAMPAIGN}_sent';`,
  ).map((r) => r.user_id),
);
const toSend = rows.filter((r) => !alreadySent.has(r.id));
const alreadyCount = rows.length - toSend.length;

console.log(`Auth DB:        ${dbPath}`);
console.log(`Campaign:       ${cli.campaign} (${CAMPAIGN})`);
console.log(`Audience:       ${audience}`);
console.log(`Email:          ${content.html} / ${content.text}`);
console.log(`Subject:        ${subject}`);
if (audience === 'cancelled') {
  console.log(`Cohort rule:    churned, never win-backed (stamps winback_email_sent_at)`);
}
if (audience === 'registrants') {
  console.log(
    cli.since ? `Signup window:  since ${cli.since}` : `Signup window:  last ${cli.days} days`,
  );
  console.log(
    campaignSpec.excludeOnboardingNudged
      ? `Excluded:       ${excludedNudged} already got the ~2h onboarding nudge`
      : `Second touch:   ${excludedNudged} of these already got the ~2h onboarding nudge`,
  );
}
console.log(`Cohort size:    ${rows.length}`);
if (alreadyCount > 0) console.log(`Already emailed: ${alreadyCount} (skipped)`);
console.log(`To send:        ${toSend.length}`);

if (toSend.length === 0) {
  console.log(
    rows.length > 0
      ? '\nEveryone in this cohort has already received this update. Nothing to do.'
      : '\nNothing to do.',
  );
  process.exit(0);
}

// Only list the recipients that will actually get an email.
const SAMPLE = 30;
for (const r of toSend.slice(0, SAMPLE)) console.log(`  - ${r.email} (signed up ${r.created_at})`);
if (toSend.length > SAMPLE) console.log(`  ... and ${toSend.length - SAMPLE} more`);

// ---- CSV export ------------------------------------------------------------

if (cli.csvPath) {
  fs.writeFileSync(cli.csvPath, ['email', ...rows.map((r) => r.email)].join('\n') + '\n', 'utf8');
  console.log(`\nWrote ${rows.length} emails to ${cli.csvPath}`);
}

// ---- Load content ----------------------------------------------------------

// The discount a template promises has to be whatever the configured coupon
// actually grants, and the rate is stated in three places: the Stripe coupon,
// the /pricing welcome-back banner, and the win-back emails. Rather than
// hardcode a percentage into the campaign copy — where it silently rots the
// first time the coupon changes — the cancelled template carries
// {{DISCOUNT_LABEL}} / {{DISCOUNT_SHORT}} and we substitute the SAME
// WINBACK_DISCOUNT_LABEL that scripts/send-winback.mts reads. One value, one
// rate, everywhere.
const DISCOUNT_LABEL =
  process.env.WINBACK_DISCOUNT_LABEL || envLocal.WINBACK_DISCOUNT_LABEL || '';

// Short form for the CTA button and preheader, where the full label reads long:
// the leading "50% off" / "$20 off" when the label starts with one, else a
// rate-free fallback so an unusual label can never render a broken button.
function shortDiscount(label: string): string {
  const m = label.trim().match(/^((?:\d+(?:\.\d+)?\s*%)|(?:[$€£]\s?\d+(?:\.\d+)?))\s*off\b/i);
  return m ? `${m[1].replace(/\s+/g, '')} off` : 'a discount';
}

// Minimal escape: the label is operator-set, not user input, but it lands
// inside markup so a stray & or < would still corrupt the email.
function escapeHtmlText(v: string): string {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

let html = fs.readFileSync(htmlPath, 'utf8');
let text = fs.readFileSync(textPath, 'utf8');

const needsDiscountLabel =
  html.includes('{{DISCOUNT_LABEL}}') ||
  html.includes('{{DISCOUNT_SHORT}}') ||
  text.includes('{{DISCOUNT_LABEL}}') ||
  text.includes('{{DISCOUNT_SHORT}}');

if (needsDiscountLabel) {
  // Refuse rather than fall back to a default. A default is exactly the drift
  // this substitution exists to prevent: it would state a rate nobody chose,
  // against a coupon that may grant something else entirely.
  if (!DISCOUNT_LABEL) {
    console.error(
      '\nError: this email states a discount, but WINBACK_DISCOUNT_LABEL is not set.\n' +
        'Set it in frontend/.env.local to match the configured win-back coupon, e.g.\n' +
        '  WINBACK_DISCOUNT_LABEL="50% off your first year"\n' +
        'The same value is read by scripts/send-winback.mts and the /pricing\n' +
        'welcome-back banner, so all three state one rate.',
    );
    process.exit(1);
  }
  html = html
    .replaceAll('{{DISCOUNT_LABEL}}', escapeHtmlText(DISCOUNT_LABEL))
    .replaceAll('{{DISCOUNT_SHORT}}', escapeHtmlText(shortDiscount(DISCOUNT_LABEL)));
  text = text
    .replaceAll('{{DISCOUNT_LABEL}}', DISCOUNT_LABEL)
    .replaceAll('{{DISCOUNT_SHORT}}', shortDiscount(DISCOUNT_LABEL));
  // Echo what the copy will actually claim, so the rate is reviewed rather than
  // assumed — the whole point of routing it through one env value.
  console.log(
    `Discount copy:  "${DISCOUNT_LABEL}"  (button reads "Come back at ${shortDiscount(DISCOUNT_LABEL)}")`,
  );
}

function buildPayload(to: string, subj: string, unsubUrl: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    from: RESEND_FROM_EMAIL,
    to,
    reply_to: REPLY_TO,
    subject: subj,
    html: html.replaceAll('{{UNSUB_URL}}', unsubUrl),
    text: text.replaceAll('{{UNSUB_URL}}', unsubUrl),
  };
  if (cli.listUnsub) {
    // RFC 8058 one-click: the URL must accept a POST with no auth (route does).
    payload.headers = {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }
  return payload;
}

// ---- Preview to a single inbox --------------------------------------------

if (cli.previewTo) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.error('\nError: RESEND_API_KEY and RESEND_FROM_EMAIL required for --preview-to.');
    process.exit(1);
  }
  console.log(`\nSending a single preview to ${cli.previewTo}...`);
  // Preview uses a tokenless placeholder unsubscribe URL (real sends get a
  // signed per-recipient link).
  const res = await sendOne(
    RESEND_API_KEY,
    buildPayload(cli.previewTo, `[PREVIEW] ${subject}`, `${APP_URL}/unsubscribe`),
  );
  if (!res.ok) {
    console.error(`Preview failed: ${res.status} ${res.body}`);
    process.exit(1);
  }
  console.log('Preview sent.');
  process.exit(0);
}

// ---- Real send -------------------------------------------------------------

if (cli.send) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.error('\nError: RESEND_API_KEY and RESEND_FROM_EMAIL required to send.');
    process.exit(1);
  }
  if (!process.env.ZEROGEX_END_USER_TOKEN_SECRET) {
    console.error('\nError: ZEROGEX_END_USER_TOKEN_SECRET required to sign unsubscribe links.');
    process.exit(1);
  }

  // `toSend` was computed up front (cohort minus already-emailed). Apply --limit.
  const batch = cli.limit ? toSend.slice(0, cli.limit) : toSend;

  console.log(
    `\nWill send to ${batch.length} recipient(s)` +
      (cli.limit && toSend.length > cli.limit
        ? ` (of ${toSend.length} to send; --limit ${cli.limit})`
        : '') +
      `.\nList-Unsubscribe header: ${cli.listUnsub ? 'ON' : 'OFF'}`,
  );

  if (!cli.yes) {
    console.log('\nRefusing to send without --yes. Add --yes to deliver for real.');
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;
  // Delivered, but whose audit/latch write did not land. Reported at the end.
  const unrecorded: string[] = [];
  for (let i = 0; i < batch.length; i++) {
    const user = batch[i];
    const res = await sendOne(
      RESEND_API_KEY,
      buildPayload(user.email, subject, buildUnsubUrl(APP_URL, user.id)),
    );
    if (res.ok) {
      const nowIso = new Date().toISOString();
      const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
      // The cancelled variant IS a win-back, so it claims the same latch the
      // automated sender uses. Two things follow, both intended: the CTA's
      // /pricing?winback=1 coupon becomes attachable for this member (the
      // checkout route requires this column to be set), and the weekly
      // automated win-back will never double-touch them. The Stripe webhook
      // clears it on re-subscribe, so a future re-churn re-qualifies.
      //
      // Both writes go in ONE transaction, so the record of a delivered email
      // is all-or-nothing. Splitting them meant a failure between the two left
      // a member emailed, unlatched and unaudited — re-sent on the next run.
      // One statement is also one lock acquisition instead of two.
      const latchSql =
        audience === 'cancelled'
          ? `UPDATE users SET winback_email_sent_at = '${esc(nowIso)}'
               WHERE id = '${esc(user.id)}' AND winback_email_sent_at IS NULL;`
          : '';
      try {
        execSqlite(
          dbPath,
          `BEGIN IMMEDIATE;
           ${latchSql}
           INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
           VALUES ('${esc(auditId)}', '${CAMPAIGN}_sent', '${esc(user.id)}', NULL,
                   '${esc(user.email)}', 'send-product-update',
                   '${esc(`${audience} product update sent`)}', '${esc(nowIso)}');
           COMMIT;`,
        );
        ok++;
      } catch (err) {
        // The email is already delivered; there is no unsending it. Aborting
        // here would strand every remaining recipient to save one bookkeeping
        // row, so record the miss and keep going. These addresses re-qualify on
        // a re-run and would receive a second copy, which is why they are
        // listed at the end for the operator to reconcile.
        unrecorded.push(user.email);
        console.error(`  UNRECORDED ${user.email}: ${(err as Error).message}`);
        ok++;
      }
    } else {
      fail++;
      if (fail <= 10) console.error(`  FAIL ${user.email}: ${res.status} ${res.body}`);
    }
    if ((i + 1) % 25 === 0) console.log(`  ...${i + 1}/${batch.length} (${ok} ok, ${fail} fail)`);
    if (i < batch.length - 1 && cli.throttleMs > 0) await sleep(cli.throttleMs);
  }

  console.log(`\nDone. ${ok} sent, ${fail} failed.`);
  if (unrecorded.length > 0) {
    console.error(
      `\n${unrecorded.length} email(s) were DELIVERED but not recorded, so a re-run would ` +
        `send them again. Reconcile before re-running:`,
    );
    for (const email of unrecorded) console.error(`  ${email}`);
  }
  process.exit(fail > 0 || unrecorded.length > 0 ? 1 : 0);
}

if (!cli.csvPath) {
  console.log(
    '\n[dry-run] Nothing sent. Next: --preview-to <you> to test one, then ' +
      '--send --yes to deliver (add --limit N first for a small test batch).',
  );
}
