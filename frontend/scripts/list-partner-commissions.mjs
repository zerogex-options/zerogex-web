#!/usr/bin/env node

// Print the Creator Partner commission ledger from SQLite:
//   - Per-partner summary (accrued/paid/reversed totals + amounts)
//   - Optional full row-by-row ledger (--full or --email <e>)
//
// Read-only. Use this at month-end to figure out who to pay and how much.
// Once you pay a partner out-of-band, mark rows paid manually:
//   sqlite3 <db> "UPDATE partner_commissions
//                 SET status='paid', paid_at='<iso>', payout_reference='<ref>'
//                 WHERE id IN (...);"
// The Phase 4 payout script (not yet built) will automate this.
//
// Options:
//   --email <email>   Filter to one partner
//   --full            Print every ledger row (not just per-partner summary)
//   --status <s>      Filter rows by status: accrued | paid | reversed

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const env = {};
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

function parseArgs(argv) {
  const args = { email: null, full: false, status: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = argv[++i]?.toLowerCase() ?? null;
    else if (arg === '--full') args.full = true;
    else if (arg === '--status' || arg === '-s') args.status = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/list-partner-commissions.mjs [--email <email>] [--full] [--status <s>]

Print the Creator Partner commission ledger. By default: a per-partner
summary of accrued/paid/reversed totals + dollar amounts. Add --full to
also print the row-by-row ledger. --email filters to one partner (implies
--full). --status filters rows by 'accrued', 'paid', or 'reversed'.

Amounts are shown in the row's currency (usually USD) at the invoice's
paid amount. Commission percentage was set at grant time via
grant-partner-pro.mts --commission-bps (default 3000 = 30%).`);
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
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

const hasTable = !!db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='partner_commissions'`)
  .get();
if (!hasTable) {
  console.error('No `partner_commissions` table found. Run `make migrate` to add it.');
  process.exit(1);
}

// userId -> email / X handle lookups so rows show human-readable identifiers.
// x_handle is guarded: on a DB where the migration hasn't landed yet the
// column won't exist, so fall back to email-only rather than throwing.
const userCols = new Set(db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name));
const hasXHandle = userCols.has('x_handle');
const emailById = new Map();
const xHandleById = new Map();
for (const r of db.prepare(`SELECT id, email${hasXHandle ? ', x_handle' : ''} FROM users`).all()) {
  emailById.set(r.id, r.email);
  if (hasXHandle && r.x_handle) xHandleById.set(r.id, r.x_handle);
}
const emailFor = (id) => emailById.get(id) ?? `(deleted ${String(id).slice(0, 12)})`;
const xHandleFor = (id) => {
  const h = xHandleById.get(id);
  return h ? `@${h}` : '—';
};

// Optional email filter: resolve to a user_id up front so the WHERE clause
// stays cheap.
let filterPartnerId = null;
if (cliArgs.email) {
  const row = db.prepare(`SELECT id FROM users WHERE email = ?`).get(cliArgs.email);
  if (!row) {
    console.error(`No user with email: ${cliArgs.email}`);
    process.exit(2);
  }
  filterPartnerId = row.id;
}

const validStatuses = new Set(['accrued', 'paid', 'reversed']);
if (cliArgs.status && !validStatuses.has(cliArgs.status)) {
  console.error(`Invalid --status "${cliArgs.status}". Must be one of: accrued, paid, reversed.`);
  process.exit(1);
}

// Pull the ledger. Read all rows then filter in JS — the table is small
// enough (one row per paid invoice) that a full scan is fine, and it lets
// us build both the summary and the full listing from one query.
const allRows = db
  .prepare(
    `SELECT id, partner_user_id, referee_user_id, stripe_invoice_id,
            billed_amount, commission_amount, currency, status, created_at,
            paid_at, payout_reference
     FROM partner_commissions
     ORDER BY created_at DESC`,
  )
  .all();

const filteredRows = allRows.filter((r) => {
  if (filterPartnerId && r.partner_user_id !== filterPartnerId) return false;
  if (cliArgs.status && r.status !== cliArgs.status) return false;
  return true;
});

function formatMoney(smallestUnit, currency) {
  if (smallestUnit == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(smallestUnit / 100);
  } catch {
    return `${(smallestUnit / 100).toFixed(2)} ${(currency || 'usd').toUpperCase()}`;
  }
}

