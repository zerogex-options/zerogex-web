#!/usr/bin/env node

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

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const dbPath = process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

const hasReferralsTable = !!db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='referrals'`)
  .get();
if (!hasReferralsTable) {
  console.error('No `referrals` table found — the referral migration has not run yet.');
  console.error('Restart the app (it migrates on first request) and try again.');
  process.exit(1);
}

// userId -> email for resolving referrer/referee on each ledger row.
const emailById = new Map();
for (const r of db.prepare(`SELECT id, email FROM users`).all()) {
  emailById.set(r.id, r.email);
}

// Banked (owed-but-uncashed) free months per referrer.
const bankedById = new Map();
const userCols = new Set(db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name));
if (userCols.has('referral_credit_months')) {
  for (const r of db
    .prepare(`SELECT id, referral_credit_months FROM users WHERE referral_credit_months > 0`)
    .all()) {
    bankedById.set(r.id, Number(r.referral_credit_months));
  }
}

const rows = db
  .prepare(
    `SELECT code, referrer_user_id, referee_user_id, status, created_at, converted_at, rewarded_at
     FROM referrals ORDER BY created_at DESC`,
  )
  .all();

function formatDate(iso) {
  if (!iso) return '—';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso));
  return m ? m[1] : '—';
}
const emailFor = (id) => emailById.get(id) ?? `(deleted ${String(id).slice(0, 12)})`;

// ---- Ledger table -------------------------------------------------------
const headers = ['Code', 'Referrer', 'Referee', 'Status', 'Signed up', 'Rewarded'];
const tableRows = rows.map((r) => [
  r.code,
  emailFor(r.referrer_user_id),
  emailFor(r.referee_user_id),
  r.status,
  formatDate(r.created_at),
  formatDate(r.rewarded_at),
]);

const widths = headers.map((h, i) =>
  Math.max(h.length, ...(tableRows.length ? tableRows.map((row) => String(row[i]).length) : [0])),
);
const padCell = (text, w) => String(text) + ' '.repeat(Math.max(0, w - String(text).length));
const renderRow = (cells) => cells.map((c, i) => padCell(c, widths[i])).join('  ');
const renderDivider = () => widths.map((w) => '-'.repeat(w)).join('  ');

console.log(renderRow(headers));
console.log(renderDivider());
for (const row of tableRows) console.log(renderRow(row));
if (tableRows.length === 0) console.log('(no referrals yet)');

// ---- Per-referrer summary ----------------------------------------------
const summary = new Map(); // referrerId -> { signups, rewarded }
for (const r of rows) {
  const s = summary.get(r.referrer_user_id) ?? { signups: 0, rewarded: 0 };
  s.signups += 1;
  if (r.status === 'rewarded') s.rewarded += 1;
  summary.set(r.referrer_user_id, s);
}
// Include referrers who have banked months but (edge case) no ledger rows.
for (const id of bankedById.keys()) {
  if (!summary.has(id)) summary.set(id, { signups: 0, rewarded: 0 });
}

if (summary.size > 0) {
  console.log('');
  console.log('Per-referrer summary:');
  const sHeaders = ['Referrer', 'Signed up', 'Rewarded', 'Banked months'];
  const sRows = [...summary.entries()]
    .map(([id, s]) => [emailFor(id), String(s.signups), String(s.rewarded), String(bankedById.get(id) ?? 0)])
    .sort((a, b) => Number(b[2]) - Number(a[2]) || a[0].localeCompare(b[0]));
  const sWidths = sHeaders.map((h, i) => Math.max(h.length, ...sRows.map((row) => row[i].length)));
  const sRender = (cells) => cells.map((c, i) => padCell(c, sWidths[i])).join('  ');
  console.log(sRender(sHeaders));
  console.log(sWidths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of sRows) console.log(sRender(row));
}

const totalRewarded = rows.filter((r) => r.status === 'rewarded').length;
const totalBanked = [...bankedById.values()].reduce((a, b) => a + b, 0);
console.log('');
console.log(
  `Totals: ${rows.length} referral(s), ${totalRewarded} rewarded, ${totalBanked} month(s) banked across ${bankedById.size} referrer(s).`,
);
console.log('');
console.log('Status legend: pending = referee signed up but not yet paid; rewarded = referee');
console.log('subscribed and the referrer\'s free month was credited or banked.');
