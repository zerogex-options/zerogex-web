#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types --no-warnings \
//     scripts/backfill-reactivation-entitlement.mts \
//     [--campaign <key>] [--email <addr>] [--dry-run | --yes]
//
// Grants the extended-trial ENTITLEMENT to accounts that were already promised
// it by an email that did not claim the latch.
//
// Why this exists: checkout derives the extended trial from exactly one column
// (app/api/billing/checkout/route.ts, reactivationEligible):
//
//     reactivationRequested && !hasPriorPaidSubscription
//       && users.reactivation_email_sent_at IS NOT NULL
//
// Only scripts/send-reactivation.mts used to write that column. The 2026-08
// product update's `registrants` variant promised "your extended free trial"
// and pointed at /pricing?trial=1&reactivate=1, but stamped nothing — so every
// recipient saw the longer trial on /pricing (the page renders that number
// straight from the URL param) and would have been charged after the standard
// TRIAL_PERIOD_DAYS at Stripe. send-product-update.mts now stamps on send; this
// script repairs the batch that already went out.
//
// Selection:
//   --campaign <key>  every user with a `<key>_sent` audit row (default
//                     product_update_2026_08 — the send that caused this).
//   --email <addr>    one account, for honoring the offer for a member who
//                     wrote in. Warns if they have no matching campaign row,
//                     since then nobody actually promised them anything.
//
// Only trial-eligible accounts are touched: an account with prior paid history
// gets no trial at all (hasPriorPaidSubscription in the checkout route), so
// stamping it would be a lie in the audit log with no effect on billing. An
// account that already has the column set is left alone — its existing
// timestamp is the real one.
//
// The stamp is written with the timestamp the offer was actually MADE (the
// campaign audit row's created_at), not "now", so the column keeps meaning
// "when this account was pitched the extended trial".
//
// Side effect, and it is intended: a stamped account is no longer eligible for
// scripts/send-reactivation.mts, which would otherwise send the same
// extended-trial pitch a second time.
//
// Idempotent: re-running stamps nobody twice (the UPDATE is guarded on
// IS NULL, and stamped users drop out of the selection).
//
// AUTH_DB_PATH overrides the DB. Requires the sqlite3 CLI on PATH.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const DEFAULT_CAMPAIGN_KEY = 'product_update_2026_08';

