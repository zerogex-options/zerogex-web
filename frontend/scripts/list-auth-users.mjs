#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const TIER_ORDER = ['public', 'starter', 'pro', 'elite', 'admin'];
const TIER_ENTITLEMENTS = {
  public: 'Public pages only',
  starter: 'Real-time metrics + full strategy tools coverage',
  pro: 'Starter + Basic Signals + ZeroGEX API access',
  elite: 'Pro + Advanced Signals',
  admin: 'Full admin access (all tools + auth audit)',
};

const MAX_COL_WIDTH = 60;

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const env = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    env[key] = value;
  }

  return env;
}

function truncate(s, n) {
  if (s.length <= n) return s;
  if (n <= 1) return s.slice(0, n);
  return s.slice(0, n - 1) + '…';
}

function padRight(s, n) {
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
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
const rows = db
  .prepare(
    `SELECT id, email, provider, tier, created_at, updated_at
     FROM users
     ORDER BY created_at DESC`
  )
  .all();

console.log(`Auth DB: ${dbPath}`);
console.log('');

if (rows.length === 0) {
  console.log('No users found.');
  process.exit(0);
}

const byTier = Object.fromEntries(TIER_ORDER.map((t) => [t, []]));
for (const row of rows) {
  const tier = row.tier || 'public';
  if (!byTier[tier]) byTier[tier] = [];
  byTier[tier].push({ id: String(row.id), email: String(row.email ?? '') });
}

const extraTiers = Object.keys(byTier).filter((t) => !TIER_ORDER.includes(t)).sort();
const allTiers = [...TIER_ORDER, ...extraTiers];

const entryText = (u) => `${u.id}  ${u.email}`;

const widths = allTiers.map((t) => {
  const header = `${t} (${byTier[t].length})`;
  const entries = byTier[t].map(entryText);
  const maxLen = Math.max(header.length, ...entries.map((e) => e.length), 0);
  return Math.min(Math.max(maxLen, 10), MAX_COL_WIDTH);
});

const hr = (left, mid, right) =>
  left + widths.map((w) => '─'.repeat(w + 2)).join(mid) + right;

console.log(hr('┌', '┬', '┐'));
const headerCells = allTiers.map(
  (t, i) => ' ' + padRight(truncate(`${t} (${byTier[t].length})`, widths[i]), widths[i]) + ' '
);
console.log('│' + headerCells.join('│') + '│');
console.log(hr('├', '┼', '┤'));

const maxRows = Math.max(...allTiers.map((t) => byTier[t].length));
for (let i = 0; i < maxRows; i++) {
  const cells = allTiers.map((t, j) => {
    const u = byTier[t][i];
    const text = u ? truncate(entryText(u), widths[j]) : '';
    return ' ' + padRight(text, widths[j]) + ' ';
  });
  console.log('│' + cells.join('│') + '│');
}
console.log(hr('└', '┴', '┘'));

console.log('');
console.log('Summary:');

const summaryRows = allTiers.map((t) => ({
  tier: t,
  count: byTier[t].length,
  entitlement: TIER_ENTITLEMENTS[t] ?? 'Unknown',
}));
const total = rows.length;

const tierW = Math.max('Tier'.length, 'TOTAL'.length, ...summaryRows.map((r) => r.tier.length));
const countW = Math.max('Count'.length, String(total).length, ...summaryRows.map((r) => String(r.count).length));
const entW = Math.max('Entitlement'.length, ...summaryRows.map((r) => r.entitlement.length));

const sumHr = (left, mid, right) =>
  left + '─'.repeat(tierW + 2) + mid + '─'.repeat(countW + 2) + mid + '─'.repeat(entW + 2) + right;

console.log(sumHr('┌', '┬', '┐'));
console.log(
  '│ ' + padRight('Tier', tierW) + ' │ ' + padRight('Count', countW) + ' │ ' + padRight('Entitlement', entW) + ' │'
);
console.log(sumHr('├', '┼', '┤'));
for (const r of summaryRows) {
  console.log(
    '│ ' + padRight(r.tier, tierW) + ' │ ' + padRight(String(r.count), countW) + ' │ ' + padRight(r.entitlement, entW) + ' │'
  );
}
console.log(sumHr('├', '┼', '┤'));
console.log(
  '│ ' + padRight('TOTAL', tierW) + ' │ ' + padRight(String(total), countW) + ' │ ' + padRight('', entW) + ' │'
);
console.log(sumHr('└', '┴', '┘'));
