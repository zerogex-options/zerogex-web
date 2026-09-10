#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/scan-payment-method-drift.mts \
//     [--verbose]
//
// Find live subscriptions that are PINNED to a payment method the member has
// effectively moved on from — the silent involuntary-churn case that looks like
// an ordinary card decline from every angle we currently watch.
//
// How it happens, and why nothing else catches it: Stripe charges a
// subscription's OWN default_payment_method when one is set, and only falls
// back to the customer's invoice_settings default when it is not (the exact
// order core/stripeCard.ts resolves for the dunning email). A member whose
// renewal fails, then rescues the open invoice from the hosted invoice page or
// the billing portal, pays with a NEW method — and Stripe attaches it and marks
// it the CUSTOMER default, but leaves the subscription's pin untouched. The
// invoice clears, the payment-recovered email goes out, everybody relaxes, and
// next month bills the same dead method again. Twice is not a coincidence and
// the member did nothing wrong; we simply kept charging the card they replaced.
//
// From the outside this is indistinguishable from bad luck: `make diagnose-user`
// shows it per-member (Sub default PM vs Customer default PM on two lines), the
// webhook logs a normal stripe_payment_failed, and the dunning copy correctly
// stays neutral because Stripe returns no useful decline code. Nobody is going
// to spot two rows disagreeing unless they already suspect it, so this sweeps
// the whole base for the disagreement instead.
//
// The severity split matters more than the count:
//   BROKEN   the pinned method is gone or is no longer attached to this
//            customer. That subscription cannot be charged at all — the next
//            renewal is guaranteed to fail, whatever the card behind it says.
//   DRIFT    the pin and the customer default are live and are DIFFERENT
//            instruments. The pinned one may be perfectly good; it is the one
//            the member stopped choosing, which is the signal that it is stale.
//   SAME     the two ids differ but resolve to one instrument (same card
//            fingerprint, or one Link wallet address). Stripe mints a fresh
//            PaymentMethod on many checkouts, so this is bookkeeping, not
//            mis-charging — reported apart from real drift precisely so nobody
//            tells a member their old card was the problem when it was not.
//   NO PIN   neither default is set, so Stripe falls back to the legacy
//            default_source. Usually fine, occasionally the reason a charge
//            fails with nothing on file. Verbose only, unless already failing.
//
// A subscription that is CURRENTLY past_due or unpaid is reported first in each
// bucket: those are not a forecast, they are money that already failed to land.
//
// STRICTLY READ-ONLY. It creates nothing, writes no DB rows, changes no Stripe
// object, sends no email. Every hit prints the exact re-point that would fix it
// for a human to run deliberately.
//
// Reads STRIPE_SECRET_KEY from env or .env.local. Set AUTH_DB_PATH to override
// the default DB path (data/auth.db).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

import {
  classifyPaymentMethodPin,
  decideDriftReportVisibility,
  type InstrumentSameness,
} from '../core/paymentMethodDrift.ts';
import { formatCardBrand } from '../core/stripeCard.ts';

type Args = {
  verbose: boolean;
  help: boolean;
};

// The subscription statuses Stripe will still try to bill. `canceled` and
// `incomplete_expired` are dead ends — a stale pin on one of those costs
// nothing and would bury the live findings. `incomplete` is excluded too: its
// first payment has not settled yet, so a pin that disagrees with the customer
// default is the normal mid-checkout state, not drift.
const BILLABLE_STATUSES = ['trialing', 'active', 'past_due', 'unpaid'] as const;

// Statuses where the drift is not a forecast — a charge has already failed.
const FAILING_STATUSES = new Set<string>(['past_due', 'unpaid']);

// A runaway guard, not a business rule: if the sweep ever walks past this many
// subscriptions something is wrong, and the count is reported rather than
// silently truncated.
const MAX_SUBSCRIPTIONS = 10000;

