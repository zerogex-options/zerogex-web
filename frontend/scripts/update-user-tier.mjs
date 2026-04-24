#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const VALID_TIERS = ['public', 'starter', 'pro', 'elite', 'admin'];

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

function printUsage() {
  console.log(`Usage:
  node scripts/update-user-tier.mjs --email <email> --tier <${VALID_TIERS.join('|')}>
  node scripts/update-user-tier.mjs --migrate-basic [--tier starter]

Options:
  --email <email>          Email of the user to update.
  --tier <tier>            Target tier. One of: ${VALID_TIERS.join(', ')}.
  --migrate-basic          Bulk-migrate every user with the legacy tier "basic"
                           to --tier (defaults to "starter").
  --dry-run                Show what would change without writing.
  -h, --help               Show this help.

Environment:
  AUTH_DB_PATH             Path to auth.db (otherwise read from .env.local
                           or defaults to ./data/auth.db).
`);
}

function parseArgs(argv) {
  const args = { email: null, tier: null, migrateBasic: false, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '--email':
        args.email = argv[++i];
        break;
      case '--tier':
        args.tier = argv[++i];
        break;
      case '--migrate-basic':
        args.migrateBasic = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      default:
        console.error(`Unknown argument: ${token}`);
        printUsage();
        process.exit(1);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printUsage();
  process.exit(0);
}

if (!args.migrateBasic && !args.email) {
  console.error('Error: --email is required (or pass --migrate-basic for bulk migration).');
  printUsage();
  process.exit(1);
}

if (args.email && !args.tier) {
  console.error('Error: --tier is required when --email is supplied.');
  printUsage();
  process.exit(1);
}

const targetTier = args.tier ?? 'starter';
if (!VALID_TIERS.includes(targetTier)) {
  console.error(`Error: invalid tier "${targetTier}". Valid: ${VALID_TIERS.join(', ')}`);
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const dbPath =
  process.env.AUTH_DB_PATH ||
  envLocal.AUTH_DB_PATH ||
  path.join(cwd, 'data', 'auth.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
const nowIso = () => new Date().toISOString();

if (args.migrateBasic) {
  const rows = db
    .prepare(`SELECT id, email, tier FROM users WHERE tier = 'basic'`)
    .all();

  if (rows.length === 0) {
    console.log(`No users found with legacy tier "basic" in ${dbPath}.`);
    process.exit(0);
  }

  console.log(`Auth DB: ${dbPath}`);
  console.log(`Migrating ${rows.length} user(s) from "basic" -> "${targetTier}"${args.dryRun ? ' [dry-run]' : ''}:`);
  for (const row of rows) {
    console.log(`  - ${row.email} (${row.id})`);
  }

  if (args.dryRun) {
    process.exit(0);
  }

  const update = db.prepare(
    `UPDATE users SET tier = ?, updated_at = ? WHERE tier = 'basic'`,
  );
  const result = update.run(targetTier, nowIso());
  console.log(`\nUpdated ${result.changes} user(s).`);
  process.exit(0);
}

const normalizedEmail = args.email.trim().toLowerCase();
const user = db
  .prepare(`SELECT id, email, tier FROM users WHERE email = ?`)
  .get(normalizedEmail);

if (!user) {
  console.error(`No user found with email: ${normalizedEmail}`);
  process.exit(1);
}

if (user.tier === targetTier) {
  console.log(`User ${user.email} is already on tier "${targetTier}". No change.`);
  process.exit(0);
}

console.log(`Auth DB: ${dbPath}`);
console.log(
  `Updating ${user.email} (${user.id}): ${user.tier} -> ${targetTier}${args.dryRun ? ' [dry-run]' : ''}`,
);

if (args.dryRun) {
  process.exit(0);
}

const result = db
  .prepare(`UPDATE users SET tier = ?, updated_at = ? WHERE id = ?`)
  .run(targetTier, nowIso(), user.id);

if (result.changes === 1) {
  console.log(`Done. ${user.email} is now on tier "${targetTier}".`);
} else {
  console.error(`Update did not affect any rows.`);
  process.exit(1);
}
