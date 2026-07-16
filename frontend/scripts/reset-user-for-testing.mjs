#!/usr/bin/env node

// Reset ONE account back to a clean pre-signup state so you can re-run the
// signup + plan-switch flow end-to-end against it. TESTING TOOL — it wipes
// subscription/billing history off the local user row.
//
// What it does (DB only — never calls Stripe):
//   • tier -> 'public'
//   • clears the subscription mirror: stripe_subscription_id, stripe_price_id,
//     subscription_status, current_period_end, cancel_at_period_end
//   • clears the trial-suppression + lifecycle latches so a fresh signup gets a
//     new 7-day trial and clean email automations: subscription_lapsed,
//     paid_welcome_email_sent_at, trial_reminder_email_sent_at,
//     cancel_ack_email_sent_at, winback_email_sent_at
//   • by default clears stripe_customer_id (re-signup provisions a FRESH Stripe
//     customer — no leftover balance credit or duplicate cards); --keep-customer
//     reuses the existing customer instead
//   • by default clears founding_member_started_at + founding_lifetime_applied_at
//     so the account behaves like a normal (non-founding) member on the re-test;
//     --keep-founding preserves them. (founding_eligible + email_verified_at are
//     always left as-is, so you don't have to re-verify to subscribe.)
//
// Default mode is dry-run: prints the before/after and exits without writing.
// Pass --apply to write. Records an audit_events row (billing_test_reset).
//
// Run from the frontend/ directory (nvm 22):
//   node --no-warnings scripts/reset-user-for-testing.mjs --email <addr> [--apply]
//     [--keep-founding] [--keep-customer]
// Set AUTH_DB_PATH (env or frontend/.env.local) to override the DB path.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
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
  const args = { email: null, apply: false, keepFounding: false, keepCustomer: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--keep-founding') args.keepFounding = true;
    else if (arg === '--keep-customer') args.keepCustomer = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --no-warnings scripts/reset-user-for-testing.mjs --email <addr> [--apply]
    [--keep-founding] [--keep-customer]

Resets one account to a clean pre-signup state (tier=public, subscription mirror
and trial/lifecycle latches cleared) so you can re-run signup + plan switching.
TESTING TOOL — wipes local subscription history. Never calls Stripe.

Options:
  -e, --email <addr>   Target account (required).
      --apply          Write the changes. Omit for a dry-run preview.
      --keep-founding  Preserve founding_member_started_at + lifetime latch.
      --keep-customer  Preserve stripe_customer_id (reuse the Stripe customer
                       instead of provisioning a fresh one on re-signup).
  -h, --help           Show this help.

Set AUTH_DB_PATH (env or frontend/.env.local) to override the default DB path.`);
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
}
if (!cliArgs.email) {
  console.error('Error: --email is required. See --help.');
  process.exit(1);
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
const nowIso = () => new Date().toISOString();

const user = db
  .prepare(
    `SELECT id, email, tier, stripe_customer_id, stripe_subscription_id, subscription_status,
            subscription_lapsed, paid_welcome_email_sent_at, founding_member_started_at,
            founding_lifetime_applied_at
     FROM users WHERE lower(email) = ? LIMIT 1`,
  )
  .get(cliArgs.email);

if (!user) {
  console.error(`Error: no user found with email ${cliArgs.email}.`);
  process.exit(2);
}

console.log(`Auth DB:                 ${dbPath}`);
console.log(`Account:                 ${user.email} (id=${user.id})`);
console.log('');
console.log('Current:');
console.log(`  tier                   ${user.tier}`);
console.log(`  subscription_status    ${user.subscription_status ?? '—'}`);
console.log(`  stripe_customer_id     ${user.stripe_customer_id ?? '—'}`);
console.log(`  stripe_subscription_id ${user.stripe_subscription_id ?? '—'}`);
console.log(`  subscription_lapsed    ${user.subscription_lapsed ? 'yes' : 'no'}`);
console.log(`  paid_welcome_sent      ${user.paid_welcome_email_sent_at ?? '—'}`);
console.log(`  founding_started_at    ${user.founding_member_started_at ?? '—'}`);

// Build the SET clause. Parameterized values line up with the `params` array.
const sets = [
  "tier = 'public'",
  'stripe_subscription_id = NULL',
  'stripe_price_id = NULL',
  'subscription_status = NULL',
  'current_period_end = NULL',
  'cancel_at_period_end = 0',
  'subscription_lapsed = 0',
  'paid_welcome_email_sent_at = NULL',
  'trial_reminder_email_sent_at = NULL',
  'cancel_ack_email_sent_at = NULL',
  'winback_email_sent_at = NULL',
];
if (!cliArgs.keepCustomer) sets.push('stripe_customer_id = NULL');
if (!cliArgs.keepFounding) {
  sets.push('founding_member_started_at = NULL');
  sets.push('founding_lifetime_applied_at = NULL');
}

console.log('');
console.log('Will reset to:');
console.log('  tier                   public');
console.log('  subscription mirror    cleared (sub id, price id, status, period end, cancel flag)');
console.log('  trial/lifecycle latches cleared (lapsed, paid_welcome, reminders, cancel-ack, winback)');
console.log(`  stripe_customer_id     ${cliArgs.keepCustomer ? 'KEPT (reuse on re-signup)' : 'cleared (fresh customer on re-signup)'}`);
console.log(`  founding state         ${cliArgs.keepFounding ? 'KEPT' : 'cleared (behaves as a normal member)'}`);
console.log('  email_verified_at      kept (no re-verification needed)');

if (!cliArgs.apply) {
  console.log('\n[dry-run] No changes written. Re-run with --apply to reset.');
  process.exit(0);
}

const stamp = nowIso();
db.prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(stamp, user.id);

const detail =
  `test reset to public` +
  `${cliArgs.keepCustomer ? '' : '; customer cleared'}` +
  `${cliArgs.keepFounding ? '' : '; founding cleared'}` +
  ` (was tier=${user.tier}, status=${user.subscription_status ?? 'none'})`;
db.prepare(
  `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
   VALUES (?, 'billing_test_reset', ?, NULL, ?, 'manual-script', ?, ?)`,
).run(`audit_${crypto.randomBytes(12).toString('hex')}`, user.id, user.email, detail, stamp);

console.log(`\nDone. ${user.email} reset to public.`);
console.log('Next: log out, then sign up again — a fresh 7-day trial applies, and you can test the plan switch.');
