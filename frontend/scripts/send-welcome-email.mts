#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-welcome-email.mts \
//     --email <user@example.com> [--variant paid|founding|welcome-back] \
//     [--force] [--dry-run]
//
// Out-of-band trigger for the paid-welcome / founding-welcome / welcome-back
// email, for cases where the Stripe webhook missed the send (race condition
// on concurrent customer.subscription.* events, Resend transient failure,
// etc.). Stamps users.paid_welcome_email_sent_at and writes an audit_events
// row that mirrors what the webhook would have written, so the next webhook
// delivery for this customer won't double-send.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import {
  sendPaidWelcomeEmail,
  sendFoundingWelcomeEmail,
  sendWelcomeBackEmail,
} from '../core/mailer.ts';

type Variant = 'paid' | 'founding' | 'welcome-back';
const VALID_VARIANTS: Variant[] = ['paid', 'founding', 'welcome-back'];

type Args = {
  email: string | null;
  variant: Variant;
  force: boolean;
  dryRun: boolean;
  help: boolean;
};

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    email: null,
    variant: 'paid',
    force: false,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = argv[++i] ?? null;
    else if (arg === '--variant' || arg === '-v') args.variant = (argv[++i] ?? '') as Variant;
    else if (arg === '--force') args.force = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-welcome-email.mts \\
    --email <user@example.com> [--variant <variant>] [--force] [--dry-run]

Options:
  -e, --email <email>      Target user (required).
  -v, --variant <variant>  paid | founding | welcome-back. Default: paid.
      --force              Send even if paid_welcome_email_sent_at is already
                           set (only meaningful for paid/founding).
      --dry-run            Print what would happen without sending or writing.
  -h, --help               Show this help.

Reads RESEND_API_KEY and RESEND_FROM_EMAIL from the environment or .env.local.
Set AUTH_DB_PATH (env or .env.local) to override the default DB path.

Side effects on success:
  - Sends the email via Resend.
  - For paid/founding: stamps users.paid_welcome_email_sent_at.
  - Inserts a paid_welcome_email_sent (or paid_welcome_back_email_sent) row
    into audit_events with ip='manual-script' for traceability.`);
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

if (!cliArgs.email) {
  console.error('Error: --email is required.');
  usage();
  process.exit(1);
}

if (!VALID_VARIANTS.includes(cliArgs.variant)) {
  console.error(
    `Error: invalid --variant "${cliArgs.variant}". Expected one of: ${VALID_VARIANTS.join(', ')}.`,
  );
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));

const RESEND_API_KEY = process.env.RESEND_API_KEY || envLocal.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || envLocal.RESEND_FROM_EMAIL;

if (!RESEND_API_KEY) {
  console.error('Error: RESEND_API_KEY not set in env or .env.local.');
  process.exit(1);
}
if (!RESEND_FROM_EMAIL) {
  console.error('Error: RESEND_FROM_EMAIL not set in env or .env.local.');
  process.exit(1);
}

// mailer.ts reads these lazily inside getClient()/getFromAddress(), so setting
// them here (after the static import above) is correct.
process.env.RESEND_API_KEY = RESEND_API_KEY;
process.env.RESEND_FROM_EMAIL = RESEND_FROM_EMAIL;

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

ensureSqlite3Cli();

const email = cliArgs.email.trim().toLowerCase();

type UserRow = {
  id: string;
  email: string;
  tier: string;
  paid_welcome_email_sent_at: string | null;
};

const rows = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, tier, paid_welcome_email_sent_at
   FROM users WHERE email = '${escapeSqlLiteral(email)}';`,
);

if (rows.length === 0) {
  console.error(`No user found with email: ${email}`);
  process.exit(2);
}

const user = rows[0];
const stampsThisVariant = cliArgs.variant === 'paid' || cliArgs.variant === 'founding';

if (stampsThisVariant && user.paid_welcome_email_sent_at && !cliArgs.force) {
  console.error(
    `paid_welcome_email_sent_at already set for ${email} (${user.paid_welcome_email_sent_at}).`,
  );
  console.error('Re-run with --force to send anyway.');
  process.exit(3);
}

console.log(`Auth DB:    ${dbPath}`);
console.log(`User:       ${user.email} (id=${user.id}, tier=${user.tier})`);
console.log(`Variant:    ${cliArgs.variant}`);
console.log(`Prior stamp: ${user.paid_welcome_email_sent_at ?? '(none)'}`);

if (cliArgs.dryRun) {
  console.log(`\n[dry-run] Would send "${cliArgs.variant}" welcome email to ${email}.`);
  if (stampsThisVariant) {
    console.log(`[dry-run] Would stamp paid_welcome_email_sent_at and insert audit row.`);
  } else {
    console.log(`[dry-run] Would insert audit row (welcome-back does not stamp).`);
  }
  process.exit(0);
}

if (cliArgs.variant === 'paid') {
  await sendPaidWelcomeEmail(email);
} else if (cliArgs.variant === 'founding') {
  await sendFoundingWelcomeEmail(email);
} else {
  await sendWelcomeBackEmail(email);
}

const nowIso = new Date().toISOString();

if (stampsThisVariant) {
  execSqlite(
    dbPath,
    `UPDATE users
     SET paid_welcome_email_sent_at = '${escapeSqlLiteral(nowIso)}',
         updated_at = '${escapeSqlLiteral(nowIso)}'
     WHERE id = '${escapeSqlLiteral(user.id)}';`,
  );
}

const auditId = `audit_manual_${crypto.randomBytes(12).toString('hex')}`;
const auditType =
  cliArgs.variant === 'welcome-back'
    ? 'paid_welcome_back_email_sent'
    : 'paid_welcome_email_sent';
const auditMessage =
  `Manually sent ${cliArgs.variant} welcome email via scripts/send-welcome-email.mts` +
  (cliArgs.force && user.paid_welcome_email_sent_at
    ? ` (forced; prior stamp was ${user.paid_welcome_email_sent_at})`
    : '');

execSqlite(
  dbPath,
  `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
   VALUES (
     '${escapeSqlLiteral(auditId)}',
     '${escapeSqlLiteral(auditType)}',
     '${escapeSqlLiteral(user.id)}',
     NULL,
     '${escapeSqlLiteral(email)}',
     'manual-script',
     '${escapeSqlLiteral(auditMessage)}',
     '${escapeSqlLiteral(nowIso)}'
   );`,
);

console.log(`\nSent ${cliArgs.variant} welcome email to ${email}.`);
if (stampsThisVariant) {
  console.log(`Stamped users.paid_welcome_email_sent_at = ${nowIso}.`);
}
console.log(`Wrote audit_events row id=${auditId} type=${auditType}.`);
