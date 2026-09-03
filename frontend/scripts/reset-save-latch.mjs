#!/usr/bin/env node
// TESTING helper: clear a member's one-shot self-serve SAVE latch
// (users.retention_offer_claimed_at) so the /save one-click flow can be claimed
// again. The save is deliberately one claim per account; this re-arms it for
// repeat testing (or to legitimately re-offer the automated save to someone).
//
//   node --no-warnings scripts/reset-save-latch.mjs --email <addr>
//
// Local DB write only — never touches Stripe. To re-run the FULL flow you also
// need the member back in the canceling state; this script prints the
// set-cancellation command to do that.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function parseArgs(argv) {
  const args = { email: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, eq).trim()] = value;
  }
  return env;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Usage:
  node --no-warnings scripts/reset-save-latch.mjs --email <addr>

TESTING: clears users.retention_offer_claimed_at so the one-click /save flow can
be claimed again. Local DB write only. Reads AUTH_DB_PATH from env or .env.local.`);
  process.exit(0);
}
if (!args.email) {
  console.error('Error: --email is required (e.g. --email you@example.com).');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const dbPath = process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
// Share the live DB politely: WAL + a busy timeout so a concurrent PM2 write
// doesn't fail this one-row update.
db.exec('PRAGMA busy_timeout = 5000;');

const cols = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
if (!cols.has('retention_offer_claimed_at')) {
  console.error('Auth DB is missing retention_offer_claimed_at — boot the app once so migrations run.');
  process.exit(1);
}

const user = db
  .prepare('SELECT id, email, retention_offer_claimed_at, cancel_at_period_end FROM users WHERE lower(email) = ? LIMIT 1')
  .get(args.email);
if (!user) {
  console.error(`No user found with email ${args.email}.`);
  process.exit(1);
}

if (!user.retention_offer_claimed_at) {
  console.log(`${user.email}: save latch already clear (retention_offer_claimed_at is NULL). Nothing to do.`);
} else {
  const nowIso = new Date().toISOString();
  db.prepare('UPDATE users SET retention_offer_claimed_at = NULL, updated_at = ? WHERE id = ?').run(
    nowIso,
    user.id,
  );
  console.log(`${user.email}: cleared save latch (was ${user.retention_offer_claimed_at}). The /save offer can be claimed again.`);
}

if (Number(user.cancel_at_period_end) !== 1) {
  console.log('');
  console.log('Note: to re-run the full flow, put the member back in the canceling state first:');
  console.log(`  make set-cancellation EMAIL=${user.email} ON=1 YES=1`);
  console.log(`Then get a fresh link:  make save-url EMAIL=${user.email}`);
}
