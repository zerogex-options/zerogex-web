#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --no-warnings scripts/churn-breakdown.mjs [--window <days>] [--since <date>] [--csv]
//
// WHY THIS EXISTS: the admin dashboard tells you cancellations spiked, but not
// what KIND of cancellation. A trial user bailing before the first charge (a
// conversion problem) and an established Pro member leaving (a value/positioning
// problem) both show up as one "cancel" bar — and they need opposite fixes. This
// script decomposes recent cancellations along the axes that separate them:
//
//   • Type      trial-abandon (pending, still trialing — never charged)
//               paid-cancel   (pending, active/past_due — clicked Cancel, still has access)
//               lapsed        (subscription actually ended)
//   • Tier      pro / basic (recovered from the last paid sync for lapsed rows,
//               whose live tier has already been reset to public)
//   • Tenure    days from signup to cancel — a tight cluster near the trial
//               length is the fingerprint of a trial-end cliff
//   • Source    signup_utm_source — a single bad-fit acquisition channel
//   • Reason    the Stripe cancellation survey (cancel_feedback / cancel_comment),
//               once captured — see core/cancellationReason.ts + the Stripe webhook
//
// It reads the same auth.db as scripts/list-cancellations.mjs and is read-only.
// Default window is the trailing 14 days (where the recent spike lives); widen
// with --window <days> or pin a cutoff with --since <YYYY-MM-DD>.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// --- reason parsing (kept in lockstep with core/cancellationReason.ts) --------
// Duplicated here as two regexes rather than imported so this stays a plain,
// dependency-free .mjs like its sibling list-cancellations.mjs. If the audit
// token format changes in core/cancellationReason.ts, mirror it here.
function parseReason(message) {
  const feedback = message.match(/\bcancel_feedback=([a-z_]+)/)?.[1] ?? null;
  const commentRaw = message.match(/\bcancel_comment="([^"]*)"/)?.[1]?.trim() ?? null;
  return { feedback, comment: commentRaw && commentRaw.length > 0 ? commentRaw : null };
}
const FEEDBACK_LABELS = {
  too_expensive: 'Too expensive',
  missing_features: 'Missing features',
  switched_service: 'Switched service',
  unused: "Wasn't using it",
  customer_service: 'Customer service',
  too_complex: 'Too complex / hard to use',
  low_quality: 'Low quality',
  other: 'Other',
};
const feedbackLabel = (f) =>
  !f ? 'No reason given' : FEEDBACK_LABELS[f] ??
    f.split('_').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// --- env / args ---------------------------------------------------------------
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, eq).trim()] = value;
  }
  return env;
}

