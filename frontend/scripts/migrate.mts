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

import { getDb } from '../core/db.ts';

const db = getDb();

// Sanity probe: count users so the script does something visible (and
// would surface an obviously broken DB file early). The actual migration
// already happened inside getDb() above; everything after is just proof.
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
