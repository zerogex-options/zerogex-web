#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-grace-expiry-warnings.mts \
//     [--dry-run | --yes] [--lead-hours N] [--min-open-hours N] \
//     [--reason trial|renewal] [--preview-to <email>]
//
// Sends the SECOND dunning touch: a warning ~24h before a member's payment-
// recovery grace window closes and their access drops to the free Public tier.
//
// Why this exists. The dunning flow was a single email. The Stripe webhook
// nudges once, gated on `invoice.attempt_count === 1`, so Smart Retries
// (attempt 2, 3, …) send nothing; and no code path fires when the grace window
// itself runs out — decidePaymentGrace simply stops returning `inGrace` and the
// next subscription sync drops the tier, silently. A member whose card kept
// failing therefore got one email on day 0 and lost access on day 3 having
// heard nothing in between. The default window (BILLING_PAYMENT_GRACE_DAYS=3)
// is also far shorter than Stripe's Smart Retry schedule (~4 attempts over 2-3
// weeks), so members routinely lose access while retries are still running.
//
// Why a sweeper rather than a webhook branch: no Stripe event fires at "24h
// before the window closes". The past_due syncs that do arrive follow Stripe's
// retry schedule, which has nothing to do with graceDays. Same reasoning as the
// cancellation-alert sweeper (docs/automated-emails-audit.md §3.5).
//
// Eligibility (coarse SQL filter, then the pure decision per row):
//   - users.deleted_at IS NULL, subscription_status = 'past_due'
//   - users.payment_grace_started_at IS NOT NULL (a window is anchored)
//   - NOT cancel_at_period_end (they already chose to leave)
//   - decideGraceExpiryWarning() says send: the window is live, has <= LEAD_HOURS
//     left, has been open at least MIN_OPEN_HOURS, and this exact window has not
//     already been warned about.
//
// Side effects on send:
//   - Resend email via core/mailer.ts sendGraceExpiryWarningEmail().
//   - Stamps users.payment_grace_warning_sent_for = the window's own anchor
//     (the once-per-window latch; see core/db.ts).
//   - Writes a `grace_expiry_warning_email_sent` row into audit_events.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';
import { sendGraceExpiryWarningEmail } from '../core/mailer.ts';
import { resolveSubscriptionCard } from '../core/stripeCard.ts';
import {
  decideGraceExpiryWarning,
  DEFAULT_LEAD_HOURS,
  DEFAULT_MIN_OPEN_HOURS,
  type GraceExpiryWarningSkip,
} from '../core/graceExpiryWarning.ts';

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  leadHours: number;
  minOpenHours: number;
  graceDays: number | null;
  reason: 'trial' | 'renewal' | null;
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
    // Match Next.js's dotenv loader: strip a matched pair of surrounding quotes
    // so RESEND_FROM_EMAIL="ZeroGEX <hello@zerogex.com>" stays a valid From
    // header instead of arriving at Resend with literal quotes.
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

