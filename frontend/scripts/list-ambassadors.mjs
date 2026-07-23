#!/usr/bin/env node
// Run from the frontend/ directory:
//   node scripts/list-ambassadors.mjs [--email <email>]
//
// Read-only roster of ZeroGEX Ambassadors and their headline numbers. Uses the
// in-process node:sqlite reader (same as scripts/list-partners.mjs) — no writes.

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
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const argv = process.argv.slice(2);
let emailFilter = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--email' || argv[i] === '-e') emailFilter = (argv[++i] ?? '').trim().toLowerCase();
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const dbPath = process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  process.exit(1);
}
console.log(`Auth DB: ${dbPath}\n`);

const db = new DatabaseSync(dbPath);
const cols = db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name);
if (!cols.includes('partner_status')) {
  console.error("No 'partner_status' column found. Run 'make migrate' to add the ambassador columns.");
  process.exit(1);
}

const where = emailFilter ? `AND email = ?` : '';
const rows = db
  .prepare(
    `SELECT id, email, partner_status, partner_designation, referral_code,
            partner_reward_preference, partner_commission_bps, partner_credit_bps,
            partner_pilot_ends_at, partner_early_access, partner_activated_at
     FROM users WHERE partner_tier = 'ambassador' ${where}
     ORDER BY partner_invited_at IS NULL, partner_invited_at DESC`,
  )
  .all(...(emailFilter ? [emailFilter] : []));

if (rows.length === 0) {
  console.log('No ambassadors found.');
  process.exit(0);
}

// Per-ambassador rollups from the commission ledger.
function money(minor, currency) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(
      (minor || 0) / 100,
    );
  } catch {
    return `${((minor || 0) / 100).toFixed(2)}`;
  }
}

const rollup = db.prepare(
  `SELECT
     COALESCE(SUM(CASE WHEN reward_type='cash' AND status='payable' THEN commission_amount ELSE 0 END),0) AS payable,
     COALESCE(SUM(CASE WHEN reward_type='cash' AND status='paid' THEN commission_amount ELSE 0 END),0) AS paid,
     COALESCE(SUM(CASE WHEN reward_type='account_credit' AND status='credited' THEN commission_amount ELSE 0 END),0) AS credited,
     (SELECT COUNT(*) FROM referrals WHERE referrer_user_id = ?) AS regs
   FROM partner_commissions WHERE partner_user_id = ? AND partner_type='ambassador'`,
);

const line = (c) => c.padEnd ? c : String(c);
const header = ['Email', 'Status', 'Designation', 'Code', 'Reward', 'Regs', 'Payable', 'Paid', 'Credited', 'PilotEnds'];
const table = [header];
for (const r of rows) {
  const roll = rollup.get(r.id, r.id);
  const reward =
    r.partner_reward_preference === 'account_credit'
      ? `${(r.partner_credit_bps ?? 0) / 100}% cr`
      : `${(r.partner_commission_bps ?? 0) / 100}% cash`;
  table.push([
    r.email,
    r.partner_status ?? '-',
    r.partner_designation ?? '-',
    r.referral_code ?? '-',
    reward,
    String(roll.regs ?? 0),
    money(roll.payable, 'usd'),
    money(roll.paid, 'usd'),
    money(roll.credited, 'usd'),
    r.partner_pilot_ends_at ? r.partner_pilot_ends_at.slice(0, 10) : '-',
  ]);
}

const widths = header.map((_, i) => Math.max(...table.map((row) => line(row[i]).length)));
for (const row of table) {
  console.log(row.map((cell, i) => line(cell).padEnd(widths[i])).join('  '));
}
console.log(`\nTotal: ${rows.length} ambassador(s).`);