function parseArgs(argv) {
  const args = { window: 14, since: null, csv: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--window' || arg === '--days') args.window = Number(argv[++i]);
    else if (arg === '--since') args.since = argv[++i] ?? null;
    else if (arg === '--csv') args.csv = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --no-warnings scripts/churn-breakdown.mjs [--window <days>] [--since <date>] [--csv]

Decomposes recent cancellations to tell apart trial abandons (conversion
problem) from established paid churn (value/positioning problem), and surfaces
tenure, acquisition source, and captured cancel reasons.

Options:
  --window <days>   Trailing window to analyze (default 14).
  --since <date>    Analyze cancellations on/after this cutoff (YYYY-MM-DD or
                    ISO). Overrides --window.
  --csv             Emit one row per cancel with derived columns instead of the
                    summary: email,type,tier,days_since_signup,source,feedback,comment,cancelled_at
  -h, --help        Show this help.

Reads AUTH_DB_PATH from env or .env.local (default frontend/data/auth.db).
Read-only.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}
if (!Number.isFinite(args.window) || args.window <= 0) {
  console.error('Error: --window must be a positive number of days.');
  process.exit(1);
}

let cutoffMs;
if (args.since) {
  const parsed = Date.parse(args.since);
  if (!Number.isFinite(parsed)) {
    console.error(`Error: --since "${args.since}" is not a parseable date (try YYYY-MM-DD).`);
    process.exit(1);
  }
  cutoffMs = parsed;
} else {
  cutoffMs = Date.now() - args.window * 86400_000;
}
const cutoffLabel = new Date(cutoffMs).toISOString().slice(0, 10);

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

const userCols = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
const requiredCols = [
  'cancel_at_period_end',
  'subscription_lapsed',
  'cancel_ack_email_sent_at',
  'subscription_status',
  'created_at',
  'tier',
];
const missing = requiredCols.filter((c) => !userCols.has(c));
if (missing.length > 0) {
  console.error(`Auth DB at ${dbPath} is missing columns: ${missing.join(', ')}.`);
  console.error('Boot the app once so core/db.ts migrations run, then re-run this script.');
  process.exit(1);
}
const hasUtm = userCols.has('signup_utm_source');
const hasAuditEvents = !!db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_events'")
  .get();

// Latest churn instant + a best-effort recovered paid tier per lapsed user.
// clearSubscriptionFromUser resets tier→public and price→NULL, so a lapsed
// row's own columns no longer say what tier it was; recover it from the last
// paid stripe_subscription_sync. Also grab the most recent reason-bearing
// churn audit message per user for the reason columns.
const churnedAtByUser = new Map();
const recoveredTierByUser = new Map();
const lastStatusByUser = new Map();
const reasonByUser = new Map();
const paymentFailedUsers = new Set();
if (hasAuditEvents) {
  for (const r of db
    .prepare(
      `SELECT user_id, MAX(created_at) AS churned_at FROM audit_events
       WHERE type = 'stripe_subscription_deleted' AND user_id IS NOT NULL
       GROUP BY user_id`,
    )
    .all()) {
    if (r.user_id && r.churned_at) churnedAtByUser.set(r.user_id, r.churned_at);
  }

  // Last paid tier + last Stripe status seen per sub-owner (scan ascending, so
  // the newest wins). The last status before a deletion is what distinguishes an
  // involuntary loss (died in dunning: past_due/unpaid) from a voluntary/expiry
  // one — the same rule core/subscriptionFlow.ts uses.
  for (const r of db
    .prepare(
      `SELECT user_id, message FROM audit_events
       WHERE type = 'stripe_subscription_sync' AND user_id IS NOT NULL
       ORDER BY created_at ASC`,
    )
    .all()) {
    const t = r.message.match(/\btier=(\w+)/)?.[1];
    if (t === 'pro' || t === 'elite') recoveredTierByUser.set(r.user_id, 'pro');
    else if (t === 'basic' || t === 'starter') recoveredTierByUser.set(r.user_id, 'basic');
    const st = r.message.match(/\bstatus=([a-z_]+)/)?.[1];
    if (st) lastStatusByUser.set(r.user_id, st);
  }

  // Users who ever hit a payment failure — a secondary confirmation that a lapse
  // was involuntary even if the last synced status didn't land on dunning.
  for (const r of db
    .prepare(
      `SELECT DISTINCT user_id FROM audit_events
       WHERE type = 'stripe_payment_failed' AND user_id IS NOT NULL
         AND created_at > datetime('now', '-120 days')`,
    )
    .all()) {
    if (r.user_id) paymentFailedUsers.add(r.user_id);
  }

  // Most recent reason-bearing churn message per user (a cancel-click or a
  // deletion). Ascending scan lets the newest overwrite older ones.
  for (const r of db
    .prepare(
      `SELECT user_id, message FROM audit_events
       WHERE type IN ('stripe_cancellation_requested', 'stripe_subscription_deleted')
         AND user_id IS NOT NULL
       ORDER BY created_at ASC`,
    )
    .all()) {
    const parsed = parseReason(r.message);
    if (parsed.feedback || parsed.comment) reasonByUser.set(r.user_id, parsed);
  }
}

const rows = db
  .prepare(
    `SELECT id, email, tier, cancel_at_period_end, subscription_lapsed,
            cancel_ack_email_sent_at, subscription_status, created_at
            ${hasUtm ? ', signup_utm_source' : ''}
     FROM users
     WHERE COALESCE(subscription_lapsed, 0) = 1 OR COALESCE(cancel_at_period_end, 0) = 1`,
  )
  .all();

const TRIAL_STATUSES = new Set(['trialing']);
const PAID_STATUSES = new Set(['active', 'past_due', 'unpaid']);
const DUNNING_STATUSES = new Set(['past_due', 'unpaid']);

function classify(row) {
  // lapsed (terminal) wins if a row somehow carries both flags.
  if (Number(row.subscription_lapsed) === 1) return 'lapsed';
  if (Number(row.cancel_at_period_end) === 1) {
    if (TRIAL_STATUSES.has(row.subscription_status)) return 'trial-abandon';
    if (PAID_STATUSES.has(row.subscription_status)) return 'paid-cancel';
    return 'paid-cancel'; // clicked cancel with an odd status — still a click
  }
  return null;
}

const records = rows
  .map((row) => {
    const type = classify(row);
    if (!type) return null;
    const cancelledAt =
      type === 'lapsed'
        ? churnedAtByUser.get(row.id) ?? null
        : row.cancel_ack_email_sent_at ?? null;
    // Live tier is authoritative while access is retained (pending); a lapsed
    // row's tier was reset to public, so fall back to the recovered paid tier.
    let tier = row.tier;
    if (type === 'lapsed' || tier === 'public' || !tier) {
      tier = recoveredTierByUser.get(row.id) ?? 'unknown';
    }
    const createdMs = row.created_at ? Date.parse(row.created_at) : NaN;
    const cancelledMs = cancelledAt ? Date.parse(cancelledAt) : NaN;
    const daysSinceSignup =
      Number.isFinite(createdMs) && Number.isFinite(cancelledMs)
        ? Math.max(0, Math.floor((cancelledMs - createdMs) / 86400_000))
        : null;
    const source = (hasUtm ? row.signup_utm_source : null) || 'organic/direct';
    const reason = reasonByUser.get(row.id) ?? { feedback: null, comment: null };
    // Why a lapsed sub died: involuntary (died in dunning / had a payment
    // failure) vs voluntary/expired (cancelled or a trial that simply ran out).
    // A pending cancel-click (trial-abandon / paid-cancel) is voluntary by
    // definition. This split is the fork in the fix: billing/dunning vs the
    // trial experience.
    let cause;
    if (type === 'lapsed') {
      const involuntary =
        DUNNING_STATUSES.has(lastStatusByUser.get(row.id)) || paymentFailedUsers.has(row.id);
      cause = involuntary ? 'payment-failed' : 'voluntary/expired';
    } else {
      cause = 'voluntary';
    }
    return {
      email: String(row.email ?? ''),
      type,
      tier,
      daysSinceSignup,
      source,
      cause,
      feedback: reason.feedback,
      comment: reason.comment,
      cancelledAt,
      cancelledMs,
    };
  })
  .filter(Boolean)
  // A --since / --window cutoff is strict: a row whose cancellation date can't
  // be established can't be proven in-window, so exclude it.
  .filter((rec) => Number.isFinite(rec.cancelledMs) && rec.cancelledMs >= cutoffMs);

records.sort((a, b) => b.cancelledMs - a.cancelledMs);

// --- CSV mode -----------------------------------------------------------------
if (args.csv) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  console.log('email,type,tier,cause,days_since_signup,source,feedback,comment,cancelled_at');
  for (const r of records) {
    console.log(
      [r.email, r.type, r.tier, r.cause, r.daysSinceSignup ?? '', r.source, r.feedback ?? '', r.comment ?? '', r.cancelledAt ?? '']
        .map(esc)
        .join(','),
    );
  }
  process.exit(0);
}

