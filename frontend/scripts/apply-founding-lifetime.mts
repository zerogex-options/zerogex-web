#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/apply-founding-lifetime.mts \
//     [--email <addr>] [--force] [--dry-run | --yes]
//
// Apply the founding LIFETIME 25%-off coupon (STRIPE_COUPON_FOUNDING_LIFETIME) to
// founding members who are due for it — the on-demand twin of the webhook's
// maybeApplyFoundingLifetime (app/api/webhooks/stripe/route.ts).
//
// WHY THIS EXISTS. The webhook applies the lifetime coupon opportunistically,
// only when a customer.subscription.* event fires and the member is >= 11 months
// past founding redemption. That works for MONTHLY founders (a monthly invoice
// lands an event every ~month, so the month-11 window is always hit). It does NOT
// work for ANNUAL founders: an annual subscription produces NO events between the
// signup charge and the next year's renewal, so the webhook never fires at month
// 11 and the annual renewal would bill full rack rate before the 25% ever lands.
// Run this batch once the founding cohort's intro year is ending (with a June 1,
// 2026 go-live + July 1 lock-in, that's ~May/June 2027) and every eligible
// founder gets the lifetime coupon on their subscription BEFORE the post-intro
// renewal invoice — so renewals from that point on are correctly discounted.
//
// SELECTION mirrors the webhook's shouldApplyFoundingLifetime exactly:
//   founding_member_started_at set, founding_lifetime_applied_at NULL, and
//   started >= 11 months ago (FOUNDING_LIFETIME_ELIGIBLE_AFTER_MONTHS).
//   --force   apply regardless of the 11-month window. Only safe for a member
//             already past their intro window — e.g. an annual founder (whose
//             intro is a single, already-charged invoice). Do NOT --force a
//             MONTHLY founder still inside their 12-invoice intro, or the 25%
//             would stack on top of the intro rate.
//   --email   limit to one member (e.g. an annual straggler comped after the
//             main run).
//
// APPLICATION mirrors the webhook precisely: subscriptions.update(sub, {
// discounts: [{ coupon: lifetime }] }) — the lifetime coupon REPLACES the sub's
// discounts (the intro coupon has served its purpose), then
// founding_lifetime_applied_at is stamped so it's never re-applied.
//
// Idempotent: the stamp guards re-runs, and re-applying the same coupon is a
// Stripe no-op — so it's safe to run repeatedly (once for the main cohort, again
// later for a straggler). Records an audit_events row per application. Read-only
// until --yes; --dry-run prints the plan and writes nothing.
//
// Reads STRIPE_SECRET_KEY and STRIPE_COUPON_FOUNDING_LIFETIME from env or
// .env.local. Set AUTH_DB_PATH to override the default DB path (data/auth.db).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import type Stripe from 'stripe';

// Mirror app/api/webhooks/stripe/route.ts. Kept in sync deliberately: this batch
// is that webhook's application logic on a timer instead of an event.
const FOUNDING_LIFETIME_ELIGIBLE_AFTER_MONTHS = 11;
const AUDIT_TYPE = 'billing_founding_lifetime_applied_batch';