function formatDate(iso) {
  if (!iso) return '—';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso));
  return m ? m[1] : '—';
}

function padCell(text, w) {
  return String(text) + ' '.repeat(Math.max(0, w - String(text).length));
}
function renderTable(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...(rows.length ? rows.map((row) => String(row[i]).length) : [0])),
  );
  const renderRow = (cells) => cells.map((c, i) => padCell(c, widths[i])).join('  ');
  console.log(renderRow(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) console.log(renderRow(row));
}

// -- Per-partner summary (bucket by currency because we can't sum USD + EUR) --
const summary = new Map(); // partnerId -> { currency -> {accrued, paid, reversed, accruedAmt, paidAmt, reversedAmt} }
for (const r of filteredRows) {
  const partnerBuckets = summary.get(r.partner_user_id) ?? new Map();
  const bucket = partnerBuckets.get(r.currency) ?? {
    accrued: 0,
    paid: 0,
    reversed: 0,
    accruedAmt: 0,
    paidAmt: 0,
    reversedAmt: 0,
  };
  if (r.status === 'accrued') {
    bucket.accrued += 1;
    bucket.accruedAmt += r.commission_amount;
  } else if (r.status === 'paid') {
    bucket.paid += 1;
    bucket.paidAmt += r.commission_amount;
  } else if (r.status === 'reversed') {
    bucket.reversed += 1;
    bucket.reversedAmt += r.commission_amount;
  }
  partnerBuckets.set(r.currency, bucket);
  summary.set(r.partner_user_id, partnerBuckets);
}

console.log(`Auth DB: ${dbPath}`);
console.log('');

if (filteredRows.length === 0) {
  const filters = [
    cliArgs.email ? `email=${cliArgs.email}` : null,
    cliArgs.status ? `status=${cliArgs.status}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  console.log(`No partner_commissions rows${filters ? ` matching ${filters}` : ''}.`);
  process.exit(0);
}

console.log('Per-partner summary:');
const sHeaders = ['Partner', 'X', 'Currency', 'Accrued', 'Owed', 'Paid', 'Paid$', 'Reversed', 'Reversed$'];
const sRows = [];
for (const [partnerId, buckets] of summary) {
  for (const [currency, b] of buckets) {
    sRows.push([
      emailFor(partnerId),
      xHandleFor(partnerId),
      (currency || 'usd').toUpperCase(),
      String(b.accrued),
      formatMoney(b.accruedAmt, currency),
      String(b.paid),
      formatMoney(b.paidAmt, currency),
      String(b.reversed),
      formatMoney(b.reversedAmt, currency),
    ]);
  }
}
sRows.sort((a, b) => a[0].localeCompare(b[0]));
renderTable(sHeaders, sRows);

// -- Full ledger (only if --full or --email) --
const showFull = cliArgs.full || cliArgs.email != null;
if (showFull) {
  console.log('');
  console.log('Ledger rows:');
  const lHeaders = [
    'Created',
    'Partner',
    'Referee',
    'Status',
    'Billed',
    'Commission',
    'Invoice',
    'Paid',
    'PayoutRef',
  ];
  const lRows = filteredRows.map((r) => [
    formatDate(r.created_at),
    emailFor(r.partner_user_id),
    emailFor(r.referee_user_id),
    r.status,
    formatMoney(r.billed_amount, r.currency),
    formatMoney(r.commission_amount, r.currency),
    r.stripe_invoice_id,
    formatDate(r.paid_at),
    r.payout_reference ?? '—',
  ]);
  renderTable(lHeaders, lRows);
}

// -- Totals footer --
console.log('');
const totalAccrued = filteredRows.filter((r) => r.status === 'accrued').length;
const totalPaid = filteredRows.filter((r) => r.status === 'paid').length;
const totalReversed = filteredRows.filter((r) => r.status === 'reversed').length;
console.log(
  `Totals: ${filteredRows.length} row(s), ${totalAccrued} accrued, ${totalPaid} paid, ${totalReversed} reversed.`,
);
console.log('');
console.log('Status legend:');
console.log("  accrued  = owed to the partner, not yet paid out");
console.log("  paid     = paid out-of-band; paid_at + payout_reference recorded");
console.log("  reversed = referee's charge was refunded or disputed; not payable");
