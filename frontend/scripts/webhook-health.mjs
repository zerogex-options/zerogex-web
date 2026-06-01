#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Reuses the same env/path resolution pattern as the other scripts so it
// works on the prod VM whether AUTH_DB_PATH is set in env, in .env.local,
// or falls back to the default frontend/data/auth.db.
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim();
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
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

function count(type, interval) {
  const sql = interval
    ? `SELECT COUNT(*) AS c FROM audit_events WHERE type = ? AND created_at > datetime('now', ?)`
    : `SELECT COUNT(*) AS c FROM audit_events WHERE type = ?`;
  const row = interval ? db.prepare(sql).get(type, interval) : db.prepare(sql).get(type);
  return Number(row?.c ?? 0);
}

function recent(type, intervalOrLimit) {
  const sql =
    typeof intervalOrLimit === 'string'
      ? `SELECT created_at, message, email, user_id FROM audit_events
         WHERE type = ? AND created_at > datetime('now', ?)
         ORDER BY created_at DESC LIMIT 10`
      : `SELECT created_at, message, email, user_id FROM audit_events
         WHERE type = ?
         ORDER BY created_at DESC LIMIT ?`;
  return typeof intervalOrLimit === 'string'
    ? db.prepare(sql).all(type, intervalOrLimit)
    : db.prepare(sql).all(type, intervalOrLimit);
}

const errors24h = count('stripe_webhook_error', '-1 day');
const errors7d = count('stripe_webhook_error', '-7 days');
const orphans24h = count('stripe_webhook_orphan', '-1 day');
const orphans7d = count('stripe_webhook_orphan', '-7 days');
const stale24h = count('stripe_webhook_stale_skipped', '-1 day');
const stale7d = count('stripe_webhook_stale_skipped', '-7 days');
const lifetimes = count('stripe_founding_lifetime_applied');
const redeemed = count('stripe_founding_redeemed');
const failed24h = count('stripe_payment_failed', '-1 day');
const failed7d = count('stripe_payment_failed', '-7 days');

function alertMark(n) {
  return n > 0 ? '  ⚠️' : '';
}

console.log('=== Stripe webhook health ===');
console.log('');
console.log('                       24h    7d');
console.log('  Errors            :  ' + String(errors24h).padStart(4) + '  ' + String(errors7d).padStart(4) + alertMark(errors24h + errors7d));
console.log('  Orphans           :  ' + String(orphans24h).padStart(4) + '  ' + String(orphans7d).padStart(4));
console.log('  Stale skipped     :  ' + String(stale24h).padStart(4) + '  ' + String(stale7d).padStart(4));
console.log('  Payment failed    :  ' + String(failed24h).padStart(4) + '  ' + String(failed7d).padStart(4) + alertMark(failed24h));
console.log('');
console.log('=== Founding-cohort metrics ===');
console.log('');
console.log('  Founding redeems (all-time):     ' + redeemed);
console.log('  Lifetime coupon applied (total): ' + lifetimes);
console.log('');

if (errors7d > 0) {
  console.log('=== Recent stripe_webhook_error rows ===');
  console.log('');
  for (const r of recent('stripe_webhook_error', 10)) {
    console.log('  ' + r.created_at);
    console.log('    ' + r.message);
    console.log('');
  }
}

if (orphans24h > 0) {
  console.log('=== Recent orphans (24h) ===');
  console.log('');
  console.log('  Orphans usually mean a Stripe customer was created outside our');
  console.log('  app (e.g. via Dashboard) and an event fired before we synced.');
  console.log('  Investigate the customer ID in each row.');
  console.log('');
  for (const r of recent('stripe_webhook_orphan', '-1 day')) {
    console.log('  ' + r.created_at);
    console.log('    ' + r.message);
    console.log('');
  }
}

// Non-zero exit code if there are real errors so this can be wired into a
// cron job that emails on failure.
process.exit(errors24h > 0 ? 1 : 0);
