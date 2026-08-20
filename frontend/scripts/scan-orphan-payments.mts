#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/scan-orphan-payments.mts \
//     [--since-days 120] [--verbose]
//
// Find members whose payment was ORPHANED — they paid an invoice in full and
// were left with no entitlement — across the WHOLE customer base.
//
// Why this exists separately from recover-orphan-payment.mts: that script
// answers "is THIS member stranded?", which only helps for the ones who write
// in. Craig did. The others do not — a stranded member sees a Public account,
// assumes the payment failed like the five dunning emails said, and quietly
// stops showing up. Nothing in the product surfaces them, and the DB alone
// cannot either: "tier=public and subscription canceled" is every trial that
// ended without converting. The one signal that separates a stranded payer from
// ordinary churn — money collected against no live subscription — lives in
// Stripe.
//
// So the sweep runs the other way round: walk Stripe's PAID invoices, keep the
// ones whose customer is sitting on a free tier locally, and put each through
// decideOrphanPayment — the same function the webhook and the recovery script
// use, so all three agree on what "recoverable" means.
//
// STRICTLY READ-ONLY. It creates nothing, writes no DB rows, sends no email.
// Every hit is reported with the exact command that would fix it, which is
// itself dry-run by default.
//
// Reads STRIPE_SECRET_KEY + STRIPE_PRICE_* from env or .env.local. Set
// AUTH_DB_PATH to override the default DB path (data/auth.db).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

import { classifyElapsedPaidPeriod, decideOrphanPayment } from '../core/orphanPayment.ts';
import {
  readInvoicePeriodEndUnix,
  readInvoicePeriodStartUnix,
  readInvoicePriceId,
  readInvoiceSubscriptionId,
} from '../core/stripeInvoice.ts';

type Tier = 'basic' | 'pro';
type Cadence = 'monthly' | 'annual';

type Args = {
  sinceDays: number;
  verbose: boolean;
  help: boolean;
};

// A runaway guard, not a business rule: if a sweep ever walks past this many
// invoices something is wrong with the window, and the count is reported rather
// than silently truncated.
const MAX_INVOICES = 10000;

