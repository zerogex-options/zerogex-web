#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/backfill-refund-audit.mts \
//     [--dry-run | --yes] [--since YYYY-MM-DD] [--limit N]
//
// One-shot backfill of `refund_issued` audit rows for refunds issued BEFORE the
// webhook started recording them.
//
// The charge.refunded handler used to write an audit row only when a partner
// commission had to be reversed, so every refund to a member without a referrer
// left no trace. Stripe keeps a refunded invoice's status as 'paid' (the refund
// lives on the charge), so scripts/diagnose-user.mts showed the cancellation and
// nothing about the money going back. This walks Stripe's refund list and writes
// the missing rows.
//
// Each row is stamped with the REFUND's own created time, not now, so the
// history lands in the right place in diagnose-user's chronology. Rows are
// marked ip='backfill-script' and '[backfilled re_...]' so they are never
// mistaken for a live webhook record.
//
// Idempotent: a refund is skipped when a refund_issued row already mentions
// either its refund id or its charge id, so re-running adds nothing and it
// cannot double-write over rows the live webhook has since recorded.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

const DEFAULT_LIMIT = 500;

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  since: string | null;
  limit: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, yes: false, help: false, since: null, limit: DEFAULT_LIMIT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--since') args.since = argv[(i += 1)] ?? null;
    else if (arg === '--limit') args.limit = Number(argv[(i += 1)]);
  }
  if (!Number.isFinite(args.limit) || args.limit <= 0) args.limit = DEFAULT_LIMIT;
  return args;
}

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

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function runSqlite(dbPath: string, sql: string): string {
  return execFileSync('sqlite3', ['-json', dbPath, sql], { encoding: 'utf8' });
}

function querySqlite<T = Record<string, unknown>>(dbPath: string, sql: string): T[] {
  const out = runSqlite(dbPath, sql).trim();
  return out ? (JSON.parse(out) as T[]) : [];
}

function ensureSqlite3Cli(): void {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH.');
    console.error('Install it with: sudo apt-get install sqlite3');
    process.exit(1);
  }
}

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  console.log(`
Usage: backfill-refund-audit.mts [--dry-run | --yes] [--since YYYY-MM-DD] [--limit N]

Writes the refund_issued audit rows that the old charge.refunded handler never
recorded (it logged only when a partner commission reversed).

  --dry-run        List what would be written. No DB writes. 
  --yes            Actually write the rows.
  --since <date>   Only refunds created on or after this date (default: all).
  --limit N        Cap refunds examined (default ${DEFAULT_LIMIT}).
  -h, --help       Show this help.

Idempotent — a refund already represented in audit_events is skipped, so
re-running is safe. Rows carry the refund's own timestamp, not the run time.

Reads STRIPE_SECRET_KEY and AUTH_DB_PATH from env or frontend/.env.local.`.trim());
  process.exit(0);
}

if (!cliArgs.dryRun && !cliArgs.yes) {
  console.error('Refusing to run without --dry-run or --yes. Start with --dry-run.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || envLocal.STRIPE_SECRET_KEY || '';
const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');

if (!STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set (env or frontend/.env.local). Refunds come from Stripe.');
  process.exit(1);
}
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}
ensureSqlite3Cli();

const stripe = new Stripe(STRIPE_SECRET_KEY);

const listParams: Stripe.RefundListParams = { limit: 100 };
if (cliArgs.since) {
  const sinceMs = Date.parse(`${cliArgs.since}T00:00:00Z`);
  if (Number.isNaN(sinceMs)) {
    console.error(`Could not parse --since "${cliArgs.since}". Use YYYY-MM-DD.`);
    process.exit(1);
  }
  listParams.created = { gte: Math.floor(sinceMs / 1000) };
}

console.log(`Auth DB:        ${dbPath}`);
console.log(`Mode:           ${cliArgs.dryRun ? 'DRY RUN (no writes)' : 'WRITING'}`);
console.log(`Since:          ${cliArgs.since ?? 'all time'}`);

const refunds = await stripe.refunds.list(listParams).autoPagingToArray({ limit: cliArgs.limit });
console.log(`Refunds found:  ${refunds.length}`);
console.log('');

let written = 0;
let skipped = 0;
let failed = 0;

for (const refund of refunds) {
  const chargeId =
    typeof refund.charge === 'string' ? refund.charge : (refund.charge?.id ?? null);
  if (!chargeId) {
    console.log(`  ${refund.id}  SKIP — no charge on the refund`);
    skipped += 1;
    continue;
  }

  // Conservative idempotency: either identifier already present means this
  // refund is represented, whether by an earlier backfill or the live webhook.
  const existing = querySqlite<{ id: string }>(
    dbPath,
    `SELECT id FROM audit_events
     WHERE type = 'refund_issued'
       AND (message LIKE '%${escapeSqlLiteral(refund.id)}%'
            OR message LIKE '%${escapeSqlLiteral(chargeId)}%')
     LIMIT 1;`,
  );
  if (existing.length > 0) {
    skipped += 1;
    continue;
  }

  let charge: Stripe.Charge;
  try {
    charge = await stripe.charges.retrieve(chargeId);
  } catch (err) {
    console.log(`  ${refund.id}  FAIL — could not read charge ${chargeId}: ${String(err)}`);
    failed += 1;
    continue;
  }

  const customerId =
    typeof charge.customer === 'string' ? charge.customer : (charge.customer?.id ?? null);
  const user = customerId
    ? (querySqlite<{ id: string; email: string }>(
        dbPath,
        `SELECT id, email FROM users
         WHERE stripe_customer_id = '${escapeSqlLiteral(customerId)}' LIMIT 1;`,
      )[0] ?? null)
    : null;

  const invoiceId =
    typeof charge.invoice === 'string' ? charge.invoice : (charge.invoice?.id ?? null);
  const isFullRefund = charge.amount_refunded >= charge.amount;
  // Same wording as the webhook so backfilled and live rows read alike, plus the
  // refund id as the marker that this one was reconstructed after the fact.
  const message =
    `${isFullRefund ? 'Full' : 'Partial'} refund on charge ${charge.id}: ` +
    `${charge.amount_refunded} of ${charge.amount} ${charge.currency} charged` +
    (invoiceId ? `, invoice ${invoiceId}` : ' (no invoice — one-off charge)') +
    ` [backfilled ${refund.id}]`;
  const createdAt = new Date(refund.created * 1000).toISOString();

  console.log(
    `  ${createdAt}  ${user?.email ?? `(no local user for ${customerId ?? 'unknown customer'})`}`,
  );
  console.log(`      ${message}`);

  if (cliArgs.dryRun) {
    written += 1;
    continue;
  }

  const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
  try {
    runSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         'refund_issued',
         ${user ? `'${escapeSqlLiteral(user.id)}'` : 'NULL'},
         NULL,
         ${user ? `'${escapeSqlLiteral(user.email)}'` : 'NULL'},
         'backfill-script',
         '${escapeSqlLiteral(message)}',
         '${escapeSqlLiteral(createdAt)}'
       );`,
    );
    written += 1;
  } catch (err) {
    console.log(`      FAIL — insert failed: ${String(err)}`);
    failed += 1;
  }
}

console.log('');
console.log(
  `${cliArgs.dryRun ? 'Would write' : 'Wrote'}: ${written}   Already recorded: ${skipped}   Failed: ${failed}`,
);
if (cliArgs.dryRun && written > 0) {
  console.log('Re-run with --yes to write these rows.');
}
