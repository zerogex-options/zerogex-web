#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/enforce-payment-grace.mts \
//     [--dry-run | --yes] [--email <addr>] [--limit N] [--grace-days N]
//
// Ends access for members whose payment-recovery grace window has run out but
// who still hold their paid tier.
//
// Why this exists. The grace window (BILLING_PAYMENT_GRACE_DAYS, default 3) is
// enforced by decidePaymentGrace inside the webhook's subscription sync, and a
// sync only runs when Stripe sends a subscription event. Stripe's failed-payment
// retries send invoice.payment_failed and leave the subscription `past_due`
// untouched, so no sync arrives once the window closes. While Stripe ended a
// failing subscription at about day 3 the cancel event dropped the tier on time;
// once it began retrying for a week or more, members kept full access for as
// long as the retries ran, after the grace-expiry warning had told them it ends
// at day 3. See core/paymentGraceEnforcement.ts.
//
// How it ends access. It never writes the tier. For each lapsed member it
// re-reads the subscription from Stripe and, only if Stripe still says
// `past_due`, stamps metadata.grace_enforced_at on it. That update makes Stripe
// send customer.subscription.updated, and the webhook's own sync applies
// decidePaymentGrace, sees the elapsed window and drops the member to public:
// Pro API keys revoked, billing_payment_grace_ended written, exactly as for any
// other sync. Stripe keeps retrying the invoice, and if a retry clears, the next
// sync restores the tier and sends the payment-recovered email as usual.
//
// DRY RUN BY DEFAULT: with no flags it lists who is due and why everyone else is
// left alone, and touches nothing.
//
// Side effects with --yes: one Stripe subscription update (metadata only) per
// lapsed member. No email. No DB write — the DB is opened read-only, and is
// re-read after the updates to confirm the webhook dropped each member.
//
// BILLING_GRACE_ENFORCEMENT_SKIP in .env.local (comma-separated emails) exempts
// members whose lapse is our fault rather than theirs, e.g. a renewal that
// failed because we never attached their card. It stops this sweep and the
// grace-expiry warning (which would otherwise tell them access is ending), but
// any subscription event Stripe sends on its own still runs the webhook's sync,
// which drops them as before. Settle their invoice, then take them off the list.
//
// Exits non-zero when a Stripe call fails or a stamped member still holds a
// paid tier after the wait, so the timer's OnFailure alert fires. A member left
// in that state is picked up again on the next run.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';
import {
  decideGraceEnforcement,
  type GraceEnforcementSkip,
} from '../core/paymentGraceEnforcement.ts';

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  email: string | null;
  skip: string[];
  limit: number;
  graceDays: number | null;
};

const DEFAULT_LIMIT = 50;
// How long to wait for the webhook to process the updates before re-reading
// the DB. Stripe usually delivers within seconds.
const CONFIRM_WAIT_MS = 45_000;
const CONFIRM_POLL_MS = 3_000;

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

function parsePositive(raw: string | undefined, flag: string, allowZero = false): number {
  const value = Number(raw ?? '');
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    console.error(`Error: ${flag} expects a ${allowZero ? 'non-negative' : 'positive'} number, got "${raw}".`);
    process.exit(1);
  }
  return value;
}