function parsePositive(raw: string | undefined, flag: string): number {
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
    leadHours: DEFAULT_LEAD_HOURS,
    minOpenHours: DEFAULT_MIN_OPEN_HOURS,
    graceDays: null,
    reason: null,
    previewTo: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--lead-hours') args.leadHours = parsePositive(argv[++i], '--lead-hours');
    else if (arg === '--min-open-hours') {
      args.minOpenHours = parsePositive(argv[++i], '--min-open-hours');
    } else if (arg === '--grace-days') args.graceDays = parsePositive(argv[++i], '--grace-days');
    else if (arg === '--reason') {
      const value = argv[++i];
      if (value !== 'trial' && value !== 'renewal') {
        console.error(`Error: --reason expects "trial" or "renewal", got "${value}".`);
        process.exit(1);
      }
      args.reason = value;
    } else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-grace-expiry-warnings.mts \\
    [--dry-run | --yes] [--lead-hours N] [--min-open-hours N] \\
    [--reason trial|renewal] [--preview-to <email>]

Warns members whose payment-recovery grace window closes within ~${DEFAULT_LEAD_HOURS}h and
whose card still hasn't cleared, so the deadline is actionable before access
drops to the free Public tier.

Eligibility:
  - deleted_at IS NULL, subscription_status='past_due'
  - payment_grace_started_at IS NOT NULL and the window is still live
  - NOT cancel_at_period_end
  - <= --lead-hours remaining AND >= --min-open-hours since the window opened
  - payment_grace_warning_sent_for != this window's anchor (once-per-window latch)

Options:
      --dry-run             Print who is due and why others are skipped; no
                            email, no DB writes.
  -y, --yes                 Send warnings and stamp the latch.
      --lead-hours N        Warn when <= N hours remain (default ${DEFAULT_LEAD_HOURS}).
      --min-open-hours N    Never warn until the window has been open N hours
                            (default ${DEFAULT_MIN_OPEN_HOURS}), so the warning can't stack on
                            the first dunning email when the window is short.
      --grace-days N        Override the window length instead of reading
                            BILLING_PAYMENT_GRACE_DAYS.
      --reason trial|renewal
                            Only warn one cohort. Default: both.
      --preview-to <email>  Render the warning and send ONE sample copy to
                            <email>. No DB writes.
  -h, --help                Show this help.

Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL and
BILLING_PAYMENT_GRACE_DAYS from env or .env.local. STRIPE_SECRET_KEY (optional)
names the failing card and Stripe's next retry date; without it, warnings still
send minus those details. Set AUTH_DB_PATH to override the default DB path.`);
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
      typeof stderr === 'string' ? stderr : (stderr?.toString?.() ?? (err as Error).message);
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
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || '';
// Optional: used only to name the failing card and Stripe's next retry date.
// Absent key => warnings still send, minus those details.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || envLocal.STRIPE_SECRET_KEY;

if ((cliArgs.yes || cliArgs.previewTo) && (!RESEND_API_KEY || !RESEND_FROM_EMAIL)) {
  console.error('Error: RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send emails.');
  process.exit(1);
}

// mailer.ts reads these lazily inside getClient()/getFromAddress(), so stuffing
// them into process.env after the static import is correct.
if (RESEND_API_KEY) process.env.RESEND_API_KEY = RESEND_API_KEY;
if (RESEND_FROM_EMAIL) process.env.RESEND_FROM_EMAIL = RESEND_FROM_EMAIL;
if (NEXT_PUBLIC_APP_URL) process.env.NEXT_PUBLIC_APP_URL = NEXT_PUBLIC_APP_URL;

// Window length, mirroring core/stripe.ts getPaymentGraceDays (default 3,
// clamped [0,14]). Inlined rather than imported for the same reason mailer.ts
// inlines getAppUrl: core/stripe.ts resolves through the '@/' path alias, which
// is a Next.js compile-time thing and not a Node runtime resolver, so importing
// it here would break this standalone script. core/stripe.ts remains the source
// of truth — keep the clamp in step if it ever changes there.
const DEFAULT_PAYMENT_GRACE_DAYS = 3;
function resolveGraceDays(): number {
  if (cliArgs.graceDays !== null) return cliArgs.graceDays;
  // Keep "unset" distinguishable from "set to something": Number('') is 0, not
  // NaN, so collapsing an absent var to '' would resolve the default 3-day
  // window to 0 and silently make this sweep a no-op on every box that never
  // set the var — the opposite of getPaymentGraceDays, which sees `undefined`,
  // gets NaN, and returns the default.
  const rawEnv = process.env.BILLING_PAYMENT_GRACE_DAYS ?? envLocal.BILLING_PAYMENT_GRACE_DAYS;
  const raw = rawEnv === undefined ? NaN : Number(rawEnv);
  if (!Number.isFinite(raw)) return DEFAULT_PAYMENT_GRACE_DAYS;
  return Math.max(0, Math.min(14, Math.floor(raw)));
}
const graceDays = resolveGraceDays();

if (cliArgs.previewTo) {
  const sampleUntil = new Date(Date.now() + cliArgs.leadHours * 3600_000).toISOString();
  const sampleRetry = new Date(Date.now() + 12 * 3600_000).toISOString();
  console.log(`Sending preview to ${cliArgs.previewTo} (sample deadline ${sampleUntil})...`);
  // Representative data for eyeballing the layout; real sends resolve the card
  // and retry date live from Stripe per user.
  await sendGraceExpiryWarningEmail(cliArgs.previewTo, {
    reason: cliArgs.reason ?? 'trial',
    graceUntilIso: sampleUntil,
    cardBrand: 'Visa',
    cardLast4: '4242',
    nextAttemptIso: sampleRetry,
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

if (graceDays <= 0) {
  console.log(
    'BILLING_PAYMENT_GRACE_DAYS resolves to 0 — grace is disabled, so no window can be open.',
  );
  console.log('Nothing to do.');
  process.exit(0);
}

type UserRow = {
  id: string;
  email: string;
  payment_grace_started_at: string;
  payment_grace_reason: string | null;
  payment_grace_warning_sent_for: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

// Coarse cohort filter only — the timing decision itself lives in
// core/graceExpiryWarning so it is unit-tested rather than expressed as SQL date
// arithmetic. The cohort is inherently tiny (members currently in past_due with
// an open window), so evaluating the predicate per row costs nothing.
const reasonFilter =
  cliArgs.reason === 'trial'
    ? "AND payment_grace_reason = 'trial'"
    : cliArgs.reason === 'renewal'
      ? // NULL reason = a window opened before payment_grace_reason existed.
        // Monitoring counts those with the established payers, so the renewal
        // filter includes them for consistency.
        "AND (payment_grace_reason = 'renewal' OR payment_grace_reason IS NULL)"
      : '';

const candidates = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, payment_grace_started_at, payment_grace_reason,
          payment_grace_warning_sent_for, stripe_customer_id, stripe_subscription_id
   FROM users
   WHERE deleted_at IS NULL
     AND subscription_status = 'past_due'
     AND payment_grace_started_at IS NOT NULL
     -- Someone who already clicked Cancel has chosen to leave; a "fix your card
     -- to keep your access" warning is noise to them. Same exclusion the
     -- trial-end reminder makes for the same reason.
     AND COALESCE(cancel_at_period_end, 0) = 0
     ${reasonFilter}
   ORDER BY payment_grace_started_at ASC;`,
);

