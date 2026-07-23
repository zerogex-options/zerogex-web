#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/release-ambassador-commissions.mts (--dry-run | --yes)
//
// The Ambassador Program maintenance cron. Two idempotent, safe-to-repeat jobs:
//   1. Release commissions whose 30-day holding period has elapsed:
//        - cash   -> status 'payable' (pure DB; operator marks 'paid' later).
//        - credit -> apply a Stripe customer-balance credit, then -> 'credited'.
//      Rewards at/above AMBASSADOR_REVIEW_THRESHOLD_CENTS are LEFT pending for
//      an admin to approve in the admin console (the large-reward review gate).
//   2. Expire pilots: flip ACTIVE ambassadors past their pilot end date to
//      'inactive' (no new referrals) while preserving prior earned rewards.
//
// Imports the alias-free core/ambassadorLedger.ts by RELATIVE path so it runs
// under `node --experimental-strip-types` (the Next.js '@/' alias is not a Node
// resolver). The Stripe credit is applied by a Stripe client this script
// constructs itself, mirroring scripts/grant-partner-pro.mts.
//
// Idempotent: re-running only ever processes rows still due. Read-only by
// default; --yes is required to write.

import fs from 'node:fs';
import path from 'node:path';
// `stripe` is imported dynamically (only when a credit reward actually needs to
// be applied) so --dry-run and cash-only runs don't require the package.

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
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const yes = args.has('--yes') || args.has('-y');
if (dryRun && yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}
if (!dryRun && !yes) {
  console.error('Error: pass --dry-run or --yes.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
function envOrLocal(key: string): string | undefined {
  return process.env[key] || envLocal[key] || undefined;
}

// Hoist config into process.env BEFORE importing core/db.ts (which captures
// AUTH_DB_PATH at load) and core/ambassadorConfig.ts (which reads the terms live).
const dbPath = envOrLocal('AUTH_DB_PATH') || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  process.exit(1);
}
process.env.AUTH_DB_PATH = dbPath;
for (const k of [
  'AMBASSADOR_PROGRAM_ENABLED',
  'AMBASSADOR_REVIEW_THRESHOLD_CENTS',
  'NEXT_PUBLIC_APP_URL',
]) {
  const v = envOrLocal(k);
  if (v != null) process.env[k] = v;
}

const ledger = await import('../core/ambassadorLedger.ts');
const { getDb } = await import('../core/db.ts');

console.log(`Auth DB: ${dbPath}`);

// Read-only preview counts (used by --dry-run, and printed as context in --yes).
const now = new Date().toISOString();
const db = getDb();
const dueCash = (
  db
    .prepare(
      `SELECT COUNT(*) c FROM partner_commissions
       WHERE partner_type='ambassador' AND status='pending' AND reward_type='cash'
         AND hold_release_at IS NOT NULL AND hold_release_at <= ?`,
    )
    .get(now) as { c: number }
).c;
const dueCredits = ledger.listDueCredits();
const duePilots = (
  db
    .prepare(
      `SELECT COUNT(*) c FROM users
       WHERE partner_tier='ambassador' AND partner_status='active'
         AND partner_pilot_ends_at IS NOT NULL AND partner_pilot_ends_at < ?`,
    )
    .get(now) as { c: number }
).c;

console.log(`Due cash releases (under review threshold): ${dueCash}`);
console.log(`Due credit releases: ${dueCredits.length}`);
console.log(`Pilots to expire: ${duePilots}`);

if (dryRun) {
  console.log('\n[dry-run] No changes written.');
  process.exit(0);
}

// 1a. Cash releases (pure DB).
const cash = ledger.releaseDueCash();
console.log(`\nCash released to payable: ${cash.cashReleased} (held for review: ${cash.heldForReview})`);

// 1b. Credit releases (Stripe).
let creditsIssued = 0;
let creditErrors = 0;
if (dueCredits.length > 0) {
  const stripeKey = envOrLocal('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    console.error('  ⚠ STRIPE_SECRET_KEY not set — skipping credit application (cash + pilots still processed).');
    creditErrors = dueCredits.length;
  } else {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(stripeKey);
    for (const due of dueCredits) {
      const claim = ledger.claimCreditRelease(due.id);
      if (!claim) continue; // already processed / no customer
      try {
        await stripe.customers.createBalanceTransaction(claim.customerId, {
          amount: -claim.amountMinor, // negative = credit
          currency: claim.currency,
          description: `ZeroGEX Ambassador credit (commission ${due.id})`,
        });
        creditsIssued += 1;
      } catch (err) {
        ledger.revertCreditClaim(due.id);
        creditErrors += 1;
        console.error(`  ⚠ credit apply failed for ${due.id}: ${(err as Error).message}`);
      }
    }
  }
}
console.log(`Credits issued: ${creditsIssued} (errors: ${creditErrors})`);

// 2. Pilot expiry.
const expired = ledger.expirePilots();
console.log(`Pilots expired (active -> inactive): ${expired.length}`);
for (const e of expired) console.log(`  - ${e.email}`);

console.log('\nDone.');
