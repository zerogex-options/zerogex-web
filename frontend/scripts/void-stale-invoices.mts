#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/void-stale-invoices.mts \
//     [--since-days 365] [--email <addr>] [--dry-run | --yes] [--verbose]
//
// Void the open invoices that can no longer buy anything.
//
// When Stripe kills a subscription for nonpayment it leaves the final invoice
// OPEN and payable, with a live hosted payment page. For the rest of the period
// that invoice covers, that is a feature: paying it buys back real access, and
// core/orphanPayment.ts re-creates the plan to grant it.
//
// Past the end of that period it inverts. Stripe will not accept a billing
// anchor in the past, so the orphan path returns `period_already_elapsed`, the
// money lands with no entitlement, and it sits there until a human notices. The
// invoice has quietly become a way to take a member's money for nothing — and
// its payment link is still sitting in their inbox, in every dunning email
// Stripe sent them.
//
// The webhook now voids one that is already past its period at the moment of
// cancellation, but that is the rare case: at cancellation the period has
// usually barely started. The common case is an invoice that goes stale WEEKS
// later, with nothing watching. That is what this sweep is for.
//
// Every invoice is put through core/staleInvoice.ts — the same decision the
// webhook uses — so the two can never disagree about what is safe to void.
//
// DRY-RUN BY DEFAULT. Voiding is final and cannot be undone.
//
// Reads STRIPE_SECRET_KEY from env or .env.local.

import fs from 'node:fs';
import path from 'node:path';

import Stripe from 'stripe';

import { decideStaleInvoice } from '../core/staleInvoice.ts';
import { readInvoicePeriodEndUnix, readInvoiceSubscriptionId } from '../core/stripeInvoice.ts';

// A runaway guard, not a business rule: if a sweep walks past this many open
// invoices something is wrong with the window, and the count is reported rather
// than silently truncated.
const MAX_INVOICES = 10000;

type Args = {
  sinceDays: number;
  email: string | null;
  includeVoluntary: boolean;
  dryRun: boolean;
  yes: boolean;
  verbose: boolean;
  help: boolean;
};

