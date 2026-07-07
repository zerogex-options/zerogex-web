#!/usr/bin/env node

// Downgrade founding-cohort users (founding_eligible=1) who were comped
// onto tier=pro or tier=basic at cutover (see `make all-to-pro` +
// scripts/seed-founders.mjs) and never redeemed the founding rate at
// checkout. Their deadline to lock in the founding price is
// FOUNDING_LOCKIN_DEADLINE_ISO (2026-07-01T13:30:00Z = July 1, 09:30 ET);
// after that the comp turns off and they revert to tier='public'.
//
// Intended as a one-shot triggered by the systemd timer
// zerogex-web-founding-cohort-demotion.timer at the deadline, but safe
// to re-run: users already downgraded no longer match the WHERE clause,
// and users who later start a founding subscription will have
// founding_member_started_at stamped by the Stripe webhook and be
// excluded on the next tick.
//
// A user is "not subscribed" here means BOTH:
//   - founding_member_started_at IS NULL  (never redeemed the founding
//     rate — that column is stamped only when subMetadata.founding='1'
//     in app/api/webhooks/stripe/route.ts)
//   - no active/trialing Stripe subscription (guards against a founding-
//     eligible user who subscribed at the standard rate; we must NOT
//     yank Pro from a paying customer just because they didn't take the
//     founding coupon)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

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

function parseArgs(argv) {
  const args = { dryRun: false, yes: false, help: false };
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
  node scripts/expire-founding-cohort.mjs (--dry-run | --yes)

Downgrades founding-eligible users comped onto tier=pro or tier=basic
who never redeemed the founding rate AND have no active/trialing Stripe
subscription. Intended as a one-shot at the FOUNDING_LOCKIN_DEADLINE
(2026-07-01 09:30 ET), driven by the systemd timer of the same name.

Options:
      --dry-run    List the affected accounts without writing.
  -y, --yes        Apply the downgrade.
  -h, --help       Show this help.

Requires the sqlite3 CLI. Set AUTH_DB_PATH (env or frontend/.env.local) to
override the default DB path.`);
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH.');
    console.error('Install it with: sudo apt-get install sqlite3');
    process.exit(1);
  }
}

function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

function runSqlite(dbPath, sql) {
  try {
    return execFileSync('sqlite3', ['-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = err.stderr?.toString?.() ?? '';
    throw new Error(stderr.trim() || err.message);
  }
}

function querySqlite(dbPath, sql) {
  const output = runSqlite(dbPath, sql).trim();
  if (!output) return [];
  return JSON.parse(output);
}

function execSqlite(dbPath, sql) {
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
if (!cliArgs.dryRun && !cliArgs.yes) {
  console.error('Error: pass --dry-run or --yes.');
  usage();
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  process.exit(1);
}

ensureSqlite3Cli();

// Pre-flight: the founding_* columns are added by the App's lazy migration
// in frontend/core/db.ts (initDb). Same failure mode as expire-partner-
// grants.mjs — surface a clear remediation instead of a raw SQL error.
const userCols = new Set(
  querySqlite(dbPath, `PRAGMA table_info(users);`).map((c) => c.name),
);
const requiredCols = [
  'founding_eligible',
  'founding_member_started_at',
  'stripe_subscription_id',
  'subscription_status',
];
const missingCols = requiredCols.filter((c) => !userCols.has(c));
if (missingCols.length > 0) {
  console.error(`Error: users table missing columns: ${missingCols.join(', ')}.`);
  console.error('The auth DB schema migration has not run against this database file.');
  console.error('Fix: cd ~/zerogex-web && make migrate   (forces the lazy migration to run)');
  process.exit(4);
}

const nowIso = new Date().toISOString();

// Eligible to downgrade: founding-cohort user currently comped onto pro/
// basic, who never redeemed the founding rate AND who does not have an
// active/trialing Stripe sub (guards against founding-eligible users who
// subscribed at the standard rate — their founding_member_started_at is
// NULL too, since it's stamped only when subMetadata.founding='1').
const candidates = querySqlite(
  dbPath,
  `SELECT id, email, tier, founding_eligible, founding_member_started_at,
          subscription_status, stripe_subscription_id
   FROM users
   WHERE founding_eligible = 1
     AND founding_member_started_at IS NULL
     AND tier IN ('pro', 'basic')
     AND (
       stripe_subscription_id IS NULL
       OR subscription_status IS NULL
       OR subscription_status NOT IN ('active', 'trialing')
     );`,
);

console.log(`Auth DB: ${dbPath}`);
console.log(`Cutoff:  founding-cohort deadline reached (${nowIso})`);
console.log(`Candidates: ${candidates.length}`);

for (const c of candidates) {
  console.log(
    `  - ${c.email}  tier=${c.tier}  sub=${c.subscription_status ?? '(none)'}`,
  );
}

if (candidates.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No changes written.');
  process.exit(0);
}

for (const c of candidates) {
  // Guard the UPDATE with the same predicates from the SELECT so a
  // concurrent Stripe webhook that lands a subscription between the
  // SELECT and the UPDATE can't be clobbered by this sweep.
  execSqlite(
    dbPath,
    `UPDATE users
       SET tier = 'public', updated_at = '${escapeSqlLiteral(nowIso)}'
     WHERE id = '${escapeSqlLiteral(c.id)}'
       AND founding_eligible = 1
       AND founding_member_started_at IS NULL
       AND tier IN ('pro', 'basic')
       AND (
         stripe_subscription_id IS NULL
         OR subscription_status IS NULL
         OR subscription_status NOT IN ('active', 'trialing')
       );`,
  );
  const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
  execSqlite(
    dbPath,
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (
       '${escapeSqlLiteral(auditId)}',
       'founding_cohort_expired',
       '${escapeSqlLiteral(c.id)}',
       NULL,
       '${escapeSqlLiteral(c.email)}',
       'expire-founding-cohort-script',
       '${escapeSqlLiteral(`founding deadline passed; tier ${c.tier} -> public`)}',
       '${escapeSqlLiteral(nowIso)}'
     );`,
  );
}

console.log(`\nDowngraded ${candidates.length} founding-cohort user(s) to tier='public'.`);