type Args = {
  email: string | null;
  force: boolean;
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
  const args: Args = { email: null, force: false, dryRun: false, yes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--force') args.force = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (!arg.startsWith('--') && !args.email) args.email = arg.trim().toLowerCase() || null;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/apply-founding-lifetime.mts \\
    [--email <addr>] [--force] [--dry-run | --yes]

Applies the founding lifetime 25%-off coupon (STRIPE_COUPON_FOUNDING_LIFETIME) to
every founding member who is due for it — the on-demand twin of the webhook's
maybeApplyFoundingLifetime. Run it once the founding cohort's intro year is
ending so annual founders (whom the event-driven webhook never reaches at month
11) get the coupon before their renewal.

Selection (mirrors the webhook):
      (default)   founders started >= ${FOUNDING_LIFETIME_ELIGIBLE_AFTER_MONTHS} months ago, lifetime not yet applied.
      --force     apply regardless of the ${FOUNDING_LIFETIME_ELIGIBLE_AFTER_MONTHS}-month window. Only safe for a member
                  past their intro window (e.g. an annual founder). Never --force
                  a monthly founder still inside their 12-invoice intro.
      --email     limit to one member.

Other:
      --dry-run   Print the plan; no Stripe or DB writes.
  -y, --yes       Apply: update Stripe subscriptions + stamp + write audit rows.
  -h, --help      Show this help.

Reads STRIPE_SECRET_KEY and STRIPE_COUPON_FOUNDING_LIFETIME from env or
.env.local. Set AUTH_DB_PATH to override the default DB path (data/auth.db).`);
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
      typeof stderr === 'string' ? stderr : stderr?.toString?.() ?? (err as Error).message;
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

function nowIso() {
  return new Date().toISOString();
}

// Same 11-month rule as the webhook's shouldApplyFoundingLifetime: start month +
// 11 <= now. setMonth handles month/year overflow.
function lifetimeEligibleAt(startIso: string): Date | null {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  const at = new Date(start);
  at.setMonth(at.getMonth() + FOUNDING_LIFETIME_ELIGIBLE_AFTER_MONTHS);
  return at;
}

// ---------------------------------------------------------------------------

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  usage();
  process.exit(0);
}
if (cliArgs.dryRun && cliArgs.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
function envOrLocal(key: string): string | undefined {
  return process.env[key] || envLocal[key] || undefined;
}

const STRIPE_SECRET_KEY = envOrLocal('STRIPE_SECRET_KEY');
if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY not set in env or .env.local.');
  process.exit(1);
}

const lifetimeCouponId = envOrLocal('STRIPE_COUPON_FOUNDING_LIFETIME');
if (!lifetimeCouponId) {
  console.error('Error: STRIPE_COUPON_FOUNDING_LIFETIME not set in env or .env.local.');
  process.exit(1);
}

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

ensureSqlite3Cli();

type UserRow = {
  id: string;
  email: string;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  founding_member_started_at: string | null;
  founding_lifetime_applied_at: string | null;
};

// Candidates: founders without the lifetime coupon yet. Eligibility (the 11-month
// window) is evaluated in JS so it matches the webhook's setMonth math exactly.
const emailFilter = cliArgs.email ? ` AND lower(email) = '${escapeSqlLiteral(cliArgs.email)}'` : '';
const candidates = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, subscription_status, stripe_subscription_id,
          founding_member_started_at, founding_lifetime_applied_at
   FROM users
   WHERE founding_member_started_at IS NOT NULL
     AND founding_lifetime_applied_at IS NULL${emailFilter}
   ORDER BY founding_member_started_at ASC;`,
);

console.log(`Auth DB:            ${dbPath}`);
console.log(`Stripe:             ${STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE mode' : 'test mode'}`);
console.log(`Lifetime coupon:    ${lifetimeCouponId}`);
console.log(`Selection:          ${cliArgs.force ? 'FORCE (ignoring 11-month window)' : `>= ${FOUNDING_LIFETIME_ELIGIBLE_AFTER_MONTHS} months since founding`}${cliArgs.email ? ` · email=${cliArgs.email}` : ''}`);
console.log(`Candidates:         ${candidates.length} founder(s) without lifetime applied`);

if (candidates.length === 0) {
  console.log('\nNothing to do: no founding members are awaiting the lifetime coupon.');
  process.exit(0);
}

// Partition candidates into due / not-yet-due / no-active-sub for a clear plan.
const now = new Date();
type Plan = { row: UserRow; reason: string };
const due: Plan[] = [];
const notYetDue: Plan[] = [];
const noSub: Plan[] = [];
for (const row of candidates) {
  if (!row.stripe_subscription_id) {
    noSub.push({ row, reason: 'no stripe_subscription_id' });
    continue;
  }
  const eligibleAt = row.founding_member_started_at ? lifetimeEligibleAt(row.founding_member_started_at) : null;
  const isDue = cliArgs.force || (eligibleAt != null && eligibleAt.getTime() <= now.getTime());
  if (isDue) {
    due.push({ row, reason: cliArgs.force ? 'forced' : `eligible since ${eligibleAt?.toISOString().slice(0, 10)}` });
  } else {
    notYetDue.push({ row, reason: eligibleAt ? `not due until ${eligibleAt.toISOString().slice(0, 10)}` : 'unparseable start date' });
  }
}

console.log(`\nDue now:            ${due.length}`);
for (const p of due) console.log(`  • ${p.row.email}  (${p.reason})`);
if (notYetDue.length) {
  console.log(`Not yet due:        ${notYetDue.length}`);
  for (const p of notYetDue) console.log(`  • ${p.row.email}  (${p.reason})`);
}
if (noSub.length) {
  console.log(`Skipped (no sub):   ${noSub.length}`);
  for (const p of noSub) console.log(`  • ${p.row.email}`);
}

if (due.length === 0) {
  console.log('\nNothing due right now. Re-run when the cohort matures (or pass --force / --email for a specific member).');
  process.exit(0);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No Stripe or DB writes.');
  process.exit(0);
}
if (!cliArgs.yes) {
  console.log('\nRefusing to write without --yes. Re-run with --yes to apply, or --dry-run to preview.');
  process.exit(1);
}

// --- Apply -------------------------------------------------------------------
// Lazy-imported so --help / arg errors don't require node_modules.
const { default: StripeClient } = await import('stripe');
const stripe = new StripeClient(STRIPE_SECRET_KEY);

let applied = 0;
let skippedInactive = 0;
let failed = 0;

for (const { row } of due) {
  const subId = row.stripe_subscription_id as string;
  // Confirm the sub is live before couponing it — a canceled/incomplete sub has
  // nothing to discount.
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(subId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  FAIL ${row.email}: could not retrieve ${subId}: ${message}`);
    failed++;
    continue;
  }
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    console.log(`  SKIP ${row.email}: sub ${subId} is '${subscription.status}', not active/trialing.`);
    skippedInactive++;
    continue;
  }

  try {
    // Mirror maybeApplyFoundingLifetime: the lifetime coupon REPLACES the sub's
    // discounts (the intro coupon has done its job).
    await stripe.subscriptions.update(subId, { discounts: [{ coupon: lifetimeCouponId }] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  FAIL ${row.email}: applying ${lifetimeCouponId} to ${subId}: ${message}`);
    failed++;
    continue;
  }

  const stamp = nowIso();
  execSqlite(
    dbPath,
    `UPDATE users SET founding_lifetime_applied_at = '${escapeSqlLiteral(stamp)}', updated_at = '${escapeSqlLiteral(stamp)}' WHERE id = '${escapeSqlLiteral(row.id)}';`,
  );
  const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
  execSqlite(
    dbPath,
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (
       '${escapeSqlLiteral(auditId)}',
       '${escapeSqlLiteral(AUDIT_TYPE)}',
       '${escapeSqlLiteral(row.id)}',
       NULL,
       '${escapeSqlLiteral(row.email)}',
       'manual-script',
       '${escapeSqlLiteral(`Applied founding lifetime coupon ${lifetimeCouponId} to sub ${subId} (batch${cliArgs.force ? ', forced' : ''})`)}',
       '${escapeSqlLiteral(stamp)}'
     );`,
  );
  console.log(`  OK   ${row.email}: lifetime coupon ${lifetimeCouponId} applied to ${subId}, stamped.`);
  applied++;
}

console.log(
  `\nDone. Applied ${applied}, skipped ${skippedInactive} (inactive sub), failed ${failed}, of ${due.length} due.`,
);
if (failed > 0) process.exit(1);
