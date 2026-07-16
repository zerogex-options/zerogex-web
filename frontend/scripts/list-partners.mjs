#!/usr/bin/env node

// Roster of every Creator Partner (partner_tier='creator') in the auth DB.
// This is the "who are my partners" view — distinct from
// list-partner-commissions.mjs, which only shows partners who have already
// earned commission rows. Newly-granted partners with no conversions yet
// appear here but not there.
//
// Read-only. Columns: email, X handle, referral code, audience promo code,
// commission %, accrual window, Pro-grant expiry, activation date, and the
// FTC disclosure URL.
//
// Options:
//   --email <email>   Filter to one partner
//   --help            Show this help

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

function parseArgs(argv) {
  const args = { email: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = argv[++i]?.toLowerCase() ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/list-partners.mjs [--email <email>]

List every Creator Partner (partner_tier='creator') with their X handle,
referral + promo codes, commission rate/window, Pro-grant expiry, and FTC
disclosure URL. Read-only. --email filters to one partner.`);
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

// The partner_* columns land via the app's lazy migration (core/db.ts). If
// they're absent the migration hasn't run against this DB file yet — point at
// the fix rather than throwing a raw "no such column" error.
const userCols = new Set(db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name));
if (!userCols.has('partner_tier')) {
  console.error('No `partner_tier` column found. Run `make migrate` to add the partner columns.');
  process.exit(1);
}
const hasXHandle = userCols.has('x_handle');

let sql = `SELECT email, ${hasXHandle ? 'x_handle' : 'NULL AS x_handle'} AS x_handle,
                  referral_code, partner_audience_promo_code,
                  partner_commission_bps, partner_commission_window_months,
                  partner_pro_grant_expires_at, partner_activated_at,
                  partner_disclosure_url
           FROM users
           WHERE partner_tier = 'creator'`;
if (cliArgs.email) sql += ` AND email = ?`;
sql += ` ORDER BY partner_activated_at IS NULL, partner_activated_at`;

const rows = cliArgs.email
  ? db.prepare(sql).all(cliArgs.email)
  : db.prepare(sql).all();

function formatDate(iso) {
  if (!iso) return '—';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso));
  return m ? m[1] : '—';
}
function padCell(text, w) {
  return String(text) + ' '.repeat(Math.max(0, w - String(text).length));
}
function renderTable(headers, tableRows) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...(tableRows.length ? tableRows.map((row) => String(row[i]).length) : [0])),
  );
  const renderRow = (cells) => cells.map((c, i) => padCell(c, widths[i])).join('  ');
  console.log(renderRow(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of tableRows) console.log(renderRow(row));
}

console.log(`Auth DB: ${dbPath}`);
console.log('');

if (rows.length === 0) {
  console.log(
    cliArgs.email
      ? `No Creator Partner found with email ${cliArgs.email}.`
      : 'No Creator Partners (partner_tier=\'creator\') found.',
  );
  process.exit(0);
}

const headers = ['Email', 'X', 'Referral', 'Promo', 'Comm%', 'Window', 'GrantExpires', 'Activated', 'Disclosure'];
const tableRows = rows.map((r) => [
  r.email,
  r.x_handle ? `@${r.x_handle}` : '—',
  r.referral_code ?? '—',
  r.partner_audience_promo_code ?? '—',
  `${(Number(r.partner_commission_bps) / 100).toFixed(0)}%`,
  `${r.partner_commission_window_months}mo`,
  formatDate(r.partner_pro_grant_expires_at),
  formatDate(r.partner_activated_at),
  r.partner_disclosure_url ?? '—',
]);
renderTable(headers, tableRows);

console.log('');
console.log(`Total: ${rows.length} Creator Partner(s).`);
if (!hasXHandle) {
  console.log('Note: x_handle column not present in this DB yet — run `make migrate`.');
}
