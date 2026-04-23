#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const TIER_ENTITLEMENTS = {
  public: 'Public pages only',
  basic: 'Real-time metrics + full strategy tools',
  pro: 'Basic + Proprietary Signals + ZeroGEX APIs',
  elite: 'Pro + Advanced Signals',
  admin: 'Full admin access (all tools + auth audit)',
};

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

if (rows.length === 0) {
  console.log(`No users found in ${dbPath}`);
  process.exit(0);
}

const printable = rows.map((row) => ({
  id: row.id,
  email: row.email,
  provider: row.provider,
  tier: row.tier,
  entitlement: TIER_ENTITLEMENTS[row.tier] ?? 'Unknown',
  created_at: row.created_at,
  updated_at: row.updated_at,
}));

console.log(`Auth DB: ${dbPath}`);
console.table(printable);
