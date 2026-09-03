#!/usr/bin/env node
// Print the signed self-serve SAVE url (app/save/route.ts) for one member, so you
// can test the one-click retention flow directly in a browser without waiting for
// a real cancellation email to arrive.
//   node --no-warnings scripts/print-save-url.mjs --email <addr>
//
// Read-only. Also reports the member's current eligibility so you know what the
// /save page will show:
//   • eligible       — live sub scheduled to cancel, offer unclaimed → shows the
//                      "claim 25% off & keep access" confirmation button.
//   • already claimed — retention_offer_claimed_at set → shows "you're all set".
//   • not canceling  — no live sub, or not scheduled to cancel → shows
//                      "nothing to restore". Put a test account into the
//                      eligible state with:
//                        make set-cancellation EMAIL=<addr> ON=1 YES=1

import fs from 'node:fs';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

// Token — kept in lockstep with core/retentionToken.ts (namespace 'save:v1').
function saveToken(secret, userId) {
  return createHmac('sha256', secret).update(`save:v1:${userId}`).digest('base64url');
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

function parseArgs(argv) {
  const args = { email: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Usage:
  node --no-warnings scripts/print-save-url.mjs --email <addr>

Prints the signed /save one-click retention URL for a member and their current
eligibility. Read-only. Reads ZEROGEX_END_USER_TOKEN_SECRET, NEXT_PUBLIC_APP_URL
and AUTH_DB_PATH from env or .env.local.`);
  process.exit(0);
}
if (!args.email) {
  console.error('Error: --email is required (e.g. --email you@example.com).');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const envOrLocal = (k) => process.env[k] || envLocal[k] || undefined;

const secret = envOrLocal('ZEROGEX_END_USER_TOKEN_SECRET');
if (!secret) {
  console.error('Error: ZEROGEX_END_USER_TOKEN_SECRET is not set (env or .env.local).');
  process.exit(1);
}
const appUrl = (envOrLocal('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000').replace(/\/+$/, '');
const dbPath = process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
const cols = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
if (!cols.has('retention_offer_claimed_at')) {
  console.error('Auth DB is missing retention_offer_claimed_at — boot the app once so migrations run.');
  process.exit(1);
}

const user = db
  .prepare(
    `SELECT id, email, subscription_status, cancel_at_period_end, stripe_subscription_id,
            retention_offer_claimed_at, current_period_end
     FROM users WHERE lower(email) = ? LIMIT 1`,
  )
  .get(args.email);

if (!user) {
  console.error(`No user found with email ${args.email}.`);
  process.exit(1);
}

const url = `${appUrl}/save?u=${encodeURIComponent(user.id)}&t=${saveToken(secret, user.id)}`;

const live = user.subscription_status === 'trialing' || user.subscription_status === 'active';
const cancelling = Number(user.cancel_at_period_end) === 1;
let state;
if (user.retention_offer_claimed_at) {
  state = `already claimed (${user.retention_offer_claimed_at}) — page shows "you're all set"`;
} else if (!user.stripe_subscription_id || !live || !cancelling) {
  state =
    `NOT canceling (status=${user.subscription_status ?? 'none'}, cancel_at_period_end=${Number(user.cancel_at_period_end) || 0}) — page shows "nothing to restore".\n` +
    `           To test the real offer, schedule a cancel first:  make set-cancellation EMAIL=${user.email} ON=1 YES=1`;
} else {
  state = 'ELIGIBLE — page shows the "claim 25% off & keep access" button';
}

console.log(`User:        ${user.email} (id=${user.id})`);
console.log(`Status:      ${user.subscription_status ?? 'none'} · cancel_at_period_end=${Number(user.cancel_at_period_end) || 0}`);
console.log(`Eligibility: ${state}`);
console.log('');
console.log('Save URL (open in a browser):');
console.log(`  ${url}`);
