#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --no-warnings scripts/list-cancellations.mjs \
//     [--status <pending|lapsed>] [--emails | --csv] [--since <date>]
//
// Lists every customer who has cancelled, and when. There are two distinct
// cancellation states, both surfaced here:
//
//   pending  — users.cancel_at_period_end = 1. The customer clicked "Cancel"
//              but the subscription is still live and they keep access until
//              users.current_period_end. "Cancelled" is the moment they clicked,
//              read from users.cancel_ack_email_sent_at (stamped on the 0->1
//              transition by the Stripe webhook; app/api/webhooks/stripe/
//              route.ts maybeHandleCancelAckTransition). "Access ends" is
//              current_period_end.
//   lapsed   — users.subscription_lapsed = 1. The subscription actually ended
//              (customer.subscription.deleted) and the tier was reset to public.
//              "Cancelled" is the MAX(created_at) of that user's
//              'stripe_subscription_deleted' audit_events rows — the same anchor
//              scripts/send-winback.mts keys the win-back window off, so a user
//              who churned, returned, and churned again is dated by their LATEST
//              departure. "Access ends" is that same instant (already gone).
//
// Only CURRENT cancellations are shown: a customer who churned and later
// re-subscribed had subscription_lapsed cleared back to 0 by the webhook
// (maybeSendPaidWelcomeEmail), so they drop off this list. The full historical
// trail lives in audit_events ('stripe_subscription_deleted' /
// 'cancellation_ack_email_sent') if you need every past cancellation.
//
// The two states are mutually exclusive in practice: clearSubscriptionFromUser
// resets cancel_at_period_end to 0 when it sets subscription_lapsed = 1, so a
// lapsed user is never also pending. If a row somehow carries both, lapsed
// (the terminal state) wins.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const VALID_STATUS = new Set(['pending', 'lapsed']);

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
  const args = { status: null, emails: false, csv: false, since: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--status') args.status = (argv[++i] ?? '').trim().toLowerCase();
    else if (arg === '--emails') args.emails = true;
    else if (arg === '--csv') args.csv = true;
    else if (arg === '--since') args.since = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --no-warnings scripts/list-cancellations.mjs \\
    [--status <pending|lapsed>] [--emails | --csv] [--since <date>]

Lists every customer whose subscription is currently cancelled, and when they
cancelled. Two states are reported:

  pending   Clicked Cancel; still has access until their current period ends
            (users.cancel_at_period_end = 1). "Cancelled" = the click moment;
            "Access ends" = current_period_end.
  lapsed    Subscription actually ended and tier was reset to public
            (users.subscription_lapsed = 1). "Cancelled" = the latest
            'stripe_subscription_deleted' audit event.

Rows are sorted most-recent cancellation first. Only current cancellations are
shown; a customer who churned and re-subscribed is no longer listed.

Modes:
  (default)             Table: User ID, Email, Status, Cancelled (date),
                        Access ends (date), Tier.
  --emails              Print matching emails only, one per line (paste-ready
                        for a mailer). Honors --status / --since.
  --csv                 CSV to stdout with full ISO timestamps:
                        id,email,status,cancelled_at,access_ends_at,tier

Filters:
  --status <pending|lapsed>   Restrict to one state (default: both).
  --since <date>              Only cancellations on/after the cutoff. Accepts
                              YYYY-MM-DD or any ISO 8601 timestamp. Rows with an
                              unknown cancellation date are excluded when set.

Reads AUTH_DB_PATH from env or .env.local (default frontend/data/auth.db).`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}
if (args.status && !VALID_STATUS.has(args.status)) {
  console.error(`Error: --status "${args.status}" is not one of ${[...VALID_STATUS].join(', ')}.`);
  process.exit(1);
}
if (args.emails && args.csv) {
  console.error('Error: --emails and --csv are mutually exclusive.');
  process.exit(1);
}

let sinceMs = null;
if (args.since) {
  const parsed = Date.parse(args.since);
  if (!Number.isFinite(parsed)) {
    console.error(`Error: --since "${args.since}" is not a parseable date (try YYYY-MM-DD).`);
    process.exit(1);
  }
  sinceMs = parsed;
}

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

// Every column read below was added by an ensureColumn migration in core/db.ts
// at boot. Bail clearly on a pre-migration DB instead of crashing mid-query.
const userCols = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
const requiredCols = [
  'cancel_at_period_end',
  'subscription_lapsed',
  'current_period_end',
  'cancel_ack_email_sent_at',
  'stripe_subscription_id',
  'subscription_status',
];
const missing = requiredCols.filter((c) => !userCols.has(c));
if (missing.length > 0) {
  console.error(`Auth DB at ${dbPath} is missing columns: ${missing.join(', ')}.`);
  console.error('Boot the app once so core/db.ts migrations run, then re-run this script.');
  process.exit(1);
}

// Latest churn instant per user. This is the authoritative "when the
// subscription ended" timestamp — clearSubscriptionFromUser writes exactly one
// 'stripe_subscription_deleted' row per customer.subscription.deleted, and MAX
// picks the most recent for repeat churners. Absent audit_events (older DBs)
// just means lapsed rows show no date rather than crashing.
const churnedAtByUser = new Map();
const hasAuditEvents = !!db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_events'")
  .get();
if (hasAuditEvents) {
  const churnRows = db
    .prepare(
      `SELECT user_id, MAX(created_at) AS churned_at
       FROM audit_events
       WHERE type = 'stripe_subscription_deleted' AND user_id IS NOT NULL
       GROUP BY user_id`,
    )
    .all();
  for (const r of churnRows) {
    if (r.user_id && r.churned_at) churnedAtByUser.set(r.user_id, r.churned_at);
  }
}

const rows = db
  .prepare(
    `SELECT id, email, tier, cancel_at_period_end, subscription_lapsed,
            current_period_end, cancel_ack_email_sent_at, stripe_subscription_id,
            subscription_status
     FROM users
     WHERE COALESCE(subscription_lapsed, 0) = 1
        OR COALESCE(cancel_at_period_end, 0) = 1`,
  )
  .all();

// lapsed (terminal) wins if a row somehow carries both flags.
function classify(row) {
  if (Number(row.subscription_lapsed) === 1) return 'lapsed';
  if (Number(row.cancel_at_period_end) === 1) return 'pending';
  return null;
}

const records = rows
  .map((row) => {
    const status = classify(row);
    if (!status) return null;
    const cancelledAt =
      status === 'lapsed'
        ? churnedAtByUser.get(row.id) ?? null
        : row.cancel_ack_email_sent_at ?? null;
    const accessEndsAt =
      status === 'lapsed' ? churnedAtByUser.get(row.id) ?? null : row.current_period_end ?? null;
    return {
      id: String(row.id ?? ''),
      email: String(row.email ?? ''),
      tier: row.tier || 'public',
      status,
      cancelledAt,
      accessEndsAt,
    };
  })
  .filter(Boolean)
  .filter((rec) => {
    if (args.status && rec.status !== args.status) return false;
    if (sinceMs != null) {
      const parsed = rec.cancelledAt ? Date.parse(rec.cancelledAt) : NaN;
      // A --since filter is a strict cutoff: a row with no/unparseable
      // cancellation date can't be proven to fall after it, so exclude it.
      if (!Number.isFinite(parsed) || parsed < sinceMs) return false;
    }
    return true;
  });

// Most-recent cancellation first; undated rows sort to the bottom.
records.sort((a, b) => {
  const ta = a.cancelledAt ? Date.parse(a.cancelledAt) : NaN;
  const tb = b.cancelledAt ? Date.parse(b.cancelledAt) : NaN;
  const va = Number.isFinite(ta) ? ta : -Infinity;
  const vb = Number.isFinite(tb) ? tb : -Infinity;
  if (va !== vb) return vb - va;
  return a.email.localeCompare(b.email);
});

if (args.emails) {
  for (const rec of records) console.log(rec.email);
  process.exit(0);
}

if (args.csv) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  console.log('id,email,status,cancelled_at,access_ends_at,tier');
  for (const rec of records) {
    console.log(
      [rec.id, rec.email, rec.status, rec.cancelledAt ?? '', rec.accessEndsAt ?? '', rec.tier]
        .map(esc)
        .join(','),
    );
  }
  process.exit(0);
}

// ---- Table mode -----------------------------------------------------------

function shortId(id) {
  const idx = String(id ?? '').indexOf('_');
  return idx === -1 ? String(id ?? '') : String(id).slice(idx + 1);
}

// YYYY-MM-DD only for the overview; --csv keeps the full ISO instant.
function formatDate(iso) {
  if (!iso) return '—';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso));
  return m ? m[1] : '—';
}

// ANSI colour only when stdout is a TTY, so piping into less/grep/a file
// doesn't dump escape codes. pending = still-has-access (amber), lapsed =
// access gone (red).
const useColor = !!process.stdout.isTTY;
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const STATUS_LABEL = {
  pending: useColor ? `${YELLOW}pending${RESET}` : 'pending',
  lapsed: useColor ? `${RED}lapsed${RESET}` : 'lapsed',
};

const tierLabel = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const headers = ['User ID', 'Email', 'Status', 'Cancelled', 'Access ends', 'Tier'];
const tableRows = records.map((rec) => [
  shortId(rec.id),
  rec.email,
  STATUS_LABEL[rec.status] ?? rec.status,
  formatDate(rec.cancelledAt),
  formatDate(rec.accessEndsAt),
  tierLabel(rec.tier),
]);

const ANSI_RE = /\x1b\[[0-9;]*m/g;
function visualLength(text) {
  return [...text.replace(ANSI_RE, '')].length;
}
function padCell(text, width) {
  return text + ' '.repeat(Math.max(0, width - visualLength(text)));
}

const widths = headers.map((h, i) =>
  Math.max(h.length, ...tableRows.map((r) => visualLength(r[i])), 0),
);
const renderRow = (cells) => cells.map((cell, i) => padCell(cell, widths[i])).join('  ');
const renderDivider = () => widths.map((w) => '-'.repeat(w)).join('  ');

console.log(`Auth DB: ${dbPath}`);
const pendingCount = records.filter((r) => r.status === 'pending').length;
const lapsedCount = records.filter((r) => r.status === 'lapsed').length;
console.log(
  `Cancellations: ${records.length}  (pending: ${pendingCount}, lapsed: ${lapsedCount})` +
    (args.status ? `  [filtered to ${args.status}]` : '') +
    (args.since ? `  [since ${args.since}]` : ''),
);
console.log('');

if (records.length === 0) {
  console.log('No matching cancellations.');
  process.exit(0);
}

console.log(renderRow(headers));
console.log(renderDivider());
for (const row of tableRows) console.log(renderRow(row));
console.log('');
console.log('Legend:');
console.log('  Status   pending = clicked Cancel, still has access until "Access ends"');
console.log('           lapsed  = subscription ended; tier reset to public');
console.log('  Cancelled    pending: when they clicked Cancel (cancel-ack stamp);');
console.log('               lapsed:  latest stripe_subscription_deleted audit event');
if (!hasAuditEvents) {
  console.log('');
  console.log('Note: audit_events table not found — lapsed cancellation dates show as "—".');
}
console.log('');
console.log('Re-run with --emails for a paste-ready recipient list, or --csv to export.');