function usage() {
  console.log(`Void open invoices that can no longer buy the access they bill for.

Usage:
  node --experimental-strip-types --no-warnings scripts/void-stale-invoices.mts [options]

Options:
  --since-days <n>   How far back to walk open invoices (default 365).
  --email <addr>     Only consider invoices for this customer's email.
  --include-voluntary
                     Also void leftovers from subscriptions the MEMBER cancelled.
                     Off by default: dunning cuts access at cancellation, so its
                     invoice bills for time never delivered, whereas a voluntary
                     cancel's unpaid invoice may be a bill for time actually
                     served. Writing that off is your call, not the sweep's.
  --dry-run          Report and change nothing. THE DEFAULT.
  --yes              Actually void. Final; cannot be undone.
  --verbose          Also list the invoices that were left alone, and why.
  --help             Show this help.

An invoice is voided only when ALL of these hold:
  - it is 'open' with a non-zero amount due,
  - its subscription is gone or in a terminal state,
  - Stripe ended that subscription for nonpayment (or --include-voluntary),
  - the period it covers has ALREADY ended.

Anything still inside its period is left payable on purpose: paying it buys
back real access, which core/orphanPayment.ts grants.
`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    sinceDays: 365,
    email: null,
    includeVoluntary: false,
    dryRun: false,
    yes: false,
    verbose: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--verbose') args.verbose = true;
    else if (arg === '--include-voluntary') args.includeVoluntary = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes') args.yes = true;
    else if (arg === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase();
    else if (arg === '--since-days') {
      const parsed = Number.parseInt(argv[++i] ?? '', 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.error('Error: --since-days needs a positive number.');
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

function isoOf(unix: number | null | undefined): string {
  return typeof unix === 'number' ? new Date(unix * 1000).toISOString() : '—';
}

function money(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
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
const apply = cliArgs.yes;

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || envLocal.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY not set in env or .env.local.');
  process.exit(1);
}
const stripe = new Stripe(STRIPE_SECRET_KEY);

const nowUnix = Math.floor(Date.now() / 1000);
const sinceUnix = nowUnix - cliArgs.sinceDays * 24 * 60 * 60;

console.log(`Mode:            ${apply ? 'APPLY (voids are final)' : 'DRY RUN (nothing will change)'}`);
console.log(`Window:          open invoices created since ${isoOf(sinceUnix)}`);
console.log(`Email filter:    ${cliArgs.email ?? '—'}`);
console.log(
  `Scope:           ${cliArgs.includeVoluntary ? 'nonpayment AND voluntary cancels' : 'nonpayment cancels only'}`,
);
console.log('');

// Resolve the email filter to customer ids up front, so the walk itself stays
// one pass over Stripe's open invoices.
const emailCustomerIds = new Set<string>();
if (cliArgs.email) {
  for await (const customer of stripe.customers.list({ email: cliArgs.email, limit: 100 })) {
    emailCustomerIds.add(customer.id);
  }
  if (emailCustomerIds.size === 0) {
    console.log(`No Stripe customer found for ${cliArgs.email}.`);
    process.exit(0);
  }
}

// Cache: many open invoices share a subscription, and each lookup is a round
// trip. Keys are subscription ids; the value is the live status, or null when
// the subscription no longer exists.
type SubFacts = { status: string | null; cancellationReason: string | null };
const subStatusCache = new Map<string, SubFacts>();
async function liveSubscriptionFacts(subId: string): Promise<SubFacts> {
  const cached = subStatusCache.get(subId);
  if (cached !== undefined) return cached;
  let status: string | null = null;
  let cancellationReason: string | null = null;
  try {
    const sub = await stripe.subscriptions.retrieve(subId);
    status = sub.status ?? null;
    cancellationReason = sub.cancellation_details?.reason ?? null;
  } catch (err) {
    const code = (err as { code?: string }).code;
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (!(code === 'resource_missing' || statusCode === 404)) {
      // An unreadable subscription is not a dead one. Re-throwing would abort
      // the sweep; recording 'unknown' keeps the decision conservative (it is
      // not in LIVE_SUBSCRIPTION_STATUSES, but the period test still has to
      // pass before anything is voided).
      console.log(`  ! could not read subscription ${subId}: ${(err as Error).message}`);
    }
  }
  const facts: SubFacts = { status, cancellationReason };
  subStatusCache.set(subId, facts);
  return facts;
}

let seen = 0;
let voided = 0;
let wouldVoid = 0;
let kept = 0;
let capped = false;
const failures: string[] = [];

for await (const invoice of stripe.invoices.list({
  status: 'open',
  created: { gte: sinceUnix },
  limit: 100,
})) {
  seen += 1;
  if (seen > MAX_INVOICES) {
    capped = true;
    break;
  }

  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
  if (emailCustomerIds.size > 0 && (!customerId || !emailCustomerIds.has(customerId))) continue;

  const subId = readInvoiceSubscriptionId(invoice);
  const subFacts: SubFacts = subId
    ? await liveSubscriptionFacts(subId)
    : { status: null, cancellationReason: null };
  const periodEndUnix = readInvoicePeriodEndUnix(invoice);

  const decision = decideStaleInvoice({
    invoiceStatus: invoice.status ?? null,
    amountDue: invoice.amount_due ?? 0,
    periodEndUnix,
    subscriptionStatus: subFacts.status,
    cancellationReason: subFacts.cancellationReason,
    includeVoluntary: cliArgs.includeVoluntary,
    nowUnix,
  });

  const label =
    `${invoice.id}  ${money(invoice.amount_due ?? 0, invoice.currency ?? 'usd')}  ` +
    `customer=${customerId ?? '—'}  sub=${subId ?? 'none'}(${subFacts.status ?? 'gone'}` +
    `${subFacts.cancellationReason ? `/${subFacts.cancellationReason}` : ''})  ` +
    `covers until ${isoOf(periodEndUnix)}`;

  if (decision.kind === 'keep') {
    kept += 1;
    if (cliArgs.verbose) console.log(`  keep   ${label}  [${decision.reason}]`);
    continue;
  }

  if (!apply) {
    wouldVoid += 1;
    console.log(`  WOULD VOID  ${label}`);
    continue;
  }

  try {
    if (!invoice.id) continue;
    await stripe.invoices.voidInvoice(invoice.id);
    voided += 1;
    console.log(`  VOIDED      ${label}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failures.push(`${invoice.id}: ${message}`);
    console.log(`  FAILED      ${label}  — ${message}`);
  }
}

console.log('');
console.log(`Open invoices walked:   ${seen}`);
console.log(`Left payable:           ${kept}`);
console.log(apply ? `Voided:                 ${voided}` : `Would void:             ${wouldVoid}`);
if (failures.length > 0) {
  console.log(`Failed:                 ${failures.length}`);
  for (const failure of failures) console.log(`  ${failure}`);
}
if (capped) {
  console.log(`⚠ Stopped at the ${MAX_INVOICES}-invoice guard; narrow with --since-days.`);
}
if (!apply && wouldVoid > 0) {
  console.log('');
  console.log('Re-run with --yes to void these. It cannot be undone.');
}