function usage() {
  console.log(`Find live subscriptions pinned to a payment method the member has moved on from.

Usage:
  node --experimental-strip-types --no-warnings scripts/scan-payment-method-drift.mts [options]

Options:
  --verbose   Also list subscriptions with no default set at all, and the
              healthy ones that were checked and ruled out.
  --help      Show this help.

Read-only — nothing is created, updated or emailed. Confirm any hit with:
  make diagnose-user EMAIL=<addr>
`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { verbose: false, help: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--verbose') args.verbose = true;
    else {
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

function fmtDateUnix(unix: number | null | undefined): string {
  if (unix === null || unix === undefined) return '—';
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

// Resolve a Stripe reference that may be a bare id, an expanded object, or a
// deleted stub, down to its id. Mirrors the idOf() in core/stripeCard.ts.
function idOf(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object' && typeof (ref as { id?: unknown }).id === 'string') {
    return (ref as { id: string }).id;
  }
  return null;
}

// A human label for a payment method. Cards get the same display-ready brand
// the dunning email would print (shared formatCardBrand, so a hit here reads
// exactly like the mail the member received). A Link wallet has no card object
// at all — name the wallet and its email rather than inventing a card, which is
// the same neutral fallback core/stripeCard.ts takes.
function describePaymentMethod(pm: Stripe.PaymentMethod | null, pmId: string | null): string {
  // Always carry the id. Two Link wallets on one address render an identical
  // label, and a report whose two lines read the same is unreadable — the id is
  // the only thing that tells the reader which line is which.
  const suffix = pmId ? `  [${pmId}]` : '';
  if (!pm) return pmId ? `${pmId} (not retrievable)` : 'none';
  if (pm.card?.last4) {
    const brand = formatCardBrand(pm.card.brand) ?? 'Card';
    const exp =
      pm.card.exp_month && pm.card.exp_year
        ? ` exp ${pm.card.exp_month}/${pm.card.exp_year}`
        : '';
    return `${brand} ····${pm.card.last4}${exp}${suffix}`;
  }
  if (pm.type === 'link') {
    const linkEmail = pm.link?.email;
    return `${linkEmail ? `Link wallet (${linkEmail})` : 'Link wallet'}${suffix}`;
  }
  if (pm.type === 'us_bank_account' && pm.us_bank_account?.last4) {
    return `Bank account ····${pm.us_bank_account.last4}${suffix}`;
  }
  return `${pm.type ?? 'unknown method'}${suffix}`;
}

// Stable per-instrument identity, the same one scripts/dedupe-payment-methods.mjs
// groups on: card.fingerprint survives re-tokenizing the same card, and a Link
// wallet is identified by its address. Null when the method exposes neither, so
// the caller degrades to 'unknown' rather than calling two things equal on the
// strength of having learned nothing about either.
function instrumentIdentity(pm: Stripe.PaymentMethod): string | null {
  const fingerprint = pm.card?.fingerprint;
  if (fingerprint) return `card:${fingerprint}`;
  if (pm.type === 'link' && pm.link?.email) return `link:${pm.link.email.toLowerCase()}`;
  if (pm.type === 'us_bank_account' && pm.us_bank_account?.fingerprint) {
    return `bank:${pm.us_bank_account.fingerprint}`;
  }
  return null;
}

// Is the pin actually different MONEY from the customer default, or just a
// second object for the same instrument? Differing types settle it outright;
// otherwise compare identities, and admit ignorance when either side has none.
function compareInstruments(
  a: Stripe.PaymentMethod | null,
  b: Stripe.PaymentMethod | null,
): InstrumentSameness {
  if (!a || !b) return 'unknown';
  if (a.type !== b.type) return 'different';
  const idA = instrumentIdentity(a);
  const idB = instrumentIdentity(b);
  if (!idA || !idB) return 'unknown';
  return idA === idB ? 'same' : 'different';
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
};

// One pass over the users table so the sweep can name a member without a query
// per subscription. Soft-deleted accounts are excluded: they get no outreach,
// so a stale pin on one is not a finding anybody would act on.
const userByCustomer = new Map<string, UserRow>();
for (const row of querySqlite<UserRow>(
  dbPath,
  `SELECT email, tier, stripe_customer_id
     FROM users
    WHERE stripe_customer_id IS NOT NULL
      AND stripe_customer_id <> ''
      AND deleted_at IS NULL;`,
)) {
  userByCustomer.set(row.stripe_customer_id, row);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

type Finding = {
  email: string;
  tier: string;
  subscriptionId: string;
  status: string;
  currentPeriodEnd: string;
  pinnedId: string | null;
  pinnedLabel: string;
  customerDefaultId: string | null;
  customerDefaultLabel: string;
  // Set on BROKEN findings: why the pinned method cannot be charged.
  brokenReason?: string;
};

const broken: Finding[] = [];
const drift: Finding[] = [];
const duplicate: Finding[] = [];
const noPin: Finding[] = [];
const healthy: Finding[] = [];
// Live subscriptions whose customer has no local account — a different failure
// from the one this hunts, and worth seeing rather than dropping silently.
const unknownCustomers = new Set<string>();

// One payment method can back many subscriptions on a shared customer; cache so
// a re-check never costs a second retrieve. `null` is a real cached answer here
// (the method is gone), so presence is tested with has(), not a truthy value.
const pmCache = new Map<string, Stripe.PaymentMethod | null>();
async function retrievePaymentMethod(id: string): Promise<Stripe.PaymentMethod | null> {
  if (pmCache.has(id)) return pmCache.get(id) ?? null;
  let result: Stripe.PaymentMethod | null = null;
  try {
    result = await stripe.paymentMethods.retrieve(id);
  } catch (err) {
    const code = (err as { code?: string }).code;
    const statusCode = (err as { statusCode?: number }).statusCode;
    // A detached or deleted method 404s. That is the finding, not an error.
    if (code === 'resource_missing' || statusCode === 404) result = null;
    else throw err;
  }
  pmCache.set(id, result);
  return result;
}

console.log(`Auth DB:            ${dbPath}`);
console.log(`Known customers:    ${userByCustomer.size}`);
console.log(`Statuses swept:     ${BILLABLE_STATUSES.join(', ')}`);
console.log('');
process.stdout.write('Scanning Stripe subscriptions');

let scanned = 0;
let hitCap = false;

try {
  for (const status of BILLABLE_STATUSES) {
    if (hitCap) break;
    for await (const sub of stripe.subscriptions.list({
      status,
      limit: 100,
      // Both expansions are resolved server-side, which is what keeps this a
      // handful of round trips rather than two retrieves per subscription. The
      // customer is needed only for invoice_settings.default_payment_method,
      // which comes back as a bare id — exactly what the comparison wants.
      expand: ['data.default_payment_method', 'data.customer'],
    })) {
      scanned += 1;
      if (scanned % 100 === 0) process.stdout.write('.');
      if (scanned >= MAX_SUBSCRIPTIONS) {
        hitCap = true;
        break;
      }

      const customerId = idOf(sub.customer);
      if (!customerId) continue;

      const user = userByCustomer.get(customerId);
      if (!user) {
        unknownCustomers.add(customerId);
        continue;
      }

      // A deleted customer stub carries no invoice_settings; treat its default
      // as unset rather than reading through a stub that has no such field.
      const customer =
        sub.customer && typeof sub.customer === 'object' && !('deleted' in sub.customer)
          ? (sub.customer as Stripe.Customer)
          : null;
      const customerDefaultId = idOf(customer?.invoice_settings?.default_payment_method);
      const pinnedId = idOf(sub.default_payment_method);

      // Stripe exposes the current period end on the subscription's first item
      // in recent API versions and at the top level in older ones. Read both so
      // the report is not blank on whichever version this account is pinned to.
      const periodEndUnix =
        (sub as unknown as { current_period_end?: number }).current_period_end ??
        sub.items?.data?.[0]?.current_period_end ??
        null;

      const base = {
        email: user.email,
        tier: user.tier ?? 'public',
        subscriptionId: sub.id,
        status: sub.status,
        currentPeriodEnd: fmtDateUnix(periodEndUnix),
        pinnedId,
        customerDefaultId,
      };

      // Resolve both methods before classifying. A pin that cannot be retrieved
      // is the finding itself, not an error, so a null here is meaningful.
      const pinnedPm = pinnedId ? await retrievePaymentMethod(pinnedId) : null;
      const customerDefaultPm = customerDefaultId
        ? await retrievePaymentMethod(customerDefaultId)
        : null;

      // The classification itself lives in core/paymentMethodDrift.ts so the
      // matrix can be tested without a Stripe account — this script only
      // gathers the facts and renders the verdict.
      const verdict = classifyPaymentMethodPin({
        customerId,
        pinnedPaymentMethodId: pinnedId,
        customerDefaultPaymentMethodId: customerDefaultId,
        pinnedExists: pinnedPm !== null,
        pinnedOwnerCustomerId: idOf(pinnedPm?.customer),
        instrumentSameness: compareInstruments(pinnedPm, customerDefaultPm),
      });

      const record: Finding = {
        ...base,
        pinnedLabel: pinnedId
          ? describePaymentMethod(pinnedPm, pinnedId)
          : 'none (falls back to customer default)',
        customerDefaultLabel: describePaymentMethod(customerDefaultPm, customerDefaultId),
      };

      if (verdict.kind === 'broken') broken.push({ ...record, brokenReason: verdict.reason });
      else if (verdict.kind === 'drift') drift.push(record);
      else if (verdict.kind === 'duplicate') duplicate.push(record);
      else if (verdict.kind === 'no_default') noPin.push(record);
      else healthy.push(record);
    }
  }
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.log('');
  console.error(`Error: Stripe subscription sweep failed after ${scanned} subscriptions: ${message}`);
  console.error('Nothing was written — re-run when Stripe is reachable.');
  process.exit(1);
}

// Money that has already failed to land outranks money that is going to. Within
// a bucket, put the currently-failing subscriptions first so the top of the
// report is always the list worth acting on today.
function byUrgency(a: Finding, b: Finding): number {
  const aFailing = FAILING_STATUSES.has(a.status) ? 0 : 1;
  const bFailing = FAILING_STATUSES.has(b.status) ? 0 : 1;
  if (aFailing !== bFailing) return aFailing - bFailing;
  return a.email.localeCompare(b.email);
}
broken.sort(byUrgency);
drift.sort(byUrgency);
duplicate.sort(byUrgency);
noPin.sort(byUrgency);

function printFinding(f: Finding) {
  const failing = FAILING_STATUSES.has(f.status) ? '  ← CHARGE ALREADY FAILING' : '';
  console.log(`  ${f.email}  (${f.tier})${failing}`);
  console.log(`    ${f.subscriptionId}  status=${f.status}  period ends ${f.currentPeriodEnd}`);
  if (f.brokenReason) console.log(`    problem:          ${f.brokenReason}`);
  console.log(`    subscription pin: ${f.pinnedLabel}`);
  console.log(`    customer default: ${f.customerDefaultLabel}`);
  console.log(`    make diagnose-user EMAIL=${f.email}`);
  if (f.customerDefaultId && f.customerDefaultId !== f.pinnedId) {
    console.log(
      `    re-point:         stripe subscriptions update ${f.subscriptionId} \\
                        --default-payment-method ${f.customerDefaultId}`,
    );
  } else {
    console.log('    re-point:         ask the member for a current method — there is no');
    console.log('                      newer default on the customer to fall back to.');
  }
  console.log('');
}

console.log('');
console.log('');
console.log(`Scanned:            ${scanned} billable subscriptions`);
if (hitCap) {
  console.log(`  NOTE: stopped at the ${MAX_SUBSCRIPTIONS}-subscription cap — findings are partial.`);
}
console.log('');

// Same-instrument pairs are mostly bookkeeping: Stripe minted a second object
// for one card and nothing is actually being mis-charged, so listing them
// beside real drift would drown it. The exception is a subscription that is
// ALREADY failing — there the re-point is cheap enough to try even at low
// confidence, and the operator needs to see that this member's two methods are
// NOT the tidy old-card/new-card story, so the copy they send does not promise
// a fix the re-point cannot deliver.
const failingDuplicates = duplicate.filter((f) => FAILING_STATUSES.has(f.status));
const visibility = decideDriftReportVisibility({
  brokenCount: broken.length,
  driftCount: drift.length,
  duplicateCount: duplicate.length,
  failingDuplicateCount: failingDuplicates.length,
  verbose: cliArgs.verbose,
});
const duplicateShown = cliArgs.verbose ? duplicate : failingDuplicates;

// The all-clear has to be keyed on what this run will actually PRINT, not on
// what it found. Keying it on duplicate.length meant a base whose only pairs
// were same-instrument and healthy suppressed the all-clear AND suppressed the
// duplicates section that suppressed it — so the report said nothing at all
// between the scanned count and the footer, and an operator could not tell a
// clean sweep from truncated output.
if (visibility.allClear) {
  console.log('No payment-method drift. Every billable subscription is either pinned to a');
  console.log("method that is still the member's default, or has no pin at all and will");
  console.log('correctly fall back to whatever the customer has on file.');
  if (visibility.hiddenDuplicateCount > 0) {
    const n = visibility.hiddenDuplicateCount;
    console.log('');
    // One whole sentence per line here, rather than prose hard-wrapped to the
    // width of the block above. The count is interpolated, so the line's width
    // moves with it: a wrap tuned for 2 findings breaks in the wrong place for
    // 200, and a short ragged first line reads as broken text rather than as
    // deliberate wrapping.
    console.log(
      `${n} subscription${n === 1 ? ' carries' : 's carry'} two payment-method ids for a single instrument.`,
    );
    console.log('None is failing, so there is nothing to do about them.');
    console.log('Pass --verbose to see them.');
  }
}

if (broken.length > 0) {
  console.log(`BROKEN PIN: ${broken.length}`);
  console.log('The method these subscriptions are set to charge is gone or is no longer');
  console.log('attached to the customer. The next renewal fails regardless of the card.');
  console.log('');
  for (const f of broken) printFinding(f);
}

if (drift.length > 0) {
  console.log(`DRIFTED PIN: ${drift.length}`);
  console.log('These subscriptions charge one method while the member has since made a');
  console.log('different one their default — typically after rescuing a failed invoice.');
  console.log('The pinned method may still be good; it is the one they stopped choosing.');
  console.log('');
  for (const f of drift) printFinding(f);
}

if (duplicateShown.length > 0) {
  console.log(
    `SAME INSTRUMENT, TWO OBJECTS: ${duplicateShown.length}${
      cliArgs.verbose ? '' : ` of ${duplicate.length}`
    }`,
  );
  console.log('The pin and the default are different ids for what looks like one instrument');
  console.log('(same card fingerprint, or one Link wallet address). Re-pointing is close to');
  console.log('a no-op, so do NOT tell these members their old card was the problem — for a');
  console.log('Link pair especially, the funding card inside the wallet is never exposed and');
  console.log('may differ or may not. Treat a re-point here as cheap to try, not as a fix.');
  if (!cliArgs.verbose) {
    console.log('Only the already-failing ones are shown; --verbose for all.');
  }
  console.log('');
  for (const f of duplicateShown) printFinding(f);
}

if (noPin.length > 0 && (cliArgs.verbose || noPin.some((f) => FAILING_STATUSES.has(f.status)))) {
  const shown = cliArgs.verbose ? noPin : noPin.filter((f) => FAILING_STATUSES.has(f.status));
  console.log(`NO DEFAULT ANYWHERE: ${shown.length}${cliArgs.verbose ? '' : ` of ${noPin.length}`}`);
  console.log('Neither the subscription nor the customer names a default payment method,');
  console.log('so Stripe falls back to the legacy default_source. Often harmless — but it');
  console.log('is also what a charge with nothing on file looks like.');
  if (!cliArgs.verbose) console.log('Only the already-failing ones are shown; --verbose for all.');
  console.log('');
  for (const f of shown) printFinding(f);
}

if (unknownCustomers.size > 0) {
  console.log(`UNKNOWN CUSTOMERS: ${unknownCustomers.size}`);
  console.log('Live subscriptions whose Stripe customer matches no local account. Not this');
  console.log("script's quarry, but they should not exist either:");
  for (const id of unknownCustomers) console.log(`  ${id}`);
  console.log('');
}

if (cliArgs.verbose && healthy.length > 0) {
  console.log(`RULED OUT: ${healthy.length}`);
  console.log('Checked and consistent — the pin agrees with the default, or there is no pin');
  console.log('and the fallback resolves to a real method.');
  console.log('');
  for (const f of healthy) {
    console.log(`  ${f.email}  ${f.subscriptionId}  status=${f.status}`);
    console.log(`    charges: ${f.pinnedId ? f.pinnedLabel : f.customerDefaultLabel}`);
  }
  console.log('');
}

console.log('Read-only: nothing above was changed. Confirm a finding with');
console.log('`make diagnose-user EMAIL=<addr>` before re-pointing anything, and re-point');
console.log('only after the member has told you which method they actually want charged.');