const nowMs = Date.now();
type Due = { user: UserRow; graceUntilIso: string; hoursRemaining: number };
const due: Due[] = [];
const skipped = new Map<GraceExpiryWarningSkip, number>();

for (const user of candidates) {
  const decision = decideGraceExpiryWarning({
    graceStartedAt: user.payment_grace_started_at,
    graceDays,
    warnedFor: user.payment_grace_warning_sent_for,
    nowMs,
    leadHours: cliArgs.leadHours,
    minOpenHours: cliArgs.minOpenHours,
  });
  if (decision.send && decision.graceUntilIso) {
    due.push({
      user,
      graceUntilIso: decision.graceUntilIso,
      hoursRemaining: decision.hoursRemaining ?? 0,
    });
  } else if (decision.skip) {
    skipped.set(decision.skip, (skipped.get(decision.skip) ?? 0) + 1);
  }
}

// A window that ran out before anyone warned about it means the sweep is not
// running often enough — an operational problem, not a quiet no-op, so it gets
// its own line rather than being buried in the skip tally. Members who WERE
// warned and whose window has since closed count as 'already-warned', not here
// (see core/graceExpiryWarning), so any number on this line is a real miss.
const elapsedCount = skipped.get('window-elapsed') ?? 0;

console.log(`Auth DB:          ${dbPath}`);
console.log(`Grace days:       ${graceDays}`);
console.log(`Lead / min open:  ${cliArgs.leadHours}h / ${cliArgs.minOpenHours}h`);
console.log(`Cohort filter:    ${cliArgs.reason ?? 'trial + renewal'}`);
console.log(`In grace:         ${candidates.length}`);
console.log(`Due to warn:      ${due.length}`);
if (skipped.size > 0) {
  const parts = [...skipped.entries()].map(([reason, count]) => `${reason}=${count}`);
  console.log(`Skipped:          ${parts.join(', ')}`);
}
if (elapsedCount > 0) {
  // Deliberately not phrased as "watch whether this falls": a missed window
  // stays missed. The anchor persists while the subscription is past_due, so
  // these members keep reporting until they recover or churn.
  console.warn(
    `\nWarning: ${elapsedCount} member(s) lost their grace window with no warning ever sent.` +
      '\n         Each one is a member who dropped to Public with no heads-up. Anything above' +
      '\n         zero means this sweep ran less often than the window is long — tighten the' +
      '\n         timer cadence (or --lead-hours) so the next cohort is caught in time.',
  );
}

for (const item of due) {
  const reason = item.user.payment_grace_reason ?? 'renewal (unattributed)';
  console.log(
    `  - ${item.user.email}: ${item.hoursRemaining}h left (ends ${item.graceUntilIso}) [${reason}]`,
  );
}

if (due.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No emails sent, no DB writes.');
  process.exit(0);
}