function splitEmails(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    yes: false,
    help: false,
    email: null,
    skip: [],
    limit: DEFAULT_LIMIT,
    graceDays: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--email' || arg === '-e') args.email = argv[++i] ?? null;
    else if (arg === '--skip') args.skip.push(...splitEmails(argv[++i]));
    else if (arg === '--limit') args.limit = Math.floor(parsePositive(argv[++i], '--limit'));
    else if (arg === '--grace-days') {
      args.graceDays = Math.floor(parsePositive(argv[++i], '--grace-days', true));
    } else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/enforce-payment-grace.mts \\
    [--dry-run | --yes] [--email <addr>] [--limit N] [--grace-days N]

Ends access for members whose payment-recovery grace window has run out but who
still hold a paid tier. Dry run unless --yes.

For each lapsed member it re-reads the subscription from Stripe and, if Stripe
still says past_due, stamps metadata.grace_enforced_at on it. Stripe then sends
customer.subscription.updated and the webhook's own sync drops the tier. Stripe
keeps retrying the invoice; a payment that clears restores access as usual.

Options:
      --dry-run          List who is due and why others are skipped (default).
  -y, --yes              Send the Stripe updates, then confirm each drop.
  -e, --email <addr>     Only this member.
      --skip a,b         Leave these members alone (added to
                         BILLING_GRACE_ENFORCEMENT_SKIP).
      --limit N          Cap updates in one run (default ${DEFAULT_LIMIT}).
      --grace-days N     Override BILLING_PAYMENT_GRACE_DAYS.
  -h, --help             Show this help.

Reads STRIPE_SECRET_KEY, BILLING_PAYMENT_GRACE_DAYS, BILLING_GRACE_ENFORCEMENT_SKIP
and AUTH_DB_PATH from env or .env.local. Opens the DB read-only; sends no email.`);
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

function querySqlite<T = Record<string, unknown>>(dbPath: string, sql: string): T[] {
  let output: string;
  try {
    output = execFileSync('sqlite3', ['-readonly', '-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr;
    const message =
      typeof stderr === 'string' ? stderr : (stderr?.toString?.() ?? (err as Error).message);
    throw new Error(message.trim() || (err as Error).message);
  }
  const trimmed = output.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed) as T[];
}

function et(iso: string | null): string {
  if (!iso) return 'unknown';
  return `${new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  })} ET`;
}

function hoursSince(iso: string | null, nowMs: number): string {
  if (!iso) return '';
  const hours = (nowMs - Date.parse(iso)) / 3_600_000;
  if (!Number.isFinite(hours)) return '';
  return hours >= 48 ? `${Math.floor(hours / 24)}d ago` : `${Math.floor(hours)}h ago`;
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

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || envLocal.STRIPE_SECRET_KEY;

const skipEmails = new Set([
  ...splitEmails(
    process.env.BILLING_GRACE_ENFORCEMENT_SKIP ?? envLocal.BILLING_GRACE_ENFORCEMENT_SKIP,
  ),
  ...cliArgs.skip,
]);

if (cliArgs.yes && !STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY must be set to end access (--yes).');
  process.exit(1);
}

// Window length, mirroring core/stripe.ts getPaymentGraceDays (default 3,
// clamped [0,14]). Inlined for the same reason scripts/send-grace-expiry-
// warnings.mts inlines it: core/stripe.ts resolves through the '@/' alias,
// which a standalone Node script cannot load. Keep the two in step. Unset must
// stay distinguishable from set: Number('') is 0, which would mean "grace
// disabled" and end every window at once.
const DEFAULT_PAYMENT_GRACE_DAYS = 3;
function resolveGraceDays(): number {
  if (cliArgs.graceDays !== null) return Math.min(14, cliArgs.graceDays);
  const rawEnv = process.env.BILLING_PAYMENT_GRACE_DAYS ?? envLocal.BILLING_PAYMENT_GRACE_DAYS;
  const raw = rawEnv === undefined ? NaN : Number(rawEnv);
  if (!Number.isFinite(raw)) return DEFAULT_PAYMENT_GRACE_DAYS;
  return Math.max(0, Math.min(14, Math.floor(raw)));
}
const graceDays = resolveGraceDays();

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
  tier: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  payment_grace_started_at: string | null;
  payment_grace_reason: string | null;
};

// Coarse cohort filter only. The decision itself is core/paymentGraceEnforcement
// so it is unit-tested, and it re-applies every one of these conditions anyway.
const emailFilter = cliArgs.email
  ? `AND lower(email) = lower('${escapeSqlLiteral(cliArgs.email.trim())}')`
  : '';
const rows = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, tier, subscription_status, stripe_customer_id,
          stripe_subscription_id, payment_grace_started_at, payment_grace_reason
     FROM users
    WHERE deleted_at IS NULL
      AND subscription_status = 'past_due'
      AND COALESCE(tier, 'public') != 'public'
      ${emailFilter}
    ORDER BY payment_grace_started_at`,
);

const nowMs = Date.now();
const nowIso = new Date(nowMs).toISOString();

type Due = { row: UserRow; windowEndIso: string | null };
const due: Due[] = [];
const exempt: Due[] = [];
const skipped = new Map<GraceEnforcementSkip, Array<{ row: UserRow; windowEndIso: string | null }>>();

for (const row of rows) {
  const decision = decideGraceEnforcement({
    subscriptionStatus: row.subscription_status,
    tier: row.tier,
    subscriptionId: row.stripe_subscription_id,
    graceStartedAt: row.payment_grace_started_at,
    graceDays,
    nowMs,
  });
  if (decision.enforce && skipEmails.has(row.email.toLowerCase())) {
    exempt.push({ row, windowEndIso: decision.windowEndIso });
  } else if (decision.enforce) {
    due.push({ row, windowEndIso: decision.windowEndIso });
  } else if (decision.skip) {
    const list = skipped.get(decision.skip) ?? [];
    list.push({ row, windowEndIso: decision.windowEndIso });
    skipped.set(decision.skip, list);
  }
}

console.log(`Auth DB:            ${dbPath} (read-only)`);
console.log(`Grace window:       ${graceDays} day(s)`);
console.log(`Paid past_due rows: ${rows.length}`);
console.log('');

