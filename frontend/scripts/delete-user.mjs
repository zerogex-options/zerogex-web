#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import readline from 'node:readline';

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
  const args = { email: null, dryRun: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') {
      args.email = argv[++i];
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--yes' || arg === '-y') {
      args.yes = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/delete-user.mjs --email <user@example.com> [--dry-run] [--yes]

Options:
  -e, --email <email>       Target user to delete (matched case-insensitively).
      --dry-run             Print what would be deleted without writing.
  -y, --yes                 Skip the interactive confirmation prompt.
  -h, --help                Show this help.

Deletes the user row and cascades to sessions and user_identities (via
ON DELETE CASCADE). Also clears matching audit_events rows (no FK).

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

function confirm(prompt) {
  if (!process.stdin.isTTY) return Promise.resolve(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  usage();
  process.exit(0);
}

if (!cliArgs.email) {
  console.error('Error: --email is required.');
  usage();
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

const email = cliArgs.email.trim().toLowerCase();

try {
  const userRows = querySqlite(
    dbPath,
    `SELECT id, email, tier, created_at FROM users WHERE email = '${escapeSqlLiteral(email)}';`
  );

  if (userRows.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(2);
  }

  const user = userRows[0];
  const userIdLit = `'${escapeSqlLiteral(user.id)}'`;

  const sessionCount = querySqlite(
    dbPath,
    `SELECT COUNT(*) AS n FROM sessions WHERE user_id = ${userIdLit};`
  )[0]?.n ?? 0;
  const identityCount = querySqlite(
    dbPath,
    `SELECT COUNT(*) AS n FROM user_identities WHERE user_id = ${userIdLit};`
  )[0]?.n ?? 0;
  const auditCount = querySqlite(
    dbPath,
    `SELECT COUNT(*) AS n FROM audit_events WHERE user_id = ${userIdLit} OR actor_user_id = ${userIdLit};`
  )[0]?.n ?? 0;

  console.log(`User: ${user.email} (${user.id})`);
  console.log(`  tier:        ${user.tier}`);
  console.log(`  created_at:  ${user.created_at}`);
  console.log(`  sessions:    ${sessionCount} (cascade)`);
  console.log(`  identities:  ${identityCount} (cascade)`);
  console.log(`  audit rows:  ${auditCount} (manual cleanup)`);

  if (cliArgs.dryRun) {
    console.log(`[dry-run] Would delete user ${user.email} and the rows above.`);
    process.exit(0);
  }

  if (!cliArgs.yes) {
    const ok = await confirm(`Delete ${user.email}? Type "y" to confirm: `);
    if (!ok) {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  execSqlite(
    dbPath,
    `PRAGMA foreign_keys = ON;
     BEGIN;
     DELETE FROM audit_events WHERE user_id = ${userIdLit} OR actor_user_id = ${userIdLit};
     DELETE FROM sessions WHERE user_id = ${userIdLit};
     DELETE FROM user_identities WHERE user_id = ${userIdLit};
     DELETE FROM password_reset_tokens WHERE user_id = ${userIdLit};
     DELETE FROM users WHERE id = ${userIdLit};
     COMMIT;`
  );
  console.log(`Deleted ${user.email} (${user.id}).`);
} catch (err) {
  console.error(`sqlite3 error: ${err.message}`);
  process.exit(1);
}
