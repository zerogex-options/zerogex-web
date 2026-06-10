#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/credit-founders-july1-delay.mts \
//     [--dry-run | --yes]
//
// One-off backfill: credit each Founding Member a flat one-month founding
// rate ($12 Basic, $19 Pro) — matching what new founders effectively get now
// that their first payment is deferred to July 1. Same flat amount applies
// to monthly and annual founders.
//
// Tier is detected by matching users.stripe_price_id against the
// STRIPE_PRICE_{BASIC,PRO}_{MONTHLY,ANNUAL} env vars, so the same source of
// truth as core/stripe.ts.
//
// Credit posts as a NEGATIVE customers balance transaction; Stripe
// auto-applies it to the next invoice.
//
// Idempotent: skips users with an existing audit_events row of type
// `billing_founding_july1_credit`.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

type Tier = 'basic' | 'pro';
// Founding monthly rates. Stripe amounts are in the smallest currency unit
// (cents). Applied flat to monthly and annual founders.
const TIER_CREDIT_CENTS: Record<Tier, number> = {
  basic: 1200,
  pro: 1900,
};
const CREDIT_CURRENCY = 'usd';
const AUDIT_TYPE = 'billing_founding_july1_credit';

type Args = { dryRun: boolean; yes: boolean; help: boolean };

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

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, yes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/credit-founders-july1-delay.mts \\
    [--dry-run | --yes]

For each Founding Member (users.founding_member_started_at IS NOT NULL),
posts a Stripe customer-balance credit of $${(TIER_CREDIT_CENTS.basic / 100).toFixed(2)} (Basic) or
$${(TIER_CREDIT_CENTS.pro / 100).toFixed(2)} (Pro) — one month at the founding rate. Auto-applies to the
next invoice. Same flat amount for monthly and annual cadence.

Options:
      --dry-run   Print what would happen; no Stripe or DB writes.
  -y, --yes       Apply the credits.
  -h, --help      Show this help.

