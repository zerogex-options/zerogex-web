#!/usr/bin/env node

// Clear stripe_customer_id rows that never produced a subscription. These
// accumulate from pre-cutover beta sessions where a user clicked Subscribe,
// got a Stripe customer object provisioned, then bailed before completing
// checkout. Keeping the stale id means the next Subscribe click reuses a
// customer that may no longer exist (test-mode artifact, deleted, env
// drift), and Stripe returns 400 "No such customer".
//
// Default mode is dry-run: lists the rows that would be cleared and exits
// without writing. Pass --apply to actually NULL them out.
//
// Safety: we only touch rows where stripe_subscription_id IS NULL — never
// rows representing an active paying subscriber.

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

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const dbPath = process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

const apply = process.argv.includes('--apply');

const db = new DatabaseSync(dbPath);

const rows = db
  .prepare(
    `SELECT id, email, tier, stripe_customer_id, created_at
     FROM users
     WHERE stripe_customer_id IS NOT NULL
       AND stripe_subscription_id IS NULL
     ORDER BY created_at`,
  )
  .all();

if (rows.length === 0) {
  console.log('No zombie stripe_customer_id rows to clean.');
  process.exit(0);
}

console.log(`Found ${rows.length} zombie row${rows.length === 1 ? '' : 's'}:`);
console.log('');
console.log('email'.padEnd(40), 'tier'.padEnd(8), 'stripe_customer_id'.padEnd(22), 'created');
console.log('-'.repeat(40), '-'.repeat(8), '-'.repeat(22), '-'.repeat(20));
for (const r of rows) {
  console.log(
    String(r.email).padEnd(40),
    String(r.tier).padEnd(8),
    String(r.stripe_customer_id).padEnd(22),
    String(r.created_at).slice(0, 19),
  );
}
console.log('');

if (!apply) {
  console.log('Dry-run only. Re-run with --apply to NULL these columns.');
  process.exit(0);
}

const now = new Date().toISOString();
const update = db.prepare(
  `UPDATE users
   SET stripe_customer_id = NULL,
       stripe_price_id = NULL,
       updated_at = ?
   WHERE id = ?
     AND stripe_subscription_id IS NULL`,
);

let updated = 0;
for (const r of rows) {
  const info = update.run(now, r.id);
  if (info.changes > 0) updated += 1;
}

console.log(`Cleared stripe_customer_id on ${updated} row${updated === 1 ? '' : 's'}.`);