console.log(`WINDOW LAPSED, STILL HOLDING A PAID TIER: ${due.length}`);
for (const { row, windowEndIso } of due) {
  console.log(
    `  ${row.email}  (${row.tier}, ${row.payment_grace_reason ?? 'reason unknown'})  ` +
      `window ended ${et(windowEndIso)}${windowEndIso ? ` (${hoursSince(windowEndIso, nowMs)})` : ''}  ` +
      `${row.stripe_subscription_id}`,
  );
}
console.log('');

if (exempt.length > 0) {
  console.log(`WINDOW LAPSED, EXEMPT (BILLING_GRACE_ENFORCEMENT_SKIP): ${exempt.length}`);
  for (const { row, windowEndIso } of exempt) {
    console.log(`  ${row.email}  (${row.tier})  window ended ${et(windowEndIso)}`);
  }
  console.log('');
}

const stillInGrace = skipped.get('still-in-grace') ?? [];
if (stillInGrace.length > 0) {
  console.log(`STILL INSIDE THE WINDOW (left alone): ${stillInGrace.length}`);
  for (const { row, windowEndIso } of stillInGrace) {
    console.log(`  ${row.email}  (${row.tier})  window ends ${et(windowEndIso)}`);
  }
  console.log('');
}

// Rows in a state the sweep deliberately does not touch. Normally empty; worth
// a human look when not.
for (const reason of ['no-window', 'no-subscription', 'protected-tier'] as const) {
  const list = skipped.get(reason) ?? [];
  if (list.length === 0) continue;
  console.log(`LEFT ALONE (${reason}): ${list.length}`);
  for (const { row } of list) console.log(`  ${row.email}  (${row.tier})`);
  console.log('');
}

if (!cliArgs.yes) {
  console.log(
    due.length > 0
      ? `[dry-run] Nothing changed. Re-run with YES=1 to end access for the ${due.length} above.`
      : '[dry-run] Nothing changed, and nobody is due.',
  );
  process.exit(0);
}

if (due.length === 0) {
  console.log('Nobody is due. Nothing changed.');
  process.exit(0);
}

const stripe = new Stripe(STRIPE_SECRET_KEY as string);
const batch = due.slice(0, cliArgs.limit);
if (due.length > batch.length) {
  console.log(`--limit ${cliArgs.limit}: handling ${batch.length} now, ${due.length - batch.length} on the next run.`);
  console.log('');
}

let failures = 0;
const stamped: UserRow[] = [];

for (const { row } of batch) {
  const subscriptionId = row.stripe_subscription_id as string;
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const customerId =
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    if (row.stripe_customer_id && customerId !== row.stripe_customer_id) {
      console.log(
        `  ✗ ${row.email}: ${subscriptionId} belongs to ${customerId}, not ${row.stripe_customer_id}. Left alone.`,
      );
      failures++;
      continue;
    }
    if (subscription.status !== 'past_due') {
      // The DB is behind Stripe (a payment just cleared, or the subscription
      // ended). The webhook reconciles that on its own event; nothing to end.
      console.log(
        `  – ${row.email}: Stripe says ${subscription.status}, not past_due. Left alone; the webhook will reconcile.`,
      );
      continue;
    }
    await stripe.subscriptions.update(subscriptionId, {
      metadata: { grace_enforced_at: nowIso },
    });
    console.log(`  → ${row.email}: stamped ${subscriptionId}; waiting for the webhook to drop the tier.`);
    stamped.push(row);
  } catch (err) {
    console.log(`  ✗ ${row.email}: ${(err as Error).message}`);
    failures++;
  }
}

// Confirm the webhook actually dropped each stamped member, so a webhook that
// is down or rejecting events shows up here instead of silently leaving
// everyone with access.
let pending = stamped;
if (pending.length > 0) {
  const deadline = Date.now() + CONFIRM_WAIT_MS;
  while (pending.length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_POLL_MS));
    const ids = pending.map((r) => `'${escapeSqlLiteral(r.id)}'`).join(', ');
    const current = querySqlite<{ id: string; tier: string | null }>(
      dbPath,
      `SELECT id, tier FROM users WHERE id IN (${ids})`,
    );
    const stillPaid = new Set(
      current.filter((r) => (r.tier ?? 'public') !== 'public').map((r) => r.id),
    );
    pending = pending.filter((r) => stillPaid.has(r.id));
  }
}

console.log('');
console.log(`Access ended:       ${stamped.length - pending.length}`);
if (pending.length > 0) {
  console.log(`Still paid after ${CONFIRM_WAIT_MS / 1000}s: ${pending.length} (picked up again next run)`);
  for (const row of pending) console.log(`  ${row.email}  (make webhook-health)`);
}
if (failures > 0) console.log(`Errors:             ${failures}`);

process.exit(failures > 0 || pending.length > 0 ? 1 : 0);