Idempotent: skips users with an existing audit_events row of type
\`${AUDIT_TYPE}\`. Safe to re-run after a partial failure.

Reads STRIPE_SECRET_KEY and STRIPE_PRICE_{BASIC,PRO}_{MONTHLY,ANNUAL} from env
or .env.local. Set AUTH_DB_PATH to override the default DB path.`);
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH.');
    console.error('Install it with: sudo apt-get install sqlite3');
    process.exit(1);
  }
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function runSqlite(dbPath: string, sql: string): string {
  try {
    return execFileSync('sqlite3', ['-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr;
    const message =
      typeof stderr === 'string'
        ? stderr
        : stderr?.toString?.() ?? (err as Error).message;
    throw new Error(message.trim() || (err as Error).message);
  }
}

function querySqlite<T = Record<string, unknown>>(dbPath: string, sql: string): T[] {
  const output = runSqlite(dbPath, sql).trim();
  if (!output) return [];
  return JSON.parse(output) as T[];
}

function execSqlite(dbPath: string, sql: string) {
  runSqlite(dbPath, sql);
}

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  usage();
  process.exit(0);
}

if (cliArgs.dryRun && cliArgs.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
function envOrLocal(key: string): string | undefined {
  return process.env[key] || envLocal[key] || undefined;
}

const STRIPE_SECRET_KEY = envOrLocal('STRIPE_SECRET_KEY');
if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY not set in env or .env.local.');
  process.exit(1);
}

const priceIdToTier: Map<string, Tier> = new Map();
for (const [envKey, tier] of [
  ['STRIPE_PRICE_BASIC_MONTHLY', 'basic'],
  ['STRIPE_PRICE_BASIC_ANNUAL', 'basic'],
  ['STRIPE_PRICE_PRO_MONTHLY', 'pro'],
  ['STRIPE_PRICE_PRO_ANNUAL', 'pro'],
] as Array<[string, Tier]>) {
  const id = envOrLocal(envKey);
  if (id) priceIdToTier.set(id, tier);
}
if (priceIdToTier.size === 0) {
  console.error('Error: no STRIPE_PRICE_{BASIC,PRO}_{MONTHLY,ANNUAL} env vars set.');
  console.error('At least one is required to detect tier from price ID.');
  process.exit(1);
}

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

ensureSqlite3Cli();

const stripe = new Stripe(STRIPE_SECRET_KEY);

type FounderRow = {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  founding_member_started_at: string;
};

const founders = querySqlite<FounderRow>(
  dbPath,
  `SELECT id, email, stripe_customer_id, stripe_subscription_id,
          stripe_price_id, founding_member_started_at
   FROM users
   WHERE founding_member_started_at IS NOT NULL
     AND stripe_customer_id IS NOT NULL
   ORDER BY founding_member_started_at ASC;`,
);

if (founders.length === 0) {
  console.log('No founding members found.');
  process.exit(0);
}

const alreadyCredited = new Set(
  querySqlite<{ user_id: string }>(
    dbPath,
    `SELECT user_id FROM audit_events
     WHERE type = '${escapeSqlLiteral(AUDIT_TYPE)}' AND user_id IS NOT NULL;`,
  ).map((r) => r.user_id),
);

const eligible = founders.filter((u) => !alreadyCredited.has(u.id));
const skippedAlready = founders.length - eligible.length;

console.log(`Auth DB:          ${dbPath}`);
console.log(`Founders total:   ${founders.length}`);
console.log(`Already credited: ${skippedAlready}`);
console.log(`To consider:      ${eligible.length}`);

if (eligible.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

type CreditPlan = {
  user: FounderRow;
  tier: Tier;
  amount: number;
  basis: string;
};

async function planCredit(user: FounderRow): Promise<CreditPlan | { skip: string }> {
  if (!user.stripe_customer_id) return { skip: 'missing stripe_customer_id' };

  // Prefer the DB-cached price id, but fall back to the live subscription's
  // price (the user may have switched plans since the founding redemption).
  let priceId = user.stripe_price_id;
  if (!priceId && user.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
      priceId = sub.items.data[0]?.price.id ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      return { skip: `subscription retrieve failed: ${message}` };
    }
  }
  if (!priceId) return { skip: 'no resolvable price id' };

  const tier = priceIdToTier.get(priceId);
  if (!tier) return { skip: `price ${priceId} not mapped to a tier` };

  const amount = TIER_CREDIT_CENTS[tier];
  return {
    user,
    tier,
    amount,
    basis: `tier=${tier} price=${priceId}`,
  };
}

const plans: CreditPlan[] = [];
const skips: Array<{ user: FounderRow; reason: string }> = [];

for (const user of eligible) {
  try {
    const plan = await planCredit(user);
    if ('skip' in plan) skips.push({ user, reason: plan.skip });
    else plans.push(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    skips.push({ user, reason: `error: ${message}` });
  }
}

const totalCents = plans.reduce((acc, p) => acc + p.amount, 0);
const byTier = plans.reduce<Record<Tier, number>>(
  (acc, p) => ({ ...acc, [p.tier]: acc[p.tier] + 1 }),
  { basic: 0, pro: 0 },
);

console.log(`\nWill credit: ${plans.length} (basic=${byTier.basic}, pro=${byTier.pro})`);
console.log(`Will skip:   ${skips.length}`);
console.log(`Total USD:   ${(totalCents / 100).toFixed(2)}`);

const sample = plans.slice(0, 10);
for (const p of sample) {
  console.log(
    `  - ${p.user.email}: ${(p.amount / 100).toFixed(2)} USD (${p.basis})`,
  );
}
if (plans.length > sample.length) {
  console.log(`  ... and ${plans.length - sample.length} more`);
}

if (skips.length > 0) {
  console.log('\nSkipped (sample):');
  for (const s of skips.slice(0, 8)) {
    console.log(`  - ${s.user.email}: ${s.reason}`);
  }
  if (skips.length > 8) console.log(`  ... and ${skips.length - 8} more`);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No credits posted, no audit rows written.');
  process.exit(0);
}

if (!cliArgs.yes) {
  console.log(
    '\nRefusing to write without --yes. Re-run with --yes to apply, or --dry-run to preview.',
  );
  process.exit(1);
}

let successCount = 0;
let failCount = 0;

for (const plan of plans) {
  try {
    await stripe.customers.createBalanceTransaction(plan.user.stripe_customer_id!, {
      amount: -plan.amount,
      currency: CREDIT_CURRENCY,
      description: `Founding first-payment delay credit (one month at founding rate)`,
    });

    const nowIso = new Date().toISOString();
    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    execSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         '${escapeSqlLiteral(AUDIT_TYPE)}',
         '${escapeSqlLiteral(plan.user.id)}',
         NULL,
         '${escapeSqlLiteral(plan.user.email)}',
         'manual-script',
         '${escapeSqlLiteral(`Credited ${plan.amount} USD (${plan.basis})`)}',
         '${escapeSqlLiteral(nowIso)}'
       );`,
    );
    successCount++;
  } catch (err) {
    failCount++;
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  FAIL ${plan.user.email}: ${message}`);
  }
}

console.log(`\nDone. ${successCount} credited, ${failCount} failed.`);