// --- summary mode -------------------------------------------------------------
function tally(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
const pct = (n) => (records.length ? `${Math.round((n / records.length) * 100)}%` : '0%');
function bar(n, max, width = 24) {
  if (max <= 0) return '';
  return '█'.repeat(Math.max(n > 0 ? 1 : 0, Math.round((n / max) * width)));
}
function printTally(title, entries, labelFn = (k) => k) {
  console.log(`\n${title}`);
  if (entries.length === 0) {
    console.log('  (none)');
    return;
  }
  const max = Math.max(...entries.map((e) => e[1]));
  const labelW = Math.max(...entries.map((e) => labelFn(e[0]).length), 4);
  for (const [k, n] of entries) {
    console.log(`  ${labelFn(k).padEnd(labelW)}  ${String(n).padStart(4)} ${pct(n).padStart(4)}  ${bar(n, max)}`);
  }
}

console.log(`Auth DB: ${dbPath}`);
console.log(`Window:  cancellations on/after ${cutoffLabel}` + (args.since ? '' : `  (last ${args.window} days)`));
console.log(`Total cancellations in window: ${records.length}`);

if (records.length === 0) {
  console.log('\nNo cancellations in this window. Widen with --window <days> or --since <date>.');
  process.exit(0);
}

const byType = tally(records, (r) => r.type);
const trialAbandon = records.filter((r) => r.type === 'trial-abandon').length;
const paidCancel = records.filter((r) => r.type === 'paid-cancel').length;
const lapsedRecords = records.filter((r) => r.type === 'lapsed');
const lapsed = lapsedRecords.length;
printTally('By type:', byType);

// Of the terminal lapses, split billing-driven (recoverable) from voluntary/
// expiry (a trial-experience problem). This is the fork in the fix.
const lapsedInvoluntary = lapsedRecords.filter((r) => r.cause === 'payment-failed').length;
const lapsedVoluntary = lapsed - lapsedInvoluntary;
if (lapsed > 0) {
  console.log(`\nWhy lapsed subs died (of ${lapsed}):`);
  const max = Math.max(lapsedInvoluntary, lapsedVoluntary);
  const line = (label, n) =>
    console.log(`  ${label.padEnd(24)}  ${String(n).padStart(4)} ${(lapsed ? Math.round((n / lapsed) * 100) + '%' : '0%').padStart(4)}  ${bar(n, max)}`);
  line('payment-failed', lapsedInvoluntary);
  line('voluntary/expired', lapsedVoluntary);
}

printTally('By tier:', tally(records, (r) => r.tier), (t) => t.charAt(0).toUpperCase() + t.slice(1));

// Tenure histogram — the trial-cliff detector.
const TENURE_BUCKETS = [
  ['0–2d', (d) => d <= 2],
  ['3–7d', (d) => d >= 3 && d <= 7],
  ['8–14d', (d) => d >= 8 && d <= 14],
  ['15–30d', (d) => d >= 15 && d <= 30],
  ['31–90d', (d) => d >= 31 && d <= 90],
  ['90d+', (d) => d > 90],
];
const tenureEntries = TENURE_BUCKETS.map(([label, pred]) => [
  label,
  records.filter((r) => r.daysSinceSignup !== null && pred(r.daysSinceSignup)).length,
]).filter((e) => e[1] > 0);
const unknownTenure = records.filter((r) => r.daysSinceSignup === null).length;
if (unknownTenure > 0) tenureEntries.push(['unknown', unknownTenure]);
printTally('Tenure at cancel (signup → cancel):', tenureEntries);

printTally('By signup source:', tally(records, (r) => r.source));

// Daily timeline of the cancellations, oldest→newest, so the spike shape shows.
const byDay = tally(records, (r) => (r.cancelledAt ? r.cancelledAt.slice(0, 10) : 'unknown')).sort(
  (a, b) => (a[0] < b[0] ? -1 : 1),
);
printTally('Daily cancellations:', byDay);

// Captured reasons.
const withReason = records.filter((r) => r.feedback || r.comment);
printTally(
  `Cancel reasons (captured on ${withReason.length} of ${records.length}):`,
  tally(records, (r) => r.feedback || 'none'),
  feedbackLabel,
);
const comments = records.filter((r) => r.comment);
if (comments.length > 0) {
  console.log('\nRecent free-text comments:');
  for (const r of comments.slice(0, 10)) {
    console.log(`  ${(r.cancelledAt ?? '').slice(0, 10)} · ${r.tier} · ${r.email}`);
    console.log(`    "${r.comment}"`);
  }
}

// --- interpretation heuristics ------------------------------------------------
const flags = [];
const clickCancels = trialAbandon + paidCancel;
if (clickCancels > 0 && trialAbandon / clickCancels >= 0.6) {
  flags.push(
    `Trial-heavy: ${trialAbandon}/${clickCancels} pending cancels are trials abandoning before first charge — a CONVERSION/onboarding problem, not paid churn.`,
  );
}
if (clickCancels > 0 && paidCancel / clickCancels >= 0.6) {
  flags.push(
    `Established-heavy: ${paidCancel}/${clickCancels} pending cancels are paying members — a VALUE/positioning problem. Read the reasons and comments above.`,
  );
}
const cliff = records.filter((r) => r.daysSinceSignup !== null && r.daysSinceSignup >= 3 && r.daysSinceSignup <= 9).length;
if (records.length >= 5 && cliff / records.length >= 0.4) {
  flags.push(
    `Trial-end cliff: ${cliff}/${records.length} cancels cluster at 3–9 days' tenure — consistent with a trial cohort hitting trial-end together. Check trial length + the ~48h pre-trial-end nudge.`,
  );
}
if (lapsed >= 5 && lapsedVoluntary / lapsed >= 0.6) {
  flags.push(
    `Voluntary/expiry-driven: ${lapsedVoluntary}/${lapsed} lapses had NO payment failure — trials reaching end without converting (or clean cancels). Fix the TRIAL EXPERIENCE: card-on-file at trial start, the ~48h pre-trial-end nudge (make trial-reminders), and time-to-first-value. The cancel survey won't explain these (an expiring trial never opens the portal).`,
  );
}
if (lapsed >= 5 && lapsedInvoluntary / lapsed >= 0.4) {
  flags.push(
    `Payment-driven: ${lapsedInvoluntary}/${lapsed} lapses followed a failed charge — a BILLING/dunning problem (recoverable revenue). Trial-conversion charges get NO grace window; consider extending grace to trial conversions or adding trial dunning + card-update nudges.`,
  );
}
const topSource = tally(records, (r) => r.source)[0];
if (topSource && topSource[0] !== 'organic/direct' && topSource[1] / records.length >= 0.4) {
  flags.push(
    `Channel concentration: ${topSource[1]}/${records.length} cancels came from signup source "${topSource[0]}" — a bad-fit acquisition channel is a candidate.`,
  );
}
if (withReason.length === 0) {
  flags.push(
    'No cancel reasons captured yet. Enable the Stripe billing-portal cancellation survey (make enable-portal-cancel-reasons) so future cancels record a why.',
  );
}
const proChurn = records.filter((r) => r.tier === 'pro').length;
if (records.length >= 5 && proChurn / records.length >= 0.6) {
  flags.push(`Pro-concentrated: ${proChurn}/${records.length} cancels are Pro-tier — churn is where your revenue is.`);
}

console.log('\nRead:');
if (flags.length === 0) {
  console.log('  No single pattern dominates — scan the tables above and the CSV (--csv) for outliers.');
} else {
  for (const f of flags) console.log(`  • ${f}`);
}
console.log('');
console.log('Tip: --csv for per-user rows; pair with `make diagnose-user EMAIL=<email>` to drill in,');
console.log('     or `make cancellations STATUS=pending` for the still-recoverable list.');
