#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const env = {};
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

function parseArgs(argv) {
  const args = { dryRun: false, yes: false, before: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--before') args.before = argv[++i];
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/seed-founders.mjs [--before <iso>] [--dry-run | --yes]

Flags every existing user as founding_eligible=1 so they can redeem the
founding-member code at checkout. New signups (created_at after the cutoff)
default to founding_eligible=0 and remain ineligible.

Options:
      --before <iso>        Only flag users with created_at < <iso>.
                            Defaults to the current time, so a single run
                            flags everyone in the DB right now.
      --dry-run             Print counts + a sample of users without writing.
  -y, --yes                 Apply the update.
  -h, --help                Show this help.

Idempotent: re-running after the first execution only flags users newly
created before the cutoff and not yet flagged. Pass an explicit --before
to freeze the cohort at a known timestamp.

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

if (cliArgs.dryRun && cliArgs.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}

const cutoffIso = cliArgs.before ?? new Date().toISOString();
if (Number.isNaN(Date.parse(cutoffIso))) {
  console.error(`Error: --before "${cutoffIso}" is not a valid ISO timestamp.`);
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

console.log(`Auth DB: ${dbPath}`);
console.log(`Cutoff:  created_at < ${cutoffIso}`);

const toFlag = querySqlite(
  dbPath,
  `SELECT id, email, tier, created_at FROM users
   WHERE founding_eligible = 0 AND created_at < '${escapeSqlLiteral(cutoffIso)}'
   ORDER BY created_at ASC;`,
);

if (toFlag.length === 0) {
  console.log('No users to flag. Either all eligible users are already flagged or the cutoff excludes everyone.');
  process.exit(0);
}

console.log(`Users to flag: ${toFlag.length}`);
const sample = toFlag.slice(0, 5);
for (const u of sample) {
  console.log(`  - ${u.email} (tier=${u.tier}, created=${u.created_at})`);
}
if (toFlag.length > sample.length) {
  console.log(`  ... and ${toFlag.length - sample.length} more`);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No changes written.');
  process.exit(0);
}

if (!cliArgs.yes) {
  console.log('\nRefusing to write without --yes. Re-run with --yes to apply, or --dry-run to preview.');
  process.exit(1);
}

const nowIso = new Date().toISOString();
execSqlite(
  dbPath,
  `UPDATE users
   SET founding_eligible = 1, updated_at = '${escapeSqlLiteral(nowIso)}'
   WHERE founding_eligible = 0 AND created_at < '${escapeSqlLiteral(cutoffIso)}';`,
);
console.log(`\nFlagged ${toFlag.length} user(s) as founding_eligible=1.`);