function usage() {
  console.log(`Scan every paid Stripe invoice for payments that left the member with nothing.

Usage:
  node --experimental-strip-types --no-warnings scripts/scan-orphan-payments.mts [options]

Options:
  --since-days <n>   How far back to walk paid invoices (default 120).
  --verbose          Also list the near misses and why each was ruled out.
  --help             Show this help.

Read-only. Fix anything it finds with:
  make recover-orphan-payment EMAIL=<addr>          # dry run
  make recover-orphan-payment EMAIL=<addr> YES=1    # apply
`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { sinceDays: 120, verbose: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--verbose') args.verbose = true;
    else if (arg === '--since-days') {
      const raw = argv[i + 1];
      i += 1;
      const parsed = Number.parseInt(raw ?? '', 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.error(`Error: --since-days needs a positive number (got ${raw ?? 'nothing'}).`);
        process.exit(1);
      }
      args.sinceDays = parsed;
    } else {
      console.error(`Error: unknown argument ${arg}. See --help.`);
      process.exit(1);
    }
  }
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
    output = execFileSync('sqlite3', ['-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr;
    const message =
      typeof stderr === 'string' ? stderr : stderr?.toString?.() ?? (err as Error).message;
    throw new Error(message.trim() || (err as Error).message);
  }
  const trimmed = output.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed) as T[];
}

function fmtAmount(amountCents: number, currency: string): string {
  const symbol = currency.toLowerCase() === 'usd' ? '$' : `${currency.toUpperCase()} `;
  return `${symbol}${(amountCents / 100).toFixed(2)}`;
}

function fmtDateUnix(unix: number | null): string {
  if (unix === null) return '—';
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
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

// Mirrors core/stripe.ts — a raw strip-types run can't resolve the '@/core/*'
// alias, so the price map is rebuilt from the same env vars the app reads.
const PRICE_ENV: Array<{ env: string; tier: Tier; cadence: Cadence }> = [
  { env: 'STRIPE_PRICE_BASIC_MONTHLY', tier: 'basic', cadence: 'monthly' },
  { env: 'STRIPE_PRICE_BASIC_ANNUAL', tier: 'basic', cadence: 'annual' },
  { env: 'STRIPE_PRICE_PRO_MONTHLY', tier: 'pro', cadence: 'monthly' },
  { env: 'STRIPE_PRICE_PRO_ANNUAL', tier: 'pro', cadence: 'annual' },
];
const skuByPriceId = new Map<string, { tier: Tier; cadence: Cadence }>();
for (const p of PRICE_ENV) {
  const id = envOrLocal(p.env);
  if (id) skuByPriceId.set(id, { tier: p.tier, cadence: p.cadence });
}
if (skuByPriceId.size === 0) {
  console.error('Error: no STRIPE_PRICE_* ids resolved from env or .env.local.');
  console.error('Without them every invoice looks like it maps to no paid tier.');
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
  email: string;
  tier: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
};

// One pass over the users table: every Stripe customer we know about, keyed by
// customer id so the invoice sweep can resolve each one without a query per row.
const userByCustomer = new Map<string, UserRow>();
for (const row of querySqlite<UserRow>(
  dbPath,
  `SELECT email, tier, stripe_customer_id, stripe_subscription_id
     FROM users WHERE stripe_customer_id IS NOT NULL AND stripe_customer_id <> '';`,
)) {
  userByCustomer.set(row.stripe_customer_id, row);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

const sinceUnix = Math.floor(Date.now() / 1000) - cliArgs.sinceDays * 24 * 60 * 60;
const nowUnix = Math.floor(Date.now() / 1000);

console.log(`Auth DB:            ${dbPath}`);
console.log(`Known customers:    ${userByCustomer.size}`);
console.log(`Window:             paid invoices since ${fmtDateUnix(sinceUnix)} (${cliArgs.sinceDays}d)`);
console.log('');
process.stdout.write('Scanning Stripe invoices');

type Hit = {
  email: string;
  invoiceId: string;
  amount: string;
  paidAt: string;
  coveredThrough: string;
  reason: string | null;
  // Kept in unix so an elapsed period can be checked against the audit log —
  // see classifyElapsed below.
  periodStartUnix: number | null;
  periodEndUnix: number | null;
  // Filled in for the elapsed bucket only: how the member's access actually
  // ended relative to the period they paid for.
  lostFrom?: string;
  lostDays?: number;
};

// Three buckets, because they need three different responses:
//   hits        money collected, no entitlement, and the plan to restore is
//               unambiguous — one command fixes it.
//   needsReview money collected with no entitlement, but the decision function
//               declined to guess the plan. Real money, human required.
//   ruledOut    the normal flow covers this invoice. Noise unless asked for.
const hits: Hit[] = [];
const needsReview: Hit[] = [];
const ruledOut: Hit[] = [];
// Paid invoices whose period has since run out. On its own that says nothing —
// it is both what ordinary churn looks like and what Craig's bug looks like a
// month later — so these are held back and resolved against the audit log once
// the sweep finishes.
const elapsed: Hit[] = [];
// Customers with money on record but no local account at all — a different
// failure from the one this script hunts, and worth seeing rather than dropping.
const unknownCustomers = new Set<string>();

// One subscription can back many invoices; cache so a chatty customer doesn't
// cost a retrieve per invoice.
const subscriptionCache = new Map<string, Stripe.Subscription | null>();
async function retrieveSubscription(id: string): Promise<Stripe.Subscription | null> {
  const cached = subscriptionCache.get(id);
  if (cached !== undefined) return cached;
  let result: Stripe.Subscription | null = null;
  try {
    result = await stripe.subscriptions.retrieve(id);
  } catch (err) {
    const code = (err as { code?: string }).code;
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (code === 'resource_missing' || statusCode === 404) result = null;
    else throw err;
  }
  subscriptionCache.set(id, result);
  return result;
}

let scanned = 0;
let paidNonZero = 0;
let hitCap = false;

try {
  for await (const invoice of stripe.invoices.list({
    status: 'paid',
    created: { gte: sinceUnix },
    limit: 100,
  })) {
    scanned += 1;
    if (scanned % 100 === 0) process.stdout.write('.');
    if (scanned >= MAX_INVOICES) {
      hitCap = true;
      break;
    }

    const amountPaid = invoice.amount_paid ?? 0;
    if (amountPaid <= 0) continue;
    paidNonZero += 1;

    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
    if (!customerId) continue;

    const user = userByCustomer.get(customerId);
    if (!user) {
      unknownCustomers.add(customerId);
      continue;
    }

    // Anyone already sitting on a paid tier got what they paid for. Skipping
    // them here is also what keeps the sweep cheap — no subscription retrieve.
    const localTier = user.tier ?? 'public';
    if (localTier === 'basic' || localTier === 'pro') continue;

    const subscriptionId = readInvoiceSubscriptionId(invoice);
    const subscription = subscriptionId ? await retrieveSubscription(subscriptionId) : null;
    const priceId = readInvoicePriceId(invoice);

    const decision = decideOrphanPayment({
      amountPaid,
      invoiceStatus: invoice.status ?? null,
      billingReason: invoice.billing_reason ?? null,
      subscriptionId,
      subscriptionStatus: subscription?.status ?? null,
      localTier,
      localSubscriptionId: user.stripe_subscription_id,
      priceId,
      priceMapsToPaidTier: priceId ? skuByPriceId.has(priceId) : false,
      coveredPeriodEndUnix: readInvoicePeriodEndUnix(invoice),
      nowUnix,
    });

    const recoverable = decision.kind === 'detected' && decision.recoverable;
    const record: Hit = {
      email: user.email,
      invoiceId: invoice.id ?? '—',
      amount: fmtAmount(amountPaid, invoice.currency ?? 'usd'),
      paidAt: fmtDateUnix(invoice.status_transitions?.paid_at ?? invoice.created ?? null),
      coveredThrough: fmtDateUnix(readInvoicePeriodEndUnix(invoice)),
      reason: recoverable ? null : decision.reason,
      periodStartUnix: readInvoicePeriodStartUnix(invoice),
      periodEndUnix: readInvoicePeriodEndUnix(invoice),
    };
    if (recoverable) hits.push(record);
    else if (decision.reason === 'period_already_elapsed') elapsed.push(record);
    else if (decision.kind === 'detected') needsReview.push(record);
    else ruledOut.push(record);
  }
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.log('');
  console.error(`Error: Stripe invoice sweep failed after ${scanned} invoices: ${message}`);
  console.error('Nothing was written — re-run when Stripe is reachable.');
  process.exit(1);
}

// --- Resolve the elapsed bucket --------------------------------------------
//
// "They paid for a period that has since ended" describes two opposite things:
//
//   consumed   They paid, had the tier for the period, and it ran out. Ordinary
//              churn — nothing owed, nothing to do.
//   lost       They paid, and their access was taken away BEFORE the period they
//              had bought was over. That is Craig's bug seen a month later, when
//              re-creating the subscription is no longer the right remedy — the
//              period is gone, so what is owed is a refund or a credit.
//
// Stripe cannot tell these apart; the audit log can. A tier reset lands as
// stripe_subscription_deleted, so a deletion timestamped INSIDE the paid period
// means the member lost days they had paid for.
//
// One exception, and it matters: a member who asks to cancel immediately gives
// up the rest of the period by choice. Those carry a cancellation request of
// their own shortly before the deletion, so a deletion preceded by one is read
// as voluntary and left alone. (Cancel-at-period-end never trips this at all —
// its deletion lands AT the period end, not inside it.)
type AuditRow = { email: string; type: string; created_at: string };

function classifyElapsed(candidates: Hit[]): { lost: Hit[]; consumed: Hit[] } {
  if (candidates.length === 0) return { lost: [], consumed: [] };

  const emails = [...new Set(candidates.map((c) => c.email.toLowerCase()))];
  const inList = emails.map((e) => `'${escapeSqlLiteral(e)}'`).join(',');
  let audit: AuditRow[] = [];
  try {
    audit = querySqlite<AuditRow>(
      dbPath,
      `SELECT lower(email) AS email, type, created_at FROM audit_events
        WHERE lower(email) IN (${inList})
          AND type IN ('stripe_subscription_deleted','stripe_cancellation_requested','billing_cancel_flow_submitted')
        ORDER BY created_at ASC;`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`Warning: could not read audit events (${message}).`);
    console.error('Elapsed periods are reported as consumed rather than guessed at.');
    return { lost: [], consumed: candidates };
  }

  const deletionsByEmail = new Map<string, number[]>();
  const cancelRequestsByEmail = new Map<string, number[]>();
  for (const row of audit) {
    const unix = Math.floor(new Date(row.created_at).getTime() / 1000);
    if (!Number.isFinite(unix)) continue;
    const bucket =
      row.type === 'stripe_subscription_deleted' ? deletionsByEmail : cancelRequestsByEmail;
    const list = bucket.get(row.email) ?? [];
    list.push(unix);
    bucket.set(row.email, list);
  }

  const lost: Hit[] = [];
  const consumed: Hit[] = [];
  for (const candidate of candidates) {
    const email = candidate.email.toLowerCase();
    const verdict = classifyElapsedPaidPeriod({
      periodStartUnix: candidate.periodStartUnix,
      periodEndUnix: candidate.periodEndUnix,
      deletionUnixes: deletionsByEmail.get(email) ?? [],
      cancelRequestUnixes: cancelRequestsByEmail.get(email) ?? [],
    });
    if (verdict.kind === 'consumed') {
      consumed.push({ ...candidate, reason: verdict.reason });
      continue;
    }
    lost.push({
      ...candidate,
      lostFrom: fmtDateUnix(verdict.lostAtUnix),
      lostDays: Math.max(1, Math.round(verdict.lostSeconds / 86400)),
    });
  }
  return { lost, consumed };
}

const { lost: lostPaidTime, consumed } = classifyElapsed(elapsed);
ruledOut.push(...consumed);

console.log('');
console.log('');
console.log(`Scanned:            ${scanned} paid invoices (${paidNonZero} non-zero)`);
if (hitCap) {
  console.log(`  NOTE: stopped at the ${MAX_INVOICES}-invoice cap — narrow --since-days and re-run.`);
}
console.log('');

if (hits.length === 0) {
  console.log('No recoverable orphaned payments — nobody is sitting on a free tier right now');
  console.log('with a paid period still running. Any finding below concerns periods that have');
  console.log('already expired, which no subscription can restore.');
} else {
  console.log(`ORPHANED PAYMENTS: ${hits.length}`);
  console.log('These members paid in full and are sitting on a free tier right now.');
  console.log('');
  for (const hit of hits) {
    console.log(`  ${hit.email}`);
    console.log(
      `    ${hit.invoiceId}  ${hit.amount}  paid ${hit.paidAt}  covers through ${hit.coveredThrough}`,
    );
    console.log(`    make recover-orphan-payment EMAIL=${hit.email}`);
    console.log('');
  }
  console.log('Each command above is a DRY RUN — it prints the plan and writes nothing.');
  console.log('Add YES=1 to apply.');
}

if (lostPaidTime.length > 0) {
  console.log('');
  console.log(`LOST PAID TIME: ${lostPaidTime.length}`);
  console.log('These members paid, then had their access taken away before the period they');
  console.log('had bought was over — and that period has now expired, so re-creating the');
  console.log('subscription would give them future time instead of what they lost.');
  console.log('A refund or a credit is the remedy, and that is your call.');
  console.log('');
  for (const item of lostPaidTime) {
    console.log(`  ${item.email}`);
    console.log(
      `    ${item.invoiceId}  ${item.amount}  paid ${item.paidAt}  covered through ${item.coveredThrough}`,
    );
    console.log(`    access ended ${item.lostFrom} — roughly ${item.lostDays} paid day(s) lost`);
    console.log(`    make diagnose-user EMAIL=${item.email}`);
    console.log('');
  }
}

if (needsReview.length > 0) {
  console.log('');
  console.log(`NEEDS A LOOK: ${needsReview.length}`);
  console.log('Money collected with no entitlement, but the plan to restore was not');
  console.log('unambiguous — so nothing is proposed automatically.');
  console.log('');
  for (const item of needsReview) {
    console.log(`  ${item.email}`);
    console.log(`    ${item.invoiceId}  ${item.amount}  paid ${item.paidAt}  → ${item.reason}`);
    console.log(`    make diagnose-user EMAIL=${item.email}`);
    console.log('');
  }
}

if (unknownCustomers.size > 0) {
  console.log('');
  console.log(`Paid invoices on ${unknownCustomers.size} Stripe customer(s) with no local account:`);
  for (const id of [...unknownCustomers].slice(0, 10)) console.log(`  ${id}`);
  if (unknownCustomers.size > 10) console.log(`  … and ${unknownCustomers.size - 10} more`);
  console.log('Usually a deleted account. This script cannot restore those — check by hand.');
}

if (cliArgs.verbose && ruledOut.length > 0) {
  console.log('');
  console.log(`Ruled out: ${ruledOut.length} paid invoice(s) on free-tier members`);
  for (const miss of ruledOut) {
    console.log(`  ${miss.email}  ${miss.invoiceId}  ${miss.amount}  → ${miss.reason}`);
  }
} else if (ruledOut.length > 0) {
  console.log('');
  console.log(`(${ruledOut.length} paid invoice(s) on free-tier members were ruled out — --verbose to see why.)`);
}
