#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/migrate.mts
//
// Force the auth DB's lazy migration to run NOW, without needing to wait
// for the first user request to hit the PM2 app. Used after a deploy that
// adds new columns / tables — particularly `./deploy.sh --start-from <N>`
// flows that intentionally skip the app rebuild + PM2 restart steps and
// would otherwise leave the new schema unmigrated until a real request
// arrives.
//
// Importing core/db.ts is what triggers initDb() on first getDb(): the
// idempotent ensureColumn() calls run, ALTER TABLE statements land in the
// SQLite file, and any concurrent PM2 process picks them up automatically
// on its next getDb() (or already sees them if it has been bounced since
// the file changed). Safe to re-run.
//
// IMPORTANT: core/db.ts reads AUTH_DB_PATH from process.env only — it does
// NOT load .env.local the way Next.js does at app boot. That means a naive
// `node scripts/migrate.mts` run from an operator shell would default to
// frontend/data/auth.db (the dev path) rather than the production
// /var/lib/zerogex/auth.db. We hoist AUTH_DB_PATH out of .env.local into
// process.env BEFORE the dynamic import below so initDb() resolves the
// same file the live PM2 process uses. Dynamic import is required —
// a static `import { getDb } from '../core/db.ts'` would be hoisted above
// this env-mutating code and read process.env too early.

import fs from 'node:fs';
import path from 'node:path';

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

const envLocalPath = path.join(process.cwd(), '.env.local');
const envLocal = parseEnvFile(envLocalPath);
if (envLocal.AUTH_DB_PATH && !process.env.AUTH_DB_PATH) {
  process.env.AUTH_DB_PATH = envLocal.AUTH_DB_PATH;
}

const resolvedDbPath =
  process.env.AUTH_DB_PATH ?? path.join(process.cwd(), 'data', 'auth.db');
console.log(`Migrating: ${resolvedDbPath}`);
if (!process.env.AUTH_DB_PATH) {
  console.log(`(AUTH_DB_PATH unset in env and not found in ${envLocalPath} — using dev default)`);
}

// Dynamic import: core/db.ts reads process.env.AUTH_DB_PATH at module load
// time, so the assignment above must complete first. A static top-of-file
// `import { getDb } from '../core/db.ts'` would be hoisted by the ESM
// loader above the env mutation and miss the override entirely.
const { getDb } = await import('../core/db.ts');
const db = getDb();

// Sanity probe + visibility: count users so the script does something
// concrete (and a zero-count surfaces an obviously wrong DB file early —
// the dev default is usually empty in production).
const row = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };

// Spot-check that the latest partner_* columns landed. If the build that
// added them hasn't been deployed yet, this catches the operator who's
// running migrate against stale code (rather than failing later in
// expire-partner-grants with a "no such column" error).
const cols = (db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>).map(
  (c) => c.name,
);
const required = [
  'partner_tier',
  'partner_pro_grant_expires_at',
  'partner_audience_promo_code',
];
const missing = required.filter((c) => !cols.includes(c));

console.log(`Auth DB migration complete. users count: ${row.c}`);
if (missing.length > 0) {
  console.error(`\nWARNING: expected columns missing from users: ${missing.join(', ')}`);
  console.error('This Node process is running stale code. Pull the latest, rebuild, retry.');
  process.exit(2);
}
console.log('Latest partner_* columns confirmed present.');
