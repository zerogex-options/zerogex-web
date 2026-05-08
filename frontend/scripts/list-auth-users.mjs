#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const TIER_DISPLAY_ORDER = ['admin', 'pro', 'basic', 'public'];

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

function titleCase(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
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
    `SELECT id, email, tier, password_hash, provider, provider_id, created_at
     FROM users
     ORDER BY created_at DESC`
  )
  .all();

const hasIdentitiesTable = !!db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_identities'`)
  .get();

const providersByUser = new Map();
if (hasIdentitiesTable) {
  const identityRows = db.prepare(`SELECT user_id, provider FROM user_identities`).all();
  for (const r of identityRows) {
    if (!providersByUser.has(r.user_id)) providersByUser.set(r.user_id, new Set());
    providersByUser.get(r.user_id).add(r.provider);
  }
}

function authFlags(row) {
  const providers = providersByUser.get(row.id);
  const hasGoogle = providers
    ? providers.has('google')
    : row.provider === 'google' && !!row.provider_id;
  const hasApple = providers
    ? providers.has('apple')
    : row.provider === 'apple' && !!row.provider_id;
  const l = row.password_hash ? 'L' : '-';
  const g = hasGoogle ? 'G' : '-';
  const a = hasApple ? 'A' : '-';
  return `${l}${g}${a}`;
}

const byTier = Object.fromEntries(TIER_DISPLAY_ORDER.map((t) => [t, []]));
for (const row of rows) {
  const tier = row.tier || 'public';
  if (!byTier[tier]) byTier[tier] = [];
  byTier[tier].push({ id: String(row.id), email: String(row.email ?? ''), flags: authFlags(row) });
}

const extraTiers = Object.keys(byTier).filter((t) => !TIER_DISPLAY_ORDER.includes(t)).sort();
const allTiers = [...TIER_DISPLAY_ORDER, ...extraTiers];

const sections = [];
for (const tier of allTiers) {
  const users = byTier[tier];
  const label = `${titleCase(tier)} (${users.length})`;
  if (users.length === 0) {
    sections.push(label);
  } else {
    const lines = [`${label}:`];
    for (const u of users) lines.push(`  ${u.flags}  ${u.email} (${u.id})`);
    sections.push(lines.join('\n'));
  }
}
console.log(sections.join('\n\n'));

console.log('');
console.log(`Total: ${rows.length}`);
