#!/usr/bin/env node

// Downgrade Creator Partners whose 90-day Pro grant has expired and who
// haven't started a paid subscription on their own. Designed to run daily
// from cron / a scheduled job.
//
// Safe under repeat runs: a partner who was already downgraded has tier
// != 'pro', so the WHERE clause excludes them and the cron is a no-op.
//
// partner_tier='creator' STAYS SET on downgrade — the partner can still
// refer audience members and accrue commissions; they just no longer get
// comped Pro access. That preserves attribution while reflecting that the
// "free 90 days" is genuinely over.

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
  node scripts/expire-partner-grants.mjs (--dry-run | --yes)

Downgrades partners whose grant has expired AND who don't have an active
paid subscription. Intended as a daily cron.

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

// Pre-flight: the partner_* columns are added by the App's lazy migration
// (frontend/core/db.ts initDb), which only runs on first DB touch from the
// PM2 process. If the timer ran before that migration landed (e.g. after a
// --start-from <step> deploy that skipped the rebuild), surface a clear
// remediation instead of the raw "no such column" SQL error.
const userCols = new Set(
  querySqlite(dbPath, `PRAGMA table_info(users);`).map((c) => c.name),
);
if (!userCols.has('partner_pro_grant_expires_at')) {
  console.error('Error: the partner_* columns are not present on the users table yet.');
  console.error('The auth DB schema migration has not run against this database file.');
  console.error('Fix: cd ~/zerogex-web && make migrate   (forces the lazy migration to run)');
  console.error('     or run a full deploy (`make rebuild` or `./deploy/deploy.sh`) and then');
  console.error('     hit any /api/* endpoint to trigger the migration via the app process.');
  process.exit(4);
}

const nowIso = new Date().toISOString();

// Eligible to downgrade: partner with an expired grant, currently on tier=pro,
// who is not currently in an active/trialing Stripe subscription. The
// subscription_status filter prevents fighting with the webhook for paying
// users who upgraded mid-grant.
const candidates = querySqlite(
  dbPath,
  `SELECT id, email, tier, partner_pro_grant_expires_at, subscription_status,
          stripe_subscription_id
   FROM users
   WHERE partner_tier = 'creator'
     AND partner_pro_grant_expires_at IS NOT NULL
     AND partner_pro_grant_expires_at < '${escapeSqlLiteral(nowIso)}'
     AND tier = 'pro'
     AND (
       stripe_subscription_id IS NULL
       OR subscription_status IS NULL
       OR subscription_status NOT IN ('active', 'trialing')
     );`,
);

console.log(`Auth DB: ${dbPath}`);
console.log(`Cutoff:  partner_pro_grant_expires_at < ${nowIso}`);
console.log(`Candidates: ${candidates.length}`);

for (const c of candidates) {
  console.log(
    `  - ${c.email}  expired=${c.partner_pro_grant_expires_at}  sub=${c.subscription_status ?? '(none)'}`,
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
  execSqlite(
    dbPath,
    `UPDATE users SET tier = 'public', updated_at = '${escapeSqlLiteral(nowIso)}'
     WHERE id = '${escapeSqlLiteral(c.id)}' AND tier = 'pro';`,
  );
  const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
  execSqlite(
    dbPath,
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (
       '${escapeSqlLiteral(auditId)}',
       'partner_grant_expired',
       '${escapeSqlLiteral(c.id)}',
       NULL,
       '${escapeSqlLiteral(c.email)}',
       'expire-partner-grants-script',
       '${escapeSqlLiteral(`grant expired at ${c.partner_pro_grant_expires_at}; tier pro -> public`)}',
       '${escapeSqlLiteral(nowIso)}'
     );`,
  );
}

console.log(`\nDowngraded ${candidates.length} partner(s) to tier='public'.`);