type Args = {
  campaign: string;
  email: string | null;
  dryRun: boolean;
  yes: boolean;
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
  const args: Args = {
    campaign: DEFAULT_CAMPAIGN_KEY,
    email: null,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--campaign') args.campaign = argv[++i] ?? '';
    else if (arg === '--email' || arg === '-e') args.email = argv[++i] ?? null;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings \\
    scripts/backfill-reactivation-entitlement.mts [options]

Stamps users.reactivation_email_sent_at for accounts that were promised the
extended trial by a campaign email that did not claim the latch, so the
checkout route will actually grant it.

Options:
  --campaign <key>   Audit-event key of the send to repair
                     (default: ${DEFAULT_CAMPAIGN_KEY}). Users are selected by
                     their '<key>_sent' audit row.
  --email <addr>     Stamp this one account instead of a whole campaign.
  --dry-run          List who would be stamped; change nothing.
  --yes, -y          Apply the stamps.
  --help, -h         Show this help.

Set AUTH_DB_PATH in frontend/.env.local or the shell to override the DB path.`);
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH.');
    console.error('Install it with: sudo apt-get install sqlite3');
    process.exit(1);
  }
}

function esc(value: string): string {
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
      typeof stderr === 'string' ? stderr : (stderr?.toString?.() ?? (err as Error).message);
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

const cli = parseArgs(process.argv.slice(2));
if (cli.help) {
  usage();
  process.exit(0);
}
if (cli.dryRun && cli.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}
if (!cli.campaign && !cli.email) {
  console.error('Error: --campaign must not be empty (or pass --email).');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}
ensureSqlite3Cli();

// The column is created by the lazy migration in core/db.ts, which runs when
// the Next.js app boots. Without it every UPDATE below fails; say so plainly.
const userCols = new Set(
  querySqlite<{ name: string }>(dbPath, `PRAGMA table_info(users);`).map((c) => c.name),
);
if (!userCols.has('reactivation_email_sent_at')) {
  console.error(
    `Auth DB at ${dbPath} has no users.reactivation_email_sent_at column.\n` +
      'Start (or restart) the Next.js app once to run the migration in core/db.ts.',
  );
  process.exit(1);
}

const auditType = `${cli.campaign}_sent`;

type Candidate = {
  id: string;
  email: string;
  created_at: string | null;
  offered_at: string | null;
  reactivation_email_sent_at: string | null;
  paid_welcome_email_sent_at: string | null;
  subscription_lapsed: number | null;
};

// offered_at is the campaign audit row's timestamp — when the promise was
// actually made. MIN() because a re-run of a send can leave more than one row;
// the first one is when the member was told.
const offeredAtSubquery = `(SELECT MIN(a.created_at) FROM audit_events a
                             WHERE a.user_id = u.id AND a.type = '${esc(auditType)}')`;

const selection = cli.email
  ? `LOWER(u.email) = '${esc(cli.email.toLowerCase())}'`
  : `${offeredAtSubquery} IS NOT NULL`;

// deleted_at is a later column than the rest; skip the filter rather than die
// on a DB that predates it (a DB without it has no self-deleted accounts).
const notDeleted = userCols.has('deleted_at') ? 'AND u.deleted_at IS NULL' : '';

const candidates = querySqlite<Candidate>(
  dbPath,
  `SELECT u.id, u.email, u.created_at,
          ${offeredAtSubquery} AS offered_at,
          u.reactivation_email_sent_at,
          u.paid_welcome_email_sent_at,
          u.subscription_lapsed
     FROM users u
    WHERE ${selection}
      ${notDeleted}
    ORDER BY u.created_at ASC;`,
);

if (cli.email && candidates.length === 0) {
  console.error(`No user found with email ${cli.email}`);
  process.exit(1);
}

// Mirrors hasPriorPaidSubscription in app/api/billing/checkout/route.ts: these
// accounts get no trial of any length, so a stamp would change nothing.
const hasPriorPaid = (c: Candidate) =>
  c.paid_welcome_email_sent_at != null || Number(c.subscription_lapsed) === 1;
const priorPaid = candidates.filter(hasPriorPaid);
const alreadyStamped = candidates.filter(
  (c) => !hasPriorPaid(c) && c.reactivation_email_sent_at != null,
);
const toStamp = candidates.filter(
  (c) => !hasPriorPaid(c) && c.reactivation_email_sent_at == null,
);

console.log(`Auth DB:         ${dbPath}`);
console.log(`Selection:       ${cli.email ? `email ${cli.email}` : `audit type ${auditType}`}`);
console.log(`Matched:         ${candidates.length}`);
console.log(`Already stamped: ${alreadyStamped.length} (left as-is)`);
console.log(`Not trial-eligible: ${priorPaid.length} (prior paid subscription — skipped)`);
console.log(`To stamp:        ${toStamp.length}`);

if (cli.email && toStamp.length > 0 && toStamp[0].offered_at == null) {
  console.warn(
    `\nWarning: ${toStamp[0].email} has no '${auditType}' audit row, so this campaign\n` +
      'never promised them the extended trial. Stamping is a manual goodwill grant —\n' +
      'the audit row written below will say so.',
  );
}

if (toStamp.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

const SAMPLE = 30;
console.log('');
for (const c of toStamp.slice(0, SAMPLE)) {
  console.log(`  - ${c.email}  (offered ${c.offered_at ?? 'n/a — manual grant'})`);
}
if (toStamp.length > SAMPLE) console.log(`  ... and ${toStamp.length - SAMPLE} more`);

if (!cli.yes) {
  console.log(
    `\n${cli.dryRun ? 'Dry run' : 'Refusing to write'} — nothing changed. ` +
      'Re-run with --yes to apply.',
  );
  process.exit(0);
}

// One transaction for the whole batch: a half-applied backfill is worse than
// none, because the second run cannot tell which half was already honored from
// the users table alone.
const nowIso = new Date().toISOString();
const statements: string[] = [];
for (const c of toStamp) {
  const stampedAt = c.offered_at ?? nowIso;
  const source = c.offered_at ? `campaign ${cli.campaign}` : 'manual grant';
  statements.push(
    `UPDATE users SET reactivation_email_sent_at = '${esc(stampedAt)}'
       WHERE id = '${esc(c.id)}' AND reactivation_email_sent_at IS NULL;`,
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES ('audit_${crypto.randomBytes(12).toString('hex')}',
             'reactivation_entitlement_backfilled', '${esc(c.id)}', NULL,
             '${esc(c.email)}', 'backfill-reactivation-entitlement',
             '${esc(`Extended-trial entitlement granted (${source}); reactivation_email_sent_at set to ${stampedAt}`)}',
             '${esc(nowIso)}');`,
  );
}

try {
  execSqlite(dbPath, `BEGIN IMMEDIATE;\n${statements.join('\n')}\nCOMMIT;`);
} catch (err) {
  console.error(`\nBackfill failed, nothing was written: ${(err as Error).message}`);
  process.exit(1);
}

console.log(`\nDone. Stamped ${toStamp.length} account(s).`);
console.log(
  'They now get the extended trial from /pricing?trial=1&reactivate=1, and are no\n' +
    'longer eligible for the automated reactivation email.',
);
