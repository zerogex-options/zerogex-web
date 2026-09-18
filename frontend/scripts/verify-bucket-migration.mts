#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types --no-warnings scripts/verify-bucket-migration.mts
// or, from the repo root:
//   make verify-bucket-migration
//
// WHY THIS EXISTS: the Total Subscribers chart moved from an account-scoped
// payment column (users.first_payment_at) to a per-SUBSCRIPTION pointer
// (users.last_paid_subscription_id / last_paid_invoice_at). The rule is better,
// but the DEPLOY has to be invisible: every member must land on exactly the line
// they were already on. A backfill that under-filled would drop the entire
// paying base onto the Converting line at once, on a live chart.
//
// This answers that question against the REAL database before anything is
// deployed. It computes the census under the old rule, simulates the migration's
// backfill IN MEMORY, computes it under the new rule, and reports any member who
// would move. Exits non-zero if anyone does.
//
// STRICTLY READ-ONLY: the database is opened with readOnly:true, so it cannot
// write even if something here is wrong. Safe to run against production, as
// often as you like, before or after deploying.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, eq).trim()] = value;
  }
  return env;
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/verify-bucket-migration.mts [--names]

Dry-run for the per-subscription Total Subscribers migration. Compares the chart
census before and after, using the real database, and names any member whose
line would change. Exits 1 if any would.

Options:
  --names    List the email of every member who would move.
  -h, --help Show this help.

Reads AUTH_DB_PATH from env or .env.local (default frontend/data/auth.db).
READ-ONLY — opens the DB with readOnly:true and writes nothing.`);
  process.exit(0);
}
const showNames = args.includes('--names');

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

const db = new DatabaseSync(dbPath, { readOnly: true });

const cols = new Set(
  (db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>).map((c) =>
    String(c.name),
  ),
);
const alreadyMigrated = cols.has('last_paid_subscription_id');

// The four lines of the Total Subscribers chart, named as the two rules below
// return them.
type Line = 'active' | 'converting' | 'trialing' | 'graceTrial';

// The columns the SELECT asks for. The two paid-pointer columns are optional
// because the whole point of this tool is to run against a database that may
// predate them — `alreadyMigrated` decides whether the query even names them.
type MigrationRow = {
  id: string;
  email: string | null;
  tier: string | null;
  subscription_status: string | null;
  payment_grace_reason: string | null;
  stripe_subscription_id: string | null;
  first_payment_at: string | null;
  last_paid_subscription_id?: string | null;
  last_paid_invoice_at?: string | null;
};

// Everything the two rules read, for every row the chart's WHERE selects.
const rows = db
  .prepare(
    `SELECT id, email, tier, subscription_status, payment_grace_reason,
            stripe_subscription_id, first_payment_at${
              alreadyMigrated ? ', last_paid_subscription_id, last_paid_invoice_at' : ''
            }
       FROM users
      WHERE tier IN ('pro', 'basic', 'elite', 'starter')
        AND subscription_status IN ('active', 'trialing', 'past_due')`,
  )
  .all() as MigrationRow[];

// The OLD chart rule, verbatim.
function oldBucket(r: MigrationRow): Line {
  if (r.subscription_status === 'trialing') return 'trialing';
  if (r.subscription_status === 'past_due' && r.payment_grace_reason === 'trial') return 'graceTrial';
  if (r.subscription_status === 'active' && r.first_payment_at == null) return 'converting';
  return 'active';
}

// What core/db.ts's backfill will write for this row, computed rather than
// applied. Mirrors that UPDATE's WHERE exactly — change one, change the other.
function backfilled(r: MigrationRow): { sub: string | null; at: string | null } {
  if (alreadyMigrated && r.last_paid_subscription_id != null) {
    // `?? null` only normalizes the absent-column case; every consumer tests
    // `== null`, which already treats undefined and null alike.
    return { sub: r.last_paid_subscription_id, at: r.last_paid_invoice_at ?? null };
  }
  if (r.stripe_subscription_id == null) return { sub: null, at: null };
  const stamp =
    (r.subscription_status === 'active' && r.first_payment_at != null) ||
    (r.subscription_status === 'past_due' && r.payment_grace_reason !== 'trial');
  if (!stamp) return { sub: null, at: null };
  return { sub: r.stripe_subscription_id, at: r.first_payment_at ?? 'backfilled' };
}

// The NEW chart rule, verbatim.
function newBucket(r: MigrationRow): Line {
  if (r.subscription_status === 'trialing') return 'trialing';
  if (r.subscription_status === 'past_due' && r.payment_grace_reason === 'trial') return 'graceTrial';
  const paid = backfilled(r);
  if (
    r.subscription_status === 'active' &&
    (paid.sub == null || r.stripe_subscription_id == null || paid.sub !== r.stripe_subscription_id || paid.at == null)
  ) {
    return 'converting';
  }
  return 'active';
}

const LINES: readonly Line[] = ['active', 'converting', 'trialing', 'graceTrial'];
const LABEL: Record<Line, string> = {
  active: 'Full Subscriber',
  converting: 'Converting',
  trialing: 'Free Trial',
  graceTrial: 'Trial Grace',
};
const before = {} as Record<Line, number>;
const after = {} as Record<Line, number>;
for (const line of LINES) {
  before[line] = 0;
  after[line] = 0;
}
const moved: Array<{ email: string | null; from: Line; to: Line }> = [];
for (const r of rows) {
  const a = oldBucket(r);
  const b = newBucket(r);
  before[a] += 1;
  after[b] += 1;
  if (a !== b) moved.push({ email: r.email, from: a, to: b });
}

const pad = (n: number) => String(n).padStart(5);
console.log(`Auth DB:   ${dbPath}`);
console.log(`Schema:    ${alreadyMigrated ? 'ALREADY MIGRATED (columns present)' : 'pre-migration'}`);
console.log('');
console.log('                     before   after');
for (const line of LINES) {
  const flag = before[line] === after[line] ? '' : '   <-- CHANGES';
  console.log(`  ${LABEL[line].padEnd(16)} ${pad(before[line])}   ${pad(after[line])}${flag}`);
}
console.log(`  ${'TOTAL'.padEnd(16)} ${pad(rows.length)}   ${pad(rows.length)}`);
console.log('');

if (moved.length === 0) {
  console.log('OK — no member changes line. The migration is invisible on the chart.');
  process.exit(0);
}

console.log(`${moved.length} member(s) WOULD MOVE. Do not deploy until this reads zero:`);
const byTransition = new Map<string, number>();
for (const m of moved) {
  const key = `${LABEL[m.from]} -> ${LABEL[m.to]}`;
  byTransition.set(key, (byTransition.get(key) ?? 0) + 1);
}
for (const [key, count] of byTransition) console.log(`  ${pad(count)}  ${key}`);
if (showNames) {
  console.log('');
  for (const m of moved) console.log(`  ${m.email}  ${LABEL[m.from]} -> ${LABEL[m.to]}`);
} else {
  console.log('');
  console.log('Re-run with --names to list them.');
}
process.exit(1);
