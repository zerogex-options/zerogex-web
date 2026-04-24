#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const VALID_TIERS = ['public', 'starter', 'pro', 'elite', 'admin'];
// Legacy tier ids that need to be rewritten to their current equivalent.
const TIER_ALIASES = { basic: 'starter' };

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const env = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    env[key] = value;
  }

  return env;
}

function parseArgs(argv) {
  const args = { email: null, tier: null, all: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') {
      args.email = argv[++i];
    } else if (arg === '--tier' || arg === '-t') {
      args.tier = argv[++i];
    } else if (arg === '--all-from') {
      args.all = argv[++i];
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/update-user-tier.mjs --email <user@example.com> --tier <tier>
  node scripts/update-user-tier.mjs --all-from <old-tier> --tier <new-tier>

Options:
  -e, --email <email>       Target a specific user by email.
  -t, --tier <tier>         New tier (one of: ${VALID_TIERS.join(', ')}).
      --all-from <tier>     Migrate every user currently on <tier> to --tier.
                            Accepts legacy tier ids (e.g. "basic").
      --dry-run             Print what would change without writing.
  -h, --help                Show this help.

Examples:
  # Promote a single user to elite
  node scripts/update-user-tier.mjs --email trader@example.com --tier elite

  # Migrate every legacy "basic" user to "starter"
  node scripts/update-user-tier.mjs --all-from basic --tier starter

Requires the sqlite3 CLI (\`apt-get install sqlite3\` on Ubuntu).
Set AUTH_DB_PATH (env or frontend/.env.local) to override the default DB path.`);
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

if (!cliArgs.tier) {
  console.error('Error: --tier is required.');
  usage();
  process.exit(1);
}

const nextTier = TIER_ALIASES[cliArgs.tier] ?? cliArgs.tier;
if (!VALID_TIERS.includes(nextTier)) {
  console.error(`Error: invalid tier "${cliArgs.tier}". Expected one of: ${VALID_TIERS.join(', ')}.`);
  process.exit(1);
}

if (!cliArgs.email && !cliArgs.all) {
  console.error('Error: provide either --email or --all-from.');
  usage();
  process.exit(1);
}

if (cliArgs.email && cliArgs.all) {
  console.error('Error: --email and --all-from are mutually exclusive.');
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

ensureSqlite3Cli();

const nowIso = () => new Date().toISOString();

function updateSingle(rawEmail) {
  const email = rawEmail.trim().toLowerCase();
  const rows = querySqlite(
    dbPath,
    `SELECT id, email, tier FROM users WHERE email = '${escapeSqlLiteral(email)}';`
  );

  if (rows.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(2);
  }

  const row = rows[0];
  if (row.tier === nextTier) {
    console.log(`No change: ${row.email} is already on tier "${nextTier}".`);
    return;
  }

  if (cliArgs.dryRun) {
    console.log(`[dry-run] Would update ${row.email}: ${row.tier} -> ${nextTier}`);
    return;
  }

  execSqlite(
    dbPath,
    `UPDATE users SET tier = '${escapeSqlLiteral(nextTier)}', updated_at = '${escapeSqlLiteral(nowIso())}' WHERE id = '${escapeSqlLiteral(row.id)}';`
  );
  console.log(`Updated ${row.email}: ${row.tier} -> ${nextTier}`);
}

function updateAllFrom(fromTier) {
  const rows = querySqlite(
    dbPath,
    `SELECT id, email, tier FROM users WHERE tier = '${escapeSqlLiteral(fromTier)}';`
  );

  if (rows.length === 0) {
    console.log(`No users currently on tier "${fromTier}".`);
    return;
  }

  if (cliArgs.dryRun) {
    console.log(`[dry-run] Would update ${rows.length} user(s) from "${fromTier}" to "${nextTier}":`);
    for (const r of rows) console.log(`  - ${r.email}`);
    return;
  }

  execSqlite(
    dbPath,
    `UPDATE users SET tier = '${escapeSqlLiteral(nextTier)}', updated_at = '${escapeSqlLiteral(nowIso())}' WHERE tier = '${escapeSqlLiteral(fromTier)}';`
  );
  console.log(`Updated ${rows.length} user(s) from "${fromTier}" to "${nextTier}".`);
}

console.log(`Auth DB: ${dbPath}`);

try {
  if (cliArgs.email) {
    updateSingle(cliArgs.email);
  } else {
    updateAllFrom(cliArgs.all);
  }
} catch (err) {
  console.error(`sqlite3 error: ${err.message}`);
  process.exit(1);
}