if (!cliArgs.yes) {
  console.log(
    '\nRefusing to send without --yes. Re-run with --yes to deliver, or --dry-run to preview.',
  );
  process.exit(1);
}

// Best-effort Stripe enrichment. Stripe is optional plumbing here: without the
// key we warn once and send every warning without the card/retry details rather
// than blocking the run — the deadline matters more than the trimmings. A
// per-user lookup failure is handled the same way inside the loop.
const stripe: Stripe | null = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
if (!stripe) {
  console.warn(
    '\nWarning: STRIPE_SECRET_KEY is not set — warnings will send WITHOUT naming the card or the next retry date.',
  );
}

// The failing card and Stripe's next automatic retry, read live off the
// subscription. Both are optional: the copy degrades to neutral wording for a
// missing card, and to "final automatic attempt" for a missing retry date —
// which is also the truthful reading when Stripe has exhausted its schedule.
//
// The card comes from the shared resolveSubscriptionCard so this warning names a
// card exactly as the first dunning nudge did (same resolution order, same
// display-ready brand labels). That costs a second subscription retrieve on top
// of the latest_invoice read below; at this cohort's size — members currently
// inside a grace window — that is a rounding error next to having two emails
// about one failure disagree about which card failed.
async function resolveRetryDetails(
  client: Stripe,
  subscriptionId: string | null,
  customerId: string | null,
): Promise<{ cardBrand: string | null; cardLast4: string | null; nextAttemptIso: string | null }> {
  if (!subscriptionId) return { cardBrand: null, cardLast4: null, nextAttemptIso: null };

  const card = await resolveSubscriptionCard(client, subscriptionId, customerId);

  // next_payment_attempt lives on the open invoice, not the subscription.
  const sub = await client.subscriptions.retrieve(subscriptionId, {
    expand: ['latest_invoice'],
  });
  const invoice = sub.latest_invoice;
  const nextAttemptIso =
    invoice && typeof invoice === 'object' && typeof invoice.next_payment_attempt === 'number'
      ? new Date(invoice.next_payment_attempt * 1000).toISOString()
      : null;

  return { cardBrand: card?.brand ?? null, cardLast4: card?.last4 ?? null, nextAttemptIso };
}

let successCount = 0;
let failCount = 0;

for (const { user, graceUntilIso } of due) {
  try {
    let details: {
      cardBrand: string | null;
      cardLast4: string | null;
      nextAttemptIso: string | null;
    } = { cardBrand: null, cardLast4: null, nextAttemptIso: null };
    if (stripe) {
      try {
        details = await resolveRetryDetails(
          stripe,
          user.stripe_subscription_id,
          user.stripe_customer_id,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        console.warn(
          `  WARN ${user.email}: could not resolve Stripe card/retry details (${message}); sending without them.`,
        );
      }
    }

    // A window opened before payment_grace_reason existed reads as NULL. Fall
    // back to the renewal framing rather than guessing 'trial': telling an
    // established payer their "free trial has ended" would be plainly false,
    // whereas the renewal wording is at worst generic for a trialer. Same
    // convention monitoring uses for unattributed windows.
    const reason = user.payment_grace_reason === 'trial' ? 'trial' : 'renewal';

    await sendGraceExpiryWarningEmail(user.email, {
      reason,
      graceUntilIso,
      cardBrand: details.cardBrand,
      cardLast4: details.cardLast4,
      nextAttemptIso: details.nextAttemptIso,
    });

    const nowIso = new Date().toISOString();
    // Stamp the latch FIRST so a partial run that crashes after some sends
    // doesn't re-warn anyone who already received. The latch is keyed to the
    // window's own anchor, so it is the source of truth for idempotency; the
    // audit row below is best-effort.
    execSqlite(
      dbPath,
      `UPDATE users
       SET payment_grace_warning_sent_for = '${escapeSqlLiteral(user.payment_grace_started_at)}',
           updated_at = '${escapeSqlLiteral(nowIso)}'
       WHERE id = '${escapeSqlLiteral(user.id)}';`,
    );

    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    execSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         'grace_expiry_warning_email_sent',
         '${escapeSqlLiteral(user.id)}',
         NULL,
         '${escapeSqlLiteral(user.email)}',
         'cron-script',
         '${escapeSqlLiteral(
           `Grace-expiry warning sent (${reason}); window ${user.payment_grace_started_at} ends ${graceUntilIso}`,
         )}',
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
